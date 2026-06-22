from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any

from openai import OpenAI
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from .config import get_settings
from .models import AIAnalysisVersion, SurveyCampaign, SurveyResponse, User

PROMPT_VERSION = "gri-v1"

AI_FIELDS = [
    "zh_summary",
    "en_summary",
    "material_topic_ranking",
    "stakeholder_difference_analysis",
    "management_recommendations",
    "report_paragraph_zh",
    "report_paragraph_en",
    "gri_3_1",
    "gri_3_2",
    "gri_3_3",
    "disclaimer",
]


def redact_personal_data(text: str) -> str:
    value = re.sub(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", "[email]", text, flags=re.I)
    value = re.sub(r"09\d{2}[-\s]?\d{3}[-\s]?\d{3}", "[phone]", value)
    value = re.sub(r"\b\d{8,12}\b", "[id]", value)
    return value[:500]


def latest_ai_analysis(db: Session, campaign_id: int) -> AIAnalysisVersion | None:
    return db.scalar(
        select(AIAnalysisVersion)
        .where(AIAnalysisVersion.campaign_id == campaign_id, AIAnalysisVersion.is_active.is_(True))
        .order_by(AIAnalysisVersion.version.desc())
        .limit(1)
    )


def list_ai_analysis_versions(db: Session, campaign_id: int) -> list[AIAnalysisVersion]:
    return list(
        db.scalars(
            select(AIAnalysisVersion)
            .where(AIAnalysisVersion.campaign_id == campaign_id)
            .order_by(AIAnalysisVersion.version.desc())
        )
    )


def analysis_content(version: AIAnalysisVersion | None, fallback: dict[str, str]) -> dict[str, str]:
    if not version:
        return fallback
    try:
        parsed = json.loads(version.content_json)
        if isinstance(parsed, dict):
            return {field: str(parsed.get(field) or fallback[field]) for field in AI_FIELDS}
    except json.JSONDecodeError:
        pass
    return fallback


def build_ai_context(db: Session, campaign: SurveyCampaign, analytics: dict[str, Any]) -> dict[str, Any]:
    answers = db.scalars(
        select(SurveyResponse.open_answer).where(
            SurveyResponse.campaign_id == campaign.id,
            SurveyResponse.open_answer.is_not(None),
        )
    ).all()
    anonymized_answers = [redact_personal_data(answer) for answer in answers if answer][:30]
    return {
        "campaign": {
            "id": campaign.id,
            "title": campaign.title,
            "year": campaign.year,
            "impact_threshold": campaign.impact_threshold,
            "financial_threshold": campaign.financial_threshold,
        },
        "response_count": analytics["response_count"],
        "stakeholder_count": analytics["stakeholder_count"],
        "stakeholders": [
            {"group": item["name"], "count": item["count"], "weight": item["weight"]}
            for item in analytics["stakeholders"]
        ],
        "topics": [
            {
                "code": item["code"],
                "name": item["name"],
                "category": item["category"],
                "organization": item["organization"],
                "impact": item["impact"],
                "financial": item["financial"],
                "weighted_impact": item["weighted_impact"],
                "weighted_financial": item["weighted_financial"],
                "response_count": item["response_count"],
                "quadrant": item["quadrant"],
            }
            for item in analytics["topics"]
        ],
        "stakeholder_topic_segments": [
            {
                "stakeholder_group": item["stakeholder_group_name"],
                "topic_code": item["code"],
                "impact": item["impact"],
                "financial": item["financial"],
                "response_count": item["response_count"],
            }
            for item in analytics["stakeholder_topics"]
        ],
        "keywords": analytics["keywords"],
        "deidentified_open_answers": anonymized_answers,
        "privacy_rule": "Only aggregate data and deidentified open answers are included. Names, emails, phone numbers and IDs are not sent.",
    }


def fallback_ai_sections(analytics: dict[str, Any]) -> dict[str, str]:
    ranked = sorted(
        [topic for topic in analytics["topics"] if topic["response_count"] > 0],
        key=lambda item: (item["weighted_impact"] + item["weighted_financial"], item["impact"] + item["financial"]),
        reverse=True,
    )
    major = [topic for topic in ranked if topic["quadrant"] == "重大主題"]
    major_names = "、".join(f"{topic['code']} {topic['name']}" for topic in major[:5]) or "尚無議題同時達到衝擊與財務重大性門檻"
    top_lines = "；".join(
        f"{index + 1}. {topic['code']} {topic['name']}（加權衝擊 {topic['weighted_impact']:.2f}、加權財務 {topic['weighted_financial']:.2f}）"
        for index, topic in enumerate(ranked[:5])
    ) or "尚無足夠資料可排序。"
    stakeholder_notes = "；".join(
        f"{item['name']} n={item['count']} w={item['weight']:.2f}"
        for item in analytics["stakeholders"]
        if item["count"] > 0
    ) or "尚無利害關係人分群回收資料。"
    zh_summary = (
        "AI 草稿，需人工審閱。"
        f"本次共回收 {analytics['response_count']} 份有效問卷，涵蓋 {analytics['stakeholder_count']} 類利害關係人。"
        f"依雙重重大性門檻判定，優先重大主題為：{major_names}。"
    )
    en_summary = (
        "AI draft, human review required. "
        f"The assessment collected {analytics['response_count']} valid responses from {analytics['stakeholder_count']} stakeholder groups. "
        f"Priority material topics: {major_names}."
    )
    return {
        "zh_summary": zh_summary,
        "en_summary": en_summary,
        "material_topic_ranking": f"重大主題排序建議：{top_lines}",
        "stakeholder_difference_analysis": f"分群差異分析應優先檢視各群體回收數與權重設定。本次分群概況：{stakeholder_notes}",
        "management_recommendations": "建議由各責任單位確認重大主題之政策承諾、管理方針、年度目標、KPI、改善措施與追蹤頻率，並保留審閱紀錄。",
        "report_paragraph_zh": zh_summary + "學校應將重大主題鑑別流程、門檻設定與利害關係人參與紀錄納入永續報告書佐證。",
        "report_paragraph_en": en_summary + " The university should retain evidence of stakeholder engagement, thresholds, weighting and management review.",
        "gri_3_1": "本校透過利害關係人識別、議題庫建立、問卷評分、衝擊重大性與財務重大性分析、權重設定及管理者審閱，決定年度重大主題。",
        "gri_3_2": f"依本次評估結果，重大主題包含：{major_names}。",
        "gri_3_3": "各重大主題須由責任單位確認管理方針、政策承諾、行動方案、有效性追蹤、指標與目標，並於報告書揭露。",
        "disclaimer": "AI 草稿，需人工審閱。",
    }


def input_hash(context: dict[str, Any]) -> str:
    payload = json.dumps(context, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def generate_ai_sections(context: dict[str, Any], fallback: dict[str, str]) -> tuple[dict[str, str], str]:
    settings = get_settings()
    if not settings.openai_api_key:
        return fallback, "fallback"
    try:
        client = OpenAI(api_key=settings.openai_api_key)
        result = client.responses.create(
            model=settings.openai_model,
            input=[
                {
                    "role": "system",
                    "content": (
                        "You write double materiality and GRI 3-1/3-2/3-3 draft sections for a Taiwanese university sustainability report. "
                        "Use only the aggregate and deidentified input. Do not infer or create personal data. "
                        "Every Chinese or English narrative must include that it is an AI draft requiring human review. "
                        "Return JSON with exactly these keys: "
                        + ", ".join(AI_FIELDS)
                        + "."
                    ),
                },
                {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
            ],
            text={"format": {"type": "json_object"}},
        )
        parsed = json.loads(result.output_text)
        content = {field: str(parsed.get(field) or fallback[field]) for field in AI_FIELDS}
        if "AI 草稿" not in content["disclaimer"]:
            content["disclaimer"] = "AI 草稿，需人工審閱。"
        return content, settings.openai_model
    except Exception:
        return fallback, "fallback"


def create_ai_analysis_version(
    db: Session,
    campaign: SurveyCampaign,
    analytics: dict[str, Any],
    user: User | None,
    overwrite_active: bool = True,
) -> AIAnalysisVersion:
    context = build_ai_context(db, campaign, analytics)
    fallback = fallback_ai_sections(analytics)
    content, model = generate_ai_sections(context, fallback)
    if overwrite_active:
        db.execute(
            update(AIAnalysisVersion)
            .where(AIAnalysisVersion.campaign_id == campaign.id, AIAnalysisVersion.is_active.is_(True))
            .values(is_active=False)
        )
    current_max = db.scalar(
        select(func.max(AIAnalysisVersion.version)).where(AIAnalysisVersion.campaign_id == campaign.id)
    ) or 0
    version = AIAnalysisVersion(
        campaign_id=campaign.id,
        version=current_max + 1,
        model=model,
        prompt_version=PROMPT_VERSION,
        input_hash=input_hash(context),
        content_json=json.dumps(content, ensure_ascii=False),
        is_active=True,
        created_by_user_id=user.id if user else None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(version)
    db.flush()
    return version


def version_to_dict(version: AIAnalysisVersion) -> dict[str, Any]:
    return {
        "id": version.id,
        "campaign_id": version.campaign_id,
        "version": version.version,
        "model": version.model,
        "prompt_version": version.prompt_version,
        "input_hash": version.input_hash,
        "content": json.loads(version.content_json),
        "is_active": version.is_active,
        "created_at": version.created_at,
    }
