import json
import re
from collections import Counter

from openai import OpenAI
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import StakeholderGroup, SurveyCampaign, SurveyResponse, Topic, TopicScore, User


KEYWORD_MAP = {
    "能源管理": ("能源", "節電", "太陽能", "再生能源"),
    "人才培育": ("人才", "培育", "教學", "課程", "職涯"),
    "資訊安全": ("資安", "資訊安全", "個資", "隱私"),
    "溫室氣體排放": ("碳", "溫室氣體", "淨零", "排放"),
    "多元共融": ("多元", "共融", "平等", "性別"),
    "社區參與": ("社區", "在地", "地方創生"),
    "水資源": ("水資源", "節水"),
    "廢棄物": ("廢棄物", "回收", "減塑"),
}


def quadrant(impact: float, financial: float, campaign: SurveyCampaign) -> str:
    high_impact = impact >= campaign.impact_threshold
    high_financial = financial >= campaign.financial_threshold
    if high_impact and high_financial:
        return "重大主題"
    if high_impact:
        return "揭露主題"
    if high_financial:
        return "風險主題"
    return "觀察主題"


def extract_keywords(answers: list[str]) -> list[dict]:
    counts = Counter()
    text = "\n".join(answers)
    for label, aliases in KEYWORD_MAP.items():
        counts[label] = sum(len(re.findall(re.escape(alias), text, re.I)) for alias in aliases)
    return [
        {"keyword": keyword, "count": count}
        for keyword, count in counts.most_common()
        if count > 0
    ][:8]


def fallback_analysis(response_count: int, stakeholder_count: int, topics: list[dict]) -> tuple[str, str]:
    major = [item["name"] for item in topics if item["quadrant"] == "重大主題"][:4]
    names_zh = "、".join(f"「{name}」" for name in major) or "目前尚無議題達重大門檻"
    names_en = ", ".join(major) or "no topic has reached both thresholds yet"
    zh = (
        f"本次共回收 {response_count} 份有效問卷，涵蓋 {stakeholder_count} 類利害關係人。"
        f"雙重重大性分析顯示，{names_zh}為本期優先關注結果。"
        "建議永續治理單位檢視高衝擊或高財務風險議題，並將門檻、評分依據與利害關係人參與紀錄納入佐證。"
    )
    en = (
        f"A total of {response_count} valid responses were collected from "
        f"{stakeholder_count} stakeholder groups. The double materiality assessment identifies "
        f"{names_en} as the current priority result. The university should retain scoring criteria, "
        "threshold decisions and stakeholder engagement records as supporting evidence."
    )
    return zh, en


def generate_ai_analysis(response_count: int, stakeholder_count: int, topics: list[dict]) -> tuple[str, str]:
    settings = get_settings()
    fallback = fallback_analysis(response_count, stakeholder_count, topics)
    if not settings.openai_api_key or response_count == 0:
        return fallback
    try:
        client = OpenAI(api_key=settings.openai_api_key)
        result = client.responses.create(
            model=settings.openai_model,
            input=[
                {
                    "role": "system",
                    "content": (
                        "You write concise, evidence-based double materiality assessment summaries "
                        "for a Taiwanese university. Return JSON with analysis_zh and analysis_en. "
                        "Do not invent facts beyond the supplied data."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "response_count": response_count,
                            "stakeholder_count": stakeholder_count,
                            "topics": topics,
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            text={"format": {"type": "json_object"}},
        )
        data = json.loads(result.output_text)
        return data["analysis_zh"], data["analysis_en"]
    except Exception:
        return fallback


def build_analytics(db: Session, campaign: SurveyCampaign) -> dict:
    response_count = db.scalar(
        select(func.count(SurveyResponse.id)).where(SurveyResponse.campaign_id == campaign.id)
    ) or 0
    eligible_count = db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0

    rows = db.execute(
        select(
            Topic.id,
            Topic.code,
            Topic.name_zh,
            Topic.category,
            func.avg(TopicScore.organization_score),
            func.avg(TopicScore.impact_score),
            func.avg(TopicScore.financial_score),
            func.count(TopicScore.id),
        )
        .outerjoin(TopicScore, TopicScore.topic_id == Topic.id)
        .outerjoin(SurveyResponse, SurveyResponse.id == TopicScore.response_id)
        .where(
            Topic.is_active.is_(True),
            (SurveyResponse.campaign_id == campaign.id) | (SurveyResponse.id.is_(None)),
        )
        .group_by(Topic.id)
        .order_by(Topic.sort_order)
    ).all()

    topics = []
    for topic_id, code, name, category, organization, impact, financial, count in rows:
        organization_value = round(float(organization or 0), 2)
        impact_value = round(float(impact or 0), 2)
        financial_value = round(float(financial or 0), 2)
        topics.append(
            {
                "topic_id": topic_id,
                "code": code,
                "name": name,
                "category": category,
                "organization": organization_value,
                "impact": impact_value,
                "financial": financial_value,
                "response_count": count,
                "quadrant": quadrant(impact_value, financial_value, campaign)
                if count
                else "尚無資料",
            }
        )

    stakeholder_rows = db.execute(
        select(StakeholderGroup.name, func.count(SurveyResponse.id))
        .join(User, User.stakeholder_group_id == StakeholderGroup.id)
        .join(SurveyResponse, SurveyResponse.respondent_id == User.id)
        .where(SurveyResponse.campaign_id == campaign.id)
        .group_by(StakeholderGroup.id)
        .order_by(func.count(SurveyResponse.id).desc())
    ).all()
    stakeholders = [{"name": name, "count": count} for name, count in stakeholder_rows]

    answers = db.scalars(
        select(SurveyResponse.open_answer).where(
            SurveyResponse.campaign_id == campaign.id,
            SurveyResponse.open_answer.is_not(None),
        )
    ).all()
    keywords = extract_keywords([answer for answer in answers if answer])
    stakeholder_count = len(stakeholders)
    analysis_zh, analysis_en = generate_ai_analysis(response_count, stakeholder_count, topics)

    return {
        "campaign": campaign,
        "response_count": response_count,
        "stakeholder_count": stakeholder_count,
        "completion_rate": round(response_count / eligible_count * 100, 1) if eligible_count else 0,
        "topics": topics,
        "stakeholders": stakeholders,
        "keywords": keywords,
        "analysis_zh": analysis_zh,
        "analysis_en": analysis_en,
    }

