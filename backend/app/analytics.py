from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .ai_analysis import analysis_content, fallback_ai_sections, latest_ai_analysis
from .models import (
    ConcernSurveyResponse,
    ConcernSurveyScore,
    ExpertAssessmentResponse,
    ExpertAssessmentScore,
    InvitationCode,
    MaterialTopicOverride,
    StakeholderGroup,
    SurveyCampaign,
    Topic,
    User,
)


KEYWORD_MAP = {
    "能源管理": ("能源", "節能", "用電", "再生能源"),
    "溫室氣體": ("碳", "溫室氣體", "盤查", "減碳"),
    "資訊安全": ("資安", "個資", "隱私", "資料"),
    "人才培育": ("人才", "課程", "學生", "教學"),
    "社區參與": ("社區", "地方", "USR", "參與"),
}

QUADRANTS = {
    "core": "核心重大主題",
    "impact": "衝擊重大主題",
    "financial": "財務重大主題",
    "watch": "持續觀察議題",
    "pending": "尚無資料",
}


def average(values: list[float | int | None]) -> float:
    known = [float(value) for value in values if value is not None]
    return round(sum(known) / len(known), 2) if known else 0.0


def quadrant(impact: float, financial: float, threshold: float, has_data: bool = True) -> str:
    if not has_data:
        return QUADRANTS["pending"]
    high_impact = impact >= threshold
    high_financial = financial >= threshold
    if high_impact and high_financial:
        return QUADRANTS["core"]
    if high_impact:
        return QUADRANTS["impact"]
    if high_financial:
        return QUADRANTS["financial"]
    return QUADRANTS["watch"]


def extract_keywords(answers: list[str]) -> list[dict]:
    counts = Counter()
    text = "\n".join(answers).lower()
    for label, aliases in KEYWORD_MAP.items():
        counts[label] = sum(text.count(alias.lower()) for alias in aliases)
    return [{"keyword": keyword, "count": count} for keyword, count in counts.most_common() if count > 0][:8]


def campaign_by_type(db: Session, year: int, survey_type: str) -> SurveyCampaign | None:
    return db.scalar(
        select(SurveyCampaign)
        .where(SurveyCampaign.year == year, SurveyCampaign.survey_type == survey_type, SurveyCampaign.is_active.is_(True))
        .order_by(SurveyCampaign.status.desc(), SurveyCampaign.id.desc())
    )


def resolve_campaigns(db: Session, campaign: SurveyCampaign) -> tuple[SurveyCampaign | None, SurveyCampaign | None, SurveyCampaign]:
    concern = campaign if campaign.survey_type == "concern" else campaign_by_type(db, campaign.year, "concern")
    expert = campaign if campaign.survey_type == "expert_materiality" else campaign_by_type(db, campaign.year, "expert_materiality")
    primary = expert or concern or campaign
    return concern, expert, primary


def concern_response_count(db: Session, campaign: SurveyCampaign | None) -> int:
    if not campaign:
        return 0
    return db.scalar(select(func.count(ConcernSurveyResponse.id)).where(ConcernSurveyResponse.campaign_id == campaign.id)) or 0


def expert_response_count(db: Session, campaign: SurveyCampaign | None) -> int:
    if not campaign:
        return 0
    return db.scalar(select(func.count(ExpertAssessmentResponse.id)).where(ExpertAssessmentResponse.campaign_id == campaign.id)) or 0


def eligible_user_count(db: Session, campaign: SurveyCampaign | None) -> int:
    if not campaign or campaign.require_invitation_code:
        return 0
    return db.scalar(select(func.count(User.id)).where(User.is_active.is_(True), User.role == "respondent")) or 0


def invitation_counts(db: Session, campaign: SurveyCampaign | None) -> dict[str, int]:
    if not campaign:
        return {"issued": 0, "used": 0}
    issued = db.scalar(
        select(func.count(InvitationCode.id)).where(
            InvitationCode.campaign_id == campaign.id,
            InvitationCode.is_active.is_(True),
            InvitationCode.revoked_at.is_(None),
        )
    ) or 0
    used = db.scalar(
        select(func.coalesce(func.sum(InvitationCode.used_count), 0)).where(
            InvitationCode.campaign_id == campaign.id,
            InvitationCode.is_active.is_(True),
            InvitationCode.revoked_at.is_(None),
        )
    ) or 0
    return {"issued": int(issued), "used": int(used)}


