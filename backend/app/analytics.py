from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .ai_analysis import analysis_content, fallback_ai_sections, latest_ai_analysis
from .models import StakeholderGroup, SurveyCampaign, SurveyResponse, Topic, TopicScore, User


KEYWORD_MAP = {
    "能源": ("能源", "用電", "節能", "再生能源"),
    "溫室氣體": ("溫室氣體", "碳", "減碳", "排放"),
    "資訊安全": ("資訊安全", "資安", "個資", "隱私"),
    "人才培育": ("人才培育", "課程", "教學", "學生"),
    "社區參與": ("社區參與", "社區", "USR", "地方"),
}

QUADRANTS = {
    "major": "重大主題",
    "disclosure": "揭露主題",
    "risk": "風險主題",
    "watch": "觀察主題",
    "pending": "尚無資料",
}


def quadrant(impact: float, financial: float, campaign: SurveyCampaign) -> str:
    high_impact = impact >= campaign.impact_threshold
    high_financial = financial >= campaign.financial_threshold
    if high_impact and high_financial:
        return QUADRANTS["major"]
    if high_impact:
        return QUADRANTS["disclosure"]
    if high_financial:
        return QUADRANTS["risk"]
    return QUADRANTS["watch"]


def extract_keywords(answers: list[str]) -> list[dict]:
    counts = Counter()
    text = "\n".join(answers)
    for label, aliases in KEYWORD_MAP.items():
        counts[label] = sum(text.lower().count(alias.lower()) for alias in aliases)
    return [{"keyword": keyword, "count": count} for keyword, count in counts.most_common() if count > 0][:8]


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

    weighted_rows = db.execute(
        select(
            TopicScore.topic_id,
            func.sum(TopicScore.impact_score * StakeholderGroup.weight),
            func.sum(TopicScore.financial_score * StakeholderGroup.weight),
            func.sum(StakeholderGroup.weight),
        )
        .join(SurveyResponse, SurveyResponse.id == TopicScore.response_id)
        .join(StakeholderGroup, StakeholderGroup.id == SurveyResponse.stakeholder_group_id)
        .where(SurveyResponse.campaign_id == campaign.id)
        .group_by(TopicScore.topic_id)
    ).all()
    weighted_by_topic = {
        topic_id: (
            round(float(weighted_impact or 0) / float(weight_sum or 1), 2),
            round(float(weighted_financial or 0) / float(weight_sum or 1), 2),
        )
        for topic_id, weighted_impact, weighted_financial, weight_sum in weighted_rows
    }

    topics = []
    for topic_id, code, name, category, organization, impact, financial, count in rows:
        organization_value = round(float(organization or 0), 2)
        impact_value = round(float(impact or 0), 2)
        financial_value = round(float(financial or 0), 2)
        weighted_impact, weighted_financial = weighted_by_topic.get(topic_id, (0.0, 0.0))
        topics.append(
            {
                "topic_id": topic_id,
                "code": code,
                "name": name,
                "category": category,
                "organization": organization_value,
                "impact": impact_value,
                "financial": financial_value,
                "weighted_impact": weighted_impact,
                "weighted_financial": weighted_financial,
                "response_count": count,
                "quadrant": quadrant(impact_value, financial_value, campaign) if count else QUADRANTS["pending"],
            }
        )

    count_rows = db.execute(
        select(SurveyResponse.stakeholder_group_id, func.count(SurveyResponse.id))
        .where(SurveyResponse.campaign_id == campaign.id)
        .group_by(SurveyResponse.stakeholder_group_id)
    ).all()
    response_counts = {group_id: count for group_id, count in count_rows}
    stakeholder_rows = db.execute(
        select(StakeholderGroup.id, StakeholderGroup.name, StakeholderGroup.weight)
        .where(StakeholderGroup.is_active.is_(True))
        .order_by(StakeholderGroup.scope, StakeholderGroup.name)
    ).all()
    stakeholders = [
        {"id": group_id, "name": name, "weight": float(weight), "count": response_counts.get(group_id, 0)}
        for group_id, name, weight in stakeholder_rows
    ]

    stakeholder_topic_rows = db.execute(
        select(
            StakeholderGroup.id,
            StakeholderGroup.name,
            Topic.id,
            Topic.code,
            func.avg(TopicScore.impact_score),
            func.avg(TopicScore.financial_score),
            func.count(TopicScore.id),
        )
        .join(SurveyResponse, SurveyResponse.stakeholder_group_id == StakeholderGroup.id)
        .join(TopicScore, TopicScore.response_id == SurveyResponse.id)
        .join(Topic, Topic.id == TopicScore.topic_id)
        .where(SurveyResponse.campaign_id == campaign.id)
        .group_by(StakeholderGroup.id, Topic.id)
        .order_by(StakeholderGroup.name, Topic.sort_order)
    ).all()
    stakeholder_topics = [
        {
            "stakeholder_group_id": group_id,
            "stakeholder_group_name": group_name,
            "topic_id": topic_id,
            "code": code,
            "impact": round(float(impact or 0), 2),
            "financial": round(float(financial or 0), 2),
            "response_count": count,
        }
        for group_id, group_name, topic_id, code, impact, financial, count in stakeholder_topic_rows
    ]

    answers = db.scalars(
        select(SurveyResponse.open_answer).where(
            SurveyResponse.campaign_id == campaign.id,
            SurveyResponse.open_answer.is_not(None),
        )
    ).all()
    keywords = extract_keywords([answer for answer in answers if answer])
    stakeholder_count = len([item for item in stakeholders if item["count"] > 0])

    data = {
        "campaign": campaign,
        "response_count": response_count,
        "stakeholder_count": stakeholder_count,
        "completion_rate": round(response_count / eligible_count * 100, 1) if eligible_count else 0,
        "topics": topics,
        "stakeholders": stakeholders,
        "stakeholder_topics": stakeholder_topics,
        "keywords": keywords,
    }
    fallback = fallback_ai_sections(data)
    ai_version = latest_ai_analysis(db, campaign.id)
    ai = analysis_content(ai_version, fallback)
    data["ai_analysis"] = ai
    data["analysis_zh"] = ai["zh_summary"]
    data["analysis_en"] = ai["en_summary"]
    return data
