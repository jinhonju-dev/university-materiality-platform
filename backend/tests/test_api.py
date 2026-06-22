from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings


def detailed_scores(topics):
    return [
        {
            "topic_id": topic["id"],
            "organization_score": 4,
            "actual_or_potential": "actual",
            "positive_or_negative": "negative",
            "scale_score": 5,
            "scope_score": 4,
            "remediability_score": 4,
            "impact_likelihood_score": 5,
            "risk_or_opportunity": "risk",
            "time_horizon": "medium",
            "financial_magnitude_score": 4,
            "operational_resilience_score": 4,
            "financial_likelihood_score": 5,
        }
        for topic in topics
    ]


def test_formal_survey_submit_prevents_duplicates_and_exports(tmp_path: Path):
    settings = get_settings()
    settings.database_url = f"sqlite:///{tmp_path / 'test.db'}"
    settings.seed_demo_accounts = True
    settings.secret_key = "test-secret"

    from app.database import Base, engine
    from app.main import app

    Base.metadata.drop_all(bind=engine)
    with TestClient(app) as client:
        assert client.get("/api/health").status_code == 200

        login = client.post(
            "/api/auth/login",
            json={"email": "student@nuk.edu.tw", "password": "survey123"},
        )
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        topics = client.get("/api/topics", headers=headers).json()
        campaign = client.get("/api/campaigns/active", headers=headers).json()
        payload = {
            "campaign_id": campaign["id"],
            "open_answer": "希望強化能源、資安與人才培育。",
            "scores": detailed_scores(topics),
        }
        submit = client.post("/api/surveys/submit", json=payload, headers=headers)
        assert submit.status_code == 200
        duplicate = client.post("/api/surveys/submit", json=payload, headers=headers)
        assert duplicate.status_code == 409

        admin_login = client.post(
            "/api/auth/login",
            json={"email": "admin@nuk.edu.tw", "password": "admin123"},
        ).json()
        admin_headers = {"Authorization": f"Bearer {admin_login['access_token']}"}

        analytics = client.get("/api/analytics", headers=admin_headers)
        assert analytics.status_code == 200
        body = analytics.json()
        assert body["response_count"] == 1
        assert body["topics"][0]["quadrant"] == "重大主題"
        assert body["topics"][0]["impact"] == 4.5
        assert any(group["name"] == "學生" and group["weight"] == 1.0 for group in body["stakeholders"])

        groups = client.get("/api/admin/stakeholder-groups", headers=admin_headers)
        assert groups.status_code == 200
        student_group = next(group for group in groups.json() if group["name"] == "學生")
        update = client.patch(
            f"/api/admin/stakeholder-groups/{student_group['id']}",
            headers=admin_headers,
            json={"weight": 1.5, "description": "Student respondents"},
        )
        assert update.status_code == 200
        assert update.json()["weight"] == 1.5

        excel = client.get("/api/exports/responses.xlsx", headers=admin_headers)
        assert excel.status_code == 200
        assert excel.content.startswith(b"PK")

        csv = client.get("/api/exports/responses.csv?anonymized=true", headers=admin_headers)
        assert csv.status_code == 200
        assert "student@nuk.edu.tw" not in csv.content.decode("utf-8-sig")

        report = client.get("/api/reports/materiality.docx", headers=admin_headers)
        assert report.status_code == 200
        assert report.content.startswith(b"PK")


def test_anonymous_invitation_code_can_submit_once(tmp_path: Path):
    settings = get_settings()
    settings.database_url = f"sqlite:///{tmp_path / 'invite.db'}"
    settings.seed_demo_accounts = True
    settings.secret_key = "test-secret"

    from app.database import Base, engine
    from app.main import app

    Base.metadata.drop_all(bind=engine)
    with TestClient(app) as client:
        admin_login = client.post(
            "/api/auth/login",
            json={"email": "admin@nuk.edu.tw", "password": "admin123"},
        )
        assert admin_login.status_code == 200
        admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
        campaign = client.get("/api/campaigns/active", headers=admin_headers).json()

        invite_login = client.post(
            "/api/auth/invite",
            json={"campaign_id": campaign["id"], "invitation_code": "DEMO-STUDENT"},
        )
        assert invite_login.status_code == 200
        invite_headers = {"Authorization": f"Bearer {invite_login.json()['access_token']}"}
        topics = client.get("/api/topics", headers=invite_headers).json()
        submit = client.post(
            "/api/surveys/submit",
            headers=invite_headers,
            json={
                "campaign_id": campaign["id"],
                "open_answer": "匿名填答測試",
                "scores": detailed_scores(topics),
            },
        )
        assert submit.status_code == 200

        second_login = client.post(
            "/api/auth/invite",
            json={"campaign_id": campaign["id"], "invitation_code": "DEMO-STUDENT"},
        )
        assert second_login.status_code == 409


def test_topic_and_campaign_admin_management(tmp_path: Path):
    settings = get_settings()
    settings.database_url = f"sqlite:///{tmp_path / 'admin.db'}"
    settings.seed_demo_accounts = True
    settings.secret_key = "test-secret"

    from app.database import Base, engine
    from app.main import app

    Base.metadata.drop_all(bind=engine)
    with TestClient(app) as client:
        admin_login = client.post(
            "/api/auth/login",
            json={"email": "admin@nuk.edu.tw", "password": "admin123"},
        )
        assert admin_login.status_code == 200
        admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

        created_topic = client.post(
            "/api/admin/topics",
            headers=admin_headers,
            json={
                "code": "G99",
                "category": "G",
                "name_zh": "測試治理議題",
                "name_en": "Test Governance Topic",
                "description": "管理端新增測試",
                "gri_mapping": "GRI 3",
                "sdgs_mapping": "SDG 16",
                "responsible_unit": "永續辦公室",
                "management_approach": "年度審查",
                "kpi": "完成率",
                "sort_order": 99,
            },
        )
        assert created_topic.status_code == 200
        topic_id = created_topic.json()["id"]
        patched_topic = client.patch(
            f"/api/admin/topics/{topic_id}",
            headers=admin_headers,
            json={"is_active": False},
        )
        assert patched_topic.status_code == 200
        assert patched_topic.json()["is_active"] is False

        created_campaign = client.post(
            "/api/admin/campaigns",
            headers=admin_headers,
            json={
                "title": "2027 測試問卷",
                "year": 2027,
                "status": "draft",
                "is_open": False,
                "impact_threshold": 3.7,
                "financial_threshold": 3.6,
            },
        )
        assert created_campaign.status_code == 200
        campaign_id = created_campaign.json()["id"]
        opened_campaign = client.patch(
            f"/api/admin/campaigns/{campaign_id}",
            headers=admin_headers,
            json={"status": "active", "is_open": True},
        )
        assert opened_campaign.status_code == 200
        assert opened_campaign.json()["is_open"] is True

        groups = client.get("/api/admin/stakeholder-groups", headers=admin_headers).json()
        student_group = next(group for group in groups if group["name"] == "學生")
        invitations = client.post(
            f"/api/admin/campaigns/{campaign_id}/invitations",
            headers=admin_headers,
            json={"stakeholder_group_id": student_group["id"], "count": 3, "label_prefix": "STU"},
        )
        assert invitations.status_code == 200
        assert len(invitations.json()) == 3
        listed = client.get(f"/api/admin/campaigns/{campaign_id}/invitations", headers=admin_headers)
        assert listed.status_code == 200
        assert len(listed.json()) == 3
