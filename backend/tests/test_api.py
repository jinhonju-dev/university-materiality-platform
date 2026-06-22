from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings


def reset_app_database(tmp_path: Path, name: str, *, app_mode: str = "production"):
    settings = get_settings()
    settings.database_url = f"sqlite:///{tmp_path / name}"
    settings.app_mode = app_mode
    settings.seed_demo_accounts = app_mode == "demo"
    settings.bootstrap_admin_email = "root@nuk.edu.tw"
    settings.bootstrap_admin_password = "StrongRootPass123!"
    settings.secret_key = "test-secret"
    settings.openai_api_key = None

    from app.database import Base, engine
    from app.main import app

    Base.metadata.drop_all(bind=engine)
    return app


def login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def public_config(client: TestClient):
    response = client.get("/api/public/survey-config")
    assert response.status_code == 200
    return response.json()


def concern_scores(topics):
    return [{"topic_id": topic["id"], "concern_score": 4} for topic in topics]


def expert_scores(topics):
    return [
        {
            "topic_id": topic["id"],
            "impact_likelihood_score": 5,
            "positive_impact_score": 4,
            "negative_impact_score": 4,
            "admissions_revenue_score": 4,
            "reputation_score": 5,
            "operating_cost_score": 3,
            "funding_score": 4,
            "legal_liability_score": 3,
            "financial_likelihood_score": 5,
        }
        for topic in topics
    ]


def test_production_mode_bootstrap_and_no_demo_accounts(tmp_path: Path):
    app = reset_app_database(tmp_path, "production.db", app_mode="production")
    with TestClient(app) as client:
        mode = client.get("/api/system/mode")
        assert mode.status_code == 200
        assert mode.json()["mode"] == "production"

        demo_login = client.post("/api/auth/login", json={"email": "admin@nuk.edu.tw", "password": "admin123"})
        assert demo_login.status_code == 401

        root_headers = login(client, "root@nuk.edu.tw", "StrongRootPass123!")
        users = client.get("/api/admin/users", headers=root_headers)
        assert users.status_code == 200
        assert users.json()[0]["role"] == "super_admin"


def test_roles_and_two_stage_surveys(tmp_path: Path):
    app = reset_app_database(tmp_path, "roles.db", app_mode="production")
    with TestClient(app) as client:
        root_headers = login(client, "root@nuk.edu.tw", "StrongRootPass123!")
        config = public_config(client)
        campaign_id = config["campaign"]["id"]
        teacher_group = next(group for group in config["stakeholder_groups"] if group["name"] == "教師")
        student_group = next(group for group in config["stakeholder_groups"] if group["name"] == "學生")

        created_admin = client.post(
            "/api/admin/users",
            headers=root_headers,
            json={
                "email": "admin2@nuk.edu.tw",
                "name": "活動管理者",
                "password": "AdminStrongPass123!",
                "role": "admin",
                "stakeholder_group_id": teacher_group["id"],
            },
        )
        assert created_admin.status_code == 200

        created_reviewer = client.post(
            "/api/admin/users",
            headers=root_headers,
            json={
                "email": "reviewer@nuk.edu.tw",
                "name": "報告審閱者",
                "password": "ReviewerStrongPass123!",
                "role": "reviewer",
                "stakeholder_group_id": teacher_group["id"],
            },
        )
        assert created_reviewer.status_code == 200

        admin_headers = login(client, "admin2@nuk.edu.tw", "AdminStrongPass123!")
        reviewer_headers = login(client, "reviewer@nuk.edu.tw", "ReviewerStrongPass123!")

        reviewer_topic_create = client.post(
            "/api/admin/topics",
            headers=reviewer_headers,
            json={
                "code": "G99",
                "category": "G",
                "name_zh": "審閱者不應可新增",
                "name_en": "Reviewer cannot create",
                "sort_order": 99,
            },
        )
        assert reviewer_topic_create.status_code == 403

        audit_as_admin = client.get("/api/admin/audit-logs", headers=admin_headers)
        assert audit_as_admin.status_code == 403
        audit_as_root = client.get("/api/admin/audit-logs", headers=root_headers)
        assert audit_as_root.status_code == 200

        concern = client.post(
            "/api/surveys/concern",
            json={
                "campaign_id": campaign_id,
                "stakeholder_group_id": student_group["id"],
                "scores": concern_scores(config["topics"]),
                "open_answer": "關注能源與資訊安全。",
            },
        )
        assert concern.status_code == 200
        assert concern.json()["submitted"] is True

        invitations = client.post(
            f"/api/admin/campaigns/{campaign_id}/invitations",
            headers=admin_headers,
            json={"stakeholder_group_id": teacher_group["id"], "count": 1, "label_prefix": "EXP"},
        )
        assert invitations.status_code == 200
        code = invitations.json()[0]["code"]
        assert invitations.json()[0]["survey_type"] == "expert"

        expert = client.post(
            "/api/surveys/expert",
            json={
                "campaign_id": campaign_id,
                "invitation_code": code,
                "scores": expert_scores(config["topics"]),
                "open_answer": "專家評估完成。",
            },
        )
        assert expert.status_code == 200

        duplicate = client.post(
            "/api/surveys/expert",
            json={
                "campaign_id": campaign_id,
                "invitation_code": code,
                "scores": expert_scores(config["topics"]),
            },
        )
        assert duplicate.status_code == 409

        analytics = client.get("/api/analytics", headers=reviewer_headers)
        assert analytics.status_code == 200
        report = client.get("/api/reports/materiality.docx", headers=reviewer_headers)
        assert report.status_code == 200
        blocked_invites = client.post(
            f"/api/admin/campaigns/{campaign_id}/invitations",
            headers=reviewer_headers,
            json={"stakeholder_group_id": teacher_group["id"], "count": 1},
        )
        assert blocked_invites.status_code == 403