def concern_by_topic(db: Session, campaign: SurveyCampaign | None) -> dict[int, dict]:
    if not campaign:
        return {}
    rows = db.execute(
        select(
            ConcernSurveyScore.topic_id,
            func.avg(ConcernSurveyScore.concern_score),
            func.count(ConcernSurveyScore.id),
        )
        .join(ConcernSurveyResponse, ConcernSurveyResponse.id == ConcernSurveyScore.response_id)
        .where(ConcernSurveyResponse.campaign_id == campaign.id)
        .group_by(ConcernSurveyScore.topic_id)
    ).all()
    return {topic_id: {"concern_score": round(float(score or 0), 2), "count": count} for topic_id, score, count in rows}


def expert_scores_by_topic(db: Session, campaign: SurveyCampaign | None) -> dict[int, dict]:
    if not campaign:
        return {}
    rows = db.execute(
        select(ExpertAssessmentScore, ExpertAssessmentResponse.stakeholder_group_id, StakeholderGroup.weight)
        .join(ExpertAssessmentResponse, ExpertAssessmentResponse.id == ExpertAssessmentScore.response_id)
        .join(StakeholderGroup, StakeholderGroup.id == ExpertAssessmentResponse.stakeholder_group_id)
        .where(ExpertAssessmentResponse.campaign_id == campaign.id)
    ).all()
    buckets: dict[int, dict] = {}
    for score, _group_id, weight in rows:
        bucket = buckets.setdefault(
            score.topic_id,
            {
                "impact_values": [],
                "financial_values": [],
                "weighted_impact_sum": 0.0,
                "weighted_financial_sum": 0.0,
                "weight_sum": 0.0,
                "unknown_count": 0,
                "field_count": 0,
                "count": 0,
            },
        )
        impact = score.impact_score or 0
        financial = score.financial_score or 0
        bucket["impact_values"].append(impact)
        bucket["financial_values"].append(financial)
        bucket["weighted_impact_sum"] += impact * float(weight or 1)
        bucket["weighted_financial_sum"] += financial * float(weight or 1)
        bucket["weight_sum"] += float(weight or 1)
        fields = [
            score.positive_likelihood_score if score.positive_likelihood_score is not None else score.impact_likelihood_score,
            score.positive_impact_magnitude_score if score.positive_impact_magnitude_score is not None else score.positive_impact_score,
            score.negative_likelihood_score if score.negative_likelihood_score is not None else score.impact_likelihood_score,
            score.negative_impact_magnitude_score if score.negative_impact_magnitude_score is not None else score.negative_impact_score,
            score.enrollment_revenue_score if score.enrollment_revenue_score is not None else score.admissions_revenue_score,
            score.reputation_score,
            score.operating_cost_score,
            score.funding_score,
            score.legal_responsibility_score if score.legal_responsibility_score is not None else score.legal_liability_score,
            score.financial_likelihood_score,
        ]
        bucket["unknown_count"] += len([value for value in fields if value is None])
        bucket["field_count"] += len(fields)
        bucket["count"] += 1
    result = {}
    for topic_id, bucket in buckets.items():
        weight_sum = bucket["weight_sum"] or 1
        result[topic_id] = {
            "impact": average(bucket["impact_values"]),
            "financial": average(bucket["financial_values"]),
            "weighted_impact": round(bucket["weighted_impact_sum"] / weight_sum, 2),
            "weighted_financial": round(bucket["weighted_financial_sum"] / weight_sum, 2),
            "unknown_ratio": round(bucket["unknown_count"] / bucket["field_count"] * 100, 1) if bucket["field_count"] else 0.0,
            "count": bucket["count"],
        }
    return result


