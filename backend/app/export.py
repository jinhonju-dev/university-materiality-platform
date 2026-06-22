import csv
from io import BytesIO, StringIO

from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.orm import Session

from .analytics import build_analytics
from .models import StakeholderGroup, SurveyCampaign, SurveyResponse, Topic, TopicScore, User


RAW_HEADERS = [
    "response_id",
    "submitted_at",
    "respondent_email",
    "respondent_name",
    "invitation_code_id",
    "stakeholder_group",
    "stakeholder_weight",
    "topic_code",
    "topic_name_zh",
    "category",
    "organization_score",
    "actual_or_potential",
    "positive_or_negative",
    "scale_score",
    "scope_score",
    "remediability_score",
    "impact_likelihood_score",
    "impact_score",
    "risk_or_opportunity",
    "time_horizon",
    "financial_magnitude_score",
    "operational_resilience_score",
    "financial_likelihood_score",
    "financial_score",
    "open_answer",
]


def raw_rows(db: Session, campaign: SurveyCampaign, anonymized: bool) -> list[list]:
    rows = db.execute(
        select(SurveyResponse, TopicScore, Topic, StakeholderGroup, User)
        .join(TopicScore, TopicScore.response_id == SurveyResponse.id)
        .join(Topic, Topic.id == TopicScore.topic_id)
        .join(StakeholderGroup, StakeholderGroup.id == SurveyResponse.stakeholder_group_id)
        .outerjoin(User, User.id == SurveyResponse.respondent_id)
        .where(SurveyResponse.campaign_id == campaign.id)
        .order_by(SurveyResponse.id, Topic.sort_order)
    ).all()
    output = []
    for response, score, topic, group, user in rows:
        output.append(
            [
                response.id,
                response.submitted_at.isoformat(),
                "" if anonymized else (user.email if user else ""),
                "" if anonymized else (user.name if user else ""),
                response.invitation_code_id or "",
                group.name,
                group.weight,
                topic.code,
                topic.name_zh,
                topic.category,
                score.organization_score,
                score.actual_or_potential,
                score.positive_or_negative,
                score.scale_score,
                score.scope_score,
                score.remediability_score or "",
                score.impact_likelihood_score,
                score.impact_score,
                score.risk_or_opportunity,
                score.time_horizon,
                score.financial_magnitude_score,
                score.operational_resilience_score,
                score.financial_likelihood_score,
                score.financial_score,
                response.open_answer or "",
            ]
        )
    return output


def create_csv_export(db: Session, campaign: SurveyCampaign, anonymized: bool = False) -> BytesIO:
    text = StringIO()
    writer = csv.writer(text)
    writer.writerow(RAW_HEADERS)
    writer.writerows(raw_rows(db, campaign, anonymized))
    output = BytesIO()
    output.write(text.getvalue().encode("utf-8-sig"))
    output.seek(0)
    return output


def append_sheet(workbook: Workbook, title: str, headers: list[str], rows: list[list]) -> None:
    sheet = workbook.create_sheet(title=title)
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    for column in sheet.columns:
        length = max(len(str(cell.value or "")) for cell in column)
        sheet.column_dimensions[column[0].column_letter].width = min(max(length + 2, 12), 42)


def create_excel_export(db: Session, campaign: SurveyCampaign) -> BytesIO:
    analytics = build_analytics(db, campaign)
    workbook = Workbook()
    workbook.remove(workbook.active)

    append_sheet(workbook, "原始填答資料", RAW_HEADERS, raw_rows(db, campaign, anonymized=False))
    append_sheet(workbook, "去識別化資料", RAW_HEADERS, raw_rows(db, campaign, anonymized=True))
    append_sheet(
        workbook,
        "各議題平均",
        ["code", "name", "category", "organization", "impact", "financial", "weighted_impact", "weighted_financial", "response_count", "quadrant"],
        [
            [
                item["code"],
                item["name"],
                item["category"],
                item["organization"],
                item["impact"],
                item["financial"],
                item["weighted_impact"],
                item["weighted_financial"],
                item["response_count"],
                item["quadrant"],
            ]
            for item in analytics["topics"]
        ],
    )
    append_sheet(
        workbook,
        "各利害關係人分群平均",
        ["stakeholder_group", "topic_code", "impact", "financial", "response_count"],
        [
            [
                item["stakeholder_group_name"],
                item["code"],
                item["impact"],
                item["financial"],
                item["response_count"],
            ]
            for item in analytics["stakeholder_topics"]
        ],
    )
    append_sheet(
        workbook,
        "加權後結果",
        ["code", "name", "weighted_impact", "weighted_financial", "quadrant"],
        [
            [item["code"], item["name"], item["weighted_impact"], item["weighted_financial"], item["quadrant"]]
            for item in analytics["topics"]
        ],
    )
    append_sheet(
        workbook,
        "重大主題排序",
        ["rank", "code", "name", "score", "quadrant"],
        [
            [index + 1, item["code"], item["name"], round((item["impact"] + item["financial"]) / 2, 2), item["quadrant"]]
            for index, item in enumerate(
                sorted(analytics["topics"], key=lambda row: row["impact"] + row["financial"], reverse=True)
            )
        ],
    )
    append_sheet(
        workbook,
        "開放題關鍵字統計",
        ["keyword", "count"],
        [[item["keyword"], item["count"]] for item in analytics["keywords"]],
    )
    append_sheet(
        workbook,
        "樣本數與權重",
        ["stakeholder_group", "sample_count", "weight"],
        [[item["name"], item["count"], item["weight"]] for item in analytics["stakeholders"]],
    )

    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return output
