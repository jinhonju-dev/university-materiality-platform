from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import InvitationCode, StakeholderGroup, SurveyCampaign, Topic, User
from .security import hash_invitation_code, hash_password


GROUPS = [
    ("student", "學生", "internal", 1.0),
    ("teacher", "教師", "internal", 1.2),
    ("staff", "職員", "internal", 1.1),
    ("alumni", "校友", "external", 0.9),
    ("government", "政府機關", "external", 1.1),
    ("enterprise_vendor", "企業／廠商", "external", 1.0),
    ("community", "社區居民", "external", 0.9),
    ("ngo_association", "NGO／社團", "external", 1.0),
    ("other", "其他", "external", 1.0),
    ("senior_manager", "一級主管", "internal", 1.3),
    ("middle_manager", "二級主管", "internal", 1.2),
    ("academic_manager", "學術單位主管", "internal", 1.2),
    ("sustainability_staff", "專責人員", "internal", 1.2),
]


TOPICS = [
    ("E01", "E", "能源管理", "Energy Management", "提升能源效率、再生能源使用與校園節能治理。", "GRI 302", "SDG 7, SDG 13"),
    ("E02", "E", "溫室氣體排放", "Greenhouse Gas Emissions", "盤查與管理範疇一、二及重要範疇三排放。", "GRI 305", "SDG 13"),
    ("E03", "E", "水資源", "Water Resources", "校園用水效率、水風險與回收再利用管理。", "GRI 303", "SDG 6"),
    ("E04", "E", "廢棄物管理", "Waste Management", "減量、分類、回收及有害廢棄物合規處理。", "GRI 306", "SDG 12"),
    ("S01", "S", "職業安全", "Occupational Safety", "教職員工與學生於校園活動中的安全與健康。", "GRI 403", "SDG 3, SDG 8"),
    ("S02", "S", "人才培育", "Talent Development", "教學品質、跨域能力與終身學習支持。", "GRI 404", "SDG 4"),
    ("S03", "S", "多元共融", "Diversity, Equity and Inclusion", "公平、包容、無歧視的學習與工作環境。", "GRI 405, GRI 406", "SDG 5, SDG 10"),
    ("S04", "S", "社區參與", "Community Engagement", "大學社會責任、地方共創與社區溝通。", "GRI 413", "SDG 11, SDG 17"),
    ("G01", "G", "資訊安全", "Information Security and Privacy", "資通安全、個資保護與資料治理。", "GRI 418", "SDG 16"),
    ("G02", "G", "法遵", "Compliance", "遵循教育、勞動、環境、採購與個資等法規。", "GRI 2-27", "SDG 16"),
    ("G03", "G", "誠信經營", "Integrity and Ethics", "採購倫理、利益衝突迴避與治理透明度。", "GRI 205", "SDG 16"),
]


PRIVACY_NOTICE = (
    "本問卷用於大學永續報告書之利害關係人溝通與重大主題鑑別。"
    "資料將以彙整方式分析，正式匯出可提供去識別化版本；請勿於開放意見填入姓名、身分證字號、電話等個人資料。"
)


def seed_database(db: Session) -> None:
    settings = get_settings()
    if not db.scalar(select(StakeholderGroup.id).limit(1)):
        db.add_all(
            [
                StakeholderGroup(
                    code=code,
                    name=name,
                    scope=scope,
                    weight=weight,
                    sort_order=index + 1,
                )
                for index, (code, name, scope, weight) in enumerate(GROUPS)
            ]
        )
        db.flush()

    if not db.scalar(select(Topic.id).limit(1)):
        db.add_all(
            [
                Topic(
                    code=code,
                    topic_code=code,
                    category=category,
                    name_zh=name_zh,
                    name_en=name_en,
                    description=description,
                    scenario_description=f"未來3至5年內，{name_zh}對學校永續績效、營運韌性與利害關係人信任的可能影響。",
                    gri_mapping=gri,
                    sdgs_mapping=sdgs,
                    sort_order=index + 1,
                )
                for index, (code, category, name_zh, name_en, description, gri, sdgs) in enumerate(TOPICS)
            ]
        )

    if not db.scalar(select(SurveyCampaign.id).limit(1)):
        db.add_all(
            [
                SurveyCampaign(
                    title="2026 大學永續關注度調查",
                    name="2026 大學永續關注度調查",
                    year=2026,
                    status="active",
                    survey_type="concern",
                    is_open=True,
                    is_active=True,
                    allow_public_response=True,
                    require_invitation_code=False,
                    materiality_threshold=3.5,
                    description="所有利害關係人皆可填答之關注度調查。",
                    privacy_notice=PRIVACY_NOTICE,
                ),
                SurveyCampaign(
                    title="2026 專家雙重重大性評估",
                    name="2026 專家雙重重大性評估",
                    year=2026,
                    status="active",
                    survey_type="expert_materiality",
                    is_open=True,
                    is_active=True,
                    allow_public_response=False,
                    require_invitation_code=True,
                    materiality_threshold=3.5,
                    description="提供主管與專家使用邀請碼填答之雙重重大性評估。",
                    privacy_notice=PRIVACY_NOTICE,
                ),
            ]
        )
        db.flush()

    teacher_group = db.scalar(select(StakeholderGroup).where(StakeholderGroup.code == "teacher"))
    expert_group = db.scalar(select(StakeholderGroup).where(StakeholderGroup.code == "senior_manager"))
    expert_campaign = db.scalar(select(SurveyCampaign).where(SurveyCampaign.survey_type == "expert_materiality"))

    if settings.bootstrap_admin_email and settings.bootstrap_admin_password and teacher_group:
        exists = db.scalar(select(User).where(User.email == settings.bootstrap_admin_email))
        if not exists:
            db.add(
                User(
                    email=settings.bootstrap_admin_email,
                    name="系統超級管理者",
                    password_hash=hash_password(settings.bootstrap_admin_password),
                    role="super_admin",
                    stakeholder_group_id=teacher_group.id,
                    force_password_change=True,
                )
            )

    if settings.app_mode == "demo" and settings.seed_demo_accounts and teacher_group:
        if not db.scalar(select(User).where(User.email == "admin@nuk.edu.tw")):
            db.add(
                User(
                    email="admin@nuk.edu.tw",
                    name="展示模式管理者",
                    password_hash=hash_password("admin123"),
                    role="super_admin",
                    stakeholder_group_id=teacher_group.id,
                )
            )
        if expert_campaign and expert_group:
            code_hash = hash_invitation_code("DEMO-EXPERT")
            if not db.scalar(select(InvitationCode).where(InvitationCode.campaign_id == expert_campaign.id, InvitationCode.code_hash == code_hash)):
                db.add(
                    InvitationCode(
                        campaign_id=expert_campaign.id,
                        code_hash=code_hash,
                        code_prefix="DEMO",
                        stakeholder_group_id=expert_group.id,
                        evaluator_role="demo",
                        survey_type="expert_materiality",
                        label="Demo expert invitation",
                    )
                )
    db.commit()