def stakeholder_metrics(db: Session, campaign: SurveyCampaign | None) -> list[dict]:
    counts: dict[int, int] = {}
    if campaign:
        rows = db.execute(
            select(ConcernSurveyResponse.stakeholder_group_id, func.count(ConcernSurveyResponse.id))
            .where(ConcernSurveyResponse.campaign_id == campaign.id)
            .group_by(ConcernSurveyResponse.stakeholder_group_id)
        ).all()
        counts = {group_id: count for group_id, count in rows}
    groups = db.execute(
        select(StakeholderGroup.id, StakeholderGroup.name, StakeholderGroup.weight)
        .where(StakeholderGroup.is_active.is_(True))
        .order_by(StakeholderGroup.sort_order, StakeholderGroup.name)
    ).all()
    return [{"id": group_id, "name": name, "weight": float(weight), "count": counts.get(group_id, 0)} for group_id, name, weight in groups]


def evaluator_role_metrics(db: Session, campaign: SurveyCampaign | None) -> list[dict]:
    if not campaign:
        return []
    rows = db.execute(
        select(func.coalesce(InvitationCode.evaluator_role, "未分類"), func.count(ExpertAssessmentResponse.id))
        .join(ExpertAssessmentResponse, ExpertAssessmentResponse.invitation_code_id == InvitationCode.id)
        .where(ExpertAssessmentResponse.campaign_id == campaign.id)
        .group_by(func.coalesce(InvitationCode.evaluator_role, "未分類"))
        .order_by(func.count(ExpertAssessmentResponse.id).desc())
    ).all()
    return [{"evaluator_role": role, "count": count} for role, count in rows]


def stakeholder_topic_rows(db: Session, campaign: SurveyCampaign | None) -> list[dict]:
    if not campaign:
        return []
    rows = db.execute(
        select(
            StakeholderGroup.id,
            StakeholderGroup.name,
            Topic.id,
            Topic.code,
            func.avg(ExpertAssessmentScore.impact_score),
            func.avg(ExpertAssessmentScore.financial_score),
            func.count(ExpertAssessmentScore.id),
        )
        .join(ExpertAssessmentResponse, ExpertAssessmentResponse.stakeholder_group_id == StakeholderGroup.id)
        .join(ExpertAssessmentScore, ExpertAssessmentScore.response_id == ExpertAssessmentResponse.id)
        .join(Topic, Topic.id == ExpertAssessmentScore.topic_id)
        .where(ExpertAssessmentResponse.campaign_id == campaign.id)
        .group_by(StakeholderGroup.id, Topic.id)
        .order_by(StakeholderGroup.sort_order, Topic.sort_order)
    ).all()
    return [
        {
            "stakeholder_group_id": group_id,
            "stakeholder_group_name": group_name,
            "topic_id": topic_id,
            "code": code,
            "impact": round(float(impact or 0), 2),
            "financial": round(float(financial or 0), 2),
            "response_count": count,
        }
        for group_id, group_name, topic_id, code, impact, financial, count in rows
    ]


def open_answers(db: Session, concern: SurveyCampaign | None, expert: SurveyCampaign | None) -> list[str]:
    values: list[str] = []
    if concern:
        values.extend(
            db.scalars(
                select(ConcernSurveyResponse.open_answer).where(
                    ConcernSurveyResponse.campaign_id == concern.id,
                    ConcernSurveyResponse.open_answer.is_not(None),
                )
            ).all()
        )
    if expert:
        values.extend(
            db.scalars(
                select(ExpertAssessmentResponse.open_answer).where(
                    ExpertAssessmentResponse.campaign_id == expert.id,
                    ExpertAssessmentResponse.open_answer.is_not(None),
                )
            ).all()
        )
    return [value for value in values if value]


def override_by_topic(db: Session, campaign: SurveyCampaign | None) -> dict[int, MaterialTopicOverride]:
    if not campaign:
        return {}
    rows = db.scalars(select(MaterialTopicOverride).where(MaterialTopicOverride.campaign_id == campaign.id)).all()
    return {row.topic_id: row for row in rows}


