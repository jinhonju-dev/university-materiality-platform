from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import StakeholderGroup, SurveyCampaign, Topic, User
from .security import hash_password


GROUPS = [
    ("教師", "校內"),
    ("職員", "校內"),
    ("學生", "校內"),
    ("校友", "校內"),
    ("廠商", "校外"),
    ("政府機關", "校外"),
    ("社區居民", "校外"),
    ("NGO", "校外"),
    ("企業夥伴", "校外"),
]

TOPICS = [
    ("E01", "環境", "能源管理", "Energy Management", "提升能源效率與再生能源使用", 1),
    ("E02", "環境", "溫室氣體排放", "Greenhouse Gas Emissions", "盤查與降低溫室氣體排放", 2),
    ("E03", "環境", "水資源", "Water Resources", "節水、回收與水風險管理", 3),
    ("E04", "環境", "廢棄物", "Waste Management", "源頭減量與資源循環", 4),
    ("S01", "社會", "職業安全", "Occupational Safety", "教職員工生健康與安全", 5),
    ("S02", "社會", "人才培育", "Talent Development", "教學品質、職能與生涯發展", 6),
    ("S03", "社會", "多元共融", "Diversity and Inclusion", "平等、尊重與友善校園", 7),
    ("S04", "社會", "社區參與", "Community Engagement", "在地連結與社會影響力", 8),
    ("G01", "治理", "資訊安全", "Information Security", "個資保護與資安韌性", 9),
    ("G02", "治理", "法遵", "Compliance", "法規遵循與風險管理", 10),
    ("G03", "治理", "誠信經營", "Integrity and Ethics", "誠信、透明與問責", 11),
]


def seed_database(db: Session) -> None:
    if not db.scalar(select(StakeholderGroup.id).limit(1)):
        db.add_all(
            [StakeholderGroup(name=name, scope=scope) for name, scope in GROUPS]
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
        db.add(
            SurveyCampaign(
                title="2026 高雄大學雙重重大性評估",
                year=2026,
                status="active",
            )
        )

    db.flush()
    teacher_group = db.scalar(
        select(StakeholderGroup).where(StakeholderGroup.name == "教師")
    )
    student_group = db.scalar(
        select(StakeholderGroup).where(StakeholderGroup.name == "學生")
    )
    if not db.scalar(select(User).where(User.email == "admin@nuk.edu.tw")):
        db.add(
            User(
                email="admin@nuk.edu.tw",
                name="永續辦公室管理者",
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
    db.commit()

