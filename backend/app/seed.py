from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import InvitationCode, StakeholderGroup, SurveyCampaign, Topic, User
from .security import hash_password


GROUPS = [
    ("教師", "internal", 1.2),
    ("職員", "internal", 1.1),
    ("學生", "internal", 1.0),
    ("校友", "external", 0.9),
    ("政府機關", "external", 1.2),
    ("企業", "external", 1.0),
    ("廠商", "external", 0.9),
    ("社區居民", "external", 1.0),
    ("NGO", "external", 1.1),
]

TOPICS = [
    ("E01", "E", "能源管理", "Energy Management", "校園能源使用、節能改善與再生能源規劃。", 1),
    ("E02", "E", "溫室氣體排放", "Greenhouse Gas Emissions", "溫室氣體盤查、減量目標與碳管理。", 2),
    ("E03", "E", "水資源管理", "Water Resources", "用水效率、回收水與校園水風險管理。", 3),
    ("E04", "E", "廢棄物管理", "Waste Management", "廢棄物減量、分類、回收與合規處理。", 4),
    ("S01", "S", "職業安全衛生", "Occupational Safety", "教職員工與承攬商安全衛生管理。", 5),
    ("S02", "S", "人才培育與發展", "Talent Development", "教學品質、學生能力培育與員工發展。", 6),
    ("S03", "S", "多元共融與平等", "Diversity, Equity and Inclusion", "平等機會、反歧視與友善校園。", 7),
    ("S04", "S", "社區參與", "Community Engagement", "大學社會責任、在地連結與公益參與。", 8),
    ("G01", "G", "資訊安全與隱私", "Information Security and Privacy", "個資保護、資安治理與事件應變。", 9),
    ("G02", "G", "法規遵循", "Compliance", "教育、勞動、環境與採購等法規遵循。", 10),
    ("G03", "G", "誠信治理與倫理", "Integrity and Ethics", "治理透明、利益衝突管理與研究倫理。", 11),
]


def seed_database(db: Session) -> None:
    settings = get_settings()
    if not db.scalar(select(StakeholderGroup.id).limit(1)):
        db.add_all(
            [StakeholderGroup(name=name, scope=scope, weight=weight) for name, scope, weight in GROUPS]
        )
        db.flush()

    if not db.scalar(select(Topic.id).limit(1)):
        db.add_all(
            [
                Topic(
                    code=code,
                    category=category,
                    name_zh=name_zh,
                    name_en=name_en,
                    description=description,
                    sort_order=sort_order,
                )
                for code, category, name_zh, name_en, description, sort_order in TOPICS
            ]
        )

    if not db.scalar(select(SurveyCampaign.id).limit(1)):
        db.add(SurveyCampaign(title="2026 大學永續報告書重大性問卷", year=2026, status="active"))
        db.flush()

    teacher_group = db.scalar(select(StakeholderGroup).where(StakeholderGroup.name == "教師"))
    student_group = db.scalar(select(StakeholderGroup).where(StakeholderGroup.name == "學生"))
    campaign = db.scalar(select(SurveyCampaign).order_by(SurveyCampaign.year.desc()))

    if settings.bootstrap_admin_email and settings.bootstrap_admin_password and teacher_group:
        exists = db.scalar(select(User).where(User.email == settings.bootstrap_admin_email))
        if not exists:
            db.add(
                User(
                    email=settings.bootstrap_admin_email,
                    name="系統管理者",
                    password_hash=hash_password(settings.bootstrap_admin_password),
                    role="admin",
                    stakeholder_group_id=teacher_group.id,
                )
            )

    if settings.seed_demo_accounts and teacher_group and student_group:
        if not db.scalar(select(User).where(User.email == "admin@nuk.edu.tw")):
            db.add(
                User(
                    email="admin@nuk.edu.tw",
                    name="示範管理者",
                    password_hash=hash_password("admin123"),
                    role="admin",
                    stakeholder_group_id=teacher_group.id,
                )
            )
        if not db.scalar(select(User).where(User.email == "student@nuk.edu.tw")):
            db.add(
                User(
                    email="student@nuk.edu.tw",
                    name="示範填答者",
                    password_hash=hash_password("survey123"),
                    role="respondent",
                    stakeholder_group_id=student_group.id,
                )
            )
        if campaign and not db.scalar(select(InvitationCode).where(InvitationCode.code == "DEMO-STUDENT")):
            db.add(
                InvitationCode(
                    campaign_id=campaign.id,
                    code="DEMO-STUDENT",
                    stakeholder_group_id=student_group.id,
                    label="Demo anonymous student invitation",
                )
            )
    db.commit()