def build_analytics(db: Session, campaign: SurveyCampaign) -> dict:
    concern_campaign, expert_campaign, primary_campaign = resolve_campaigns(db, campaign)
    threshold = primary_campaign.materiality_threshold or 3.5
    concern_count = concern_response_count(db, concern_campaign)
    expert_count = expert_response_count(db, expert_campaign)
    concern_invitations = invitation_counts(db, concern_campaign)
    expert_invitations = invitation_counts(db, expert_campaign)
    issued_invitation_count = concern_invitations["issued"] + expert_invitations["issued"]
    used_invitation_count = concern_invitations["used"] + expert_invitations["used"]
    eligible_users = eligible_user_count(db, concern_campaign) + eligible_user_count(db, expert_campaign)
    concern_topics = concern_by_topic(db, concern_campaign)
    expert_topics = expert_scores_by_topic(db, expert_campaign)
    overrides = override_by_topic(db, expert_campaign or primary_campaign)

    topic_rows = db.scalars(select(Topic).where(Topic.is_active.is_(True)).order_by(Topic.sort_order, Topic.id)).all()
    topics = []
    unknown_fields = 0.0
    unknown_weight = 0
    for topic in topic_rows:
        concern = concern_topics.get(topic.id, {"concern_score": 0.0, "count": 0})
        expert = expert_topics.get(topic.id, {})
        impact = float(expert.get("impact", 0.0))
        financial = float(expert.get("financial", 0.0))
        response_count = int(expert.get("count", 0))
        computed_material = bool(impact >= threshold or financial >= threshold)
        override = overrides.get(topic.id)
        is_final = override.is_material if override else computed_material
        reason = override.reason if override else ("達到衝擊或財務重大性門檻" if computed_material else None)
        unknown_ratio = float(expert.get("unknown_ratio", 0.0))
        unknown_fields += unknown_ratio * response_count
        unknown_weight += response_count
        topics.append(
            {
                "topic_id": topic.id,
                "code": topic.topic_code or topic.code,
                "name": topic.name_zh,
                "category": topic.category,
                "organization": 0.0,
                "impact": impact,
                "financial": financial,
                "weighted_impact": float(expert.get("weighted_impact", impact)),
                "weighted_financial": float(expert.get("weighted_financial", financial)),
                "concern_score": float(concern["concern_score"]),
                "concern_response_count": int(concern["count"]),
                "impact_materiality_score": impact,
                "financial_materiality_score": financial,
                "unknown_ratio": unknown_ratio,
                "is_final_material_topic": is_final,
                "final_topic_reason": reason,
                "manually_adjusted": override is not None,
                "response_count": response_count,
                "quadrant": quadrant(impact, financial, threshold, response_count > 0),
            }
        )

    final_topics = sorted(
        [topic for topic in topics if topic["is_final_material_topic"]],
        key=lambda item: (item["impact_materiality_score"] + item["financial_materiality_score"], item["concern_score"]),
        reverse=True,
    )
    total_count = concern_count + expert_count
    denominator = eligible_users + issued_invitation_count
    completion_rate = round(total_count / denominator * 100, 1) if denominator else 0.0
    stakeholder_items = stakeholder_metrics(db, concern_campaign)
    data = {
        "campaign": primary_campaign,
        "concern_campaign": concern_campaign,
        "expert_campaign": expert_campaign,
        "response_count": total_count,
        "concern_response_count": concern_count,
        "expert_response_count": expert_count,
        "issued_invitation_count": issued_invitation_count,
        "used_invitation_count": used_invitation_count,
        "stakeholder_count": len([item for item in stakeholder_items if item["count"] > 0]),
        "completion_rate": completion_rate,
        "topics": topics,
        "stakeholders": stakeholder_items,
        "evaluator_roles": evaluator_role_metrics(db, expert_campaign),
        "final_material_topics": final_topics,
        "unknown_ratio": round(unknown_fields / unknown_weight, 1) if unknown_weight else 0.0,
        "threshold": threshold,
        "stakeholder_topics": stakeholder_topic_rows(db, expert_campaign),
        "keywords": extract_keywords(open_answers(db, concern_campaign, expert_campaign)),
    }
    fallback = fallback_ai_sections(data)
    ai_version = latest_ai_analysis(db, primary_campaign.id)
    ai = analysis_content(ai_version, fallback)
    data["ai_analysis"] = ai
    data["analysis_zh"] = ai["zh_summary"]
    data["analysis_en"] = ai["en_summary"]
    return data
