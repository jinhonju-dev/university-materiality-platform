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
    ("E01", "E", "能源管理", "Energy Management", "校園能源使用、節能措施、再生能源採購與用電效率管理。", 1),
    ("E02", "E", "溫室氣體排放", "Greenhouse Gas Emissions", "溫室氣體盤查、減碳目標、排放管理與氣候行動。", 2),
    ("E03", "E", "水資源", "Water Resources", "用水效率、水回收、節水措施與水資源風險管理。", 3),
    ("E04", "E", "廢棄物管理", "Waste Management", "廢棄物減量、分類回收、有害廢棄物與循環利用。", 4),
    ("S01", "S", "職業安全衛生", "Occupational Safety", "教職員工與學生之校園安全、實驗安全及健康促進。", 5),
    ("S02", "S", "人才培育與學習發展", "Talent Development", "學生學習、教師專業發展、跨域能力與永續教育。", 6),
    ("S03", "S", "多元共融", "Diversity, Equity and Inclusion", "性別平等、友善校園、多元文化與弱勢支持。", 7),
    ("S04", "S", "社區參與", "Community Engagement", "大學社會責任、地方連結、社區共創與公共參與。", 8),
    ("G01", "G", "資訊安全與隱私", "Information Security and Privacy", "資安治理、個資保護、系統韌性與資料安全。", 9),
    ("G02", "G", "法遵", "Compliance", "法規遵循、內部控制、採購與校務治理之合規管理。", 10),
    ("G03", "G", "誠信經營與倫理", "Integrity and Ethics", "誠信治理、研究倫理、利益衝突管理與申訴機制。", 11),
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
        db.add(SurveyCampaign(title="2026 大學永續報告書利害關係人問卷", year=2026, status="active"))
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
