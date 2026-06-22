import base64
import zipfile
from io import BytesIO
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


def reset_app_database(tmp_path: Path, name: str):
    settings = get_settings()
    settings.database_url = f"sqlite:///{tmp_path / name}"
    settings.seed_demo_accounts = True
    settings.secret_key = "test-secret"

    from app.database import Base, engine
    from app.main import app

    Base.metadata.drop_all(bind=engine)
    return app


def admin_headers(client: TestClient) -> dict[str, str]:
    admin_login = client.post(
        "/api/auth/login",
        json={"email": "admin@nuk.edu.tw", "password": "admin123"},
    )
    assert admin_login.status_code == 200
    return {"Authorization": f"Bearer {admin_login.json()['access_token']}"}


def test_formal_survey_submit_prevents_duplicates_and_exports(tmp_path: Path):
    app = reset_app_database(tmp_path, "test.db")

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
            "open_answer": "建議優先處理能源、資訊安全與人才培育。",
            "scores": detailed_scores(topics),
        }
        submit = client.post("/api/surveys/submit", json=payload, headers=headers)
        assert submit.status_code == 200
        duplicate = client.post("/api/surveys/submit", json=payload, headers=headers)
        assert duplicate.status_code == 409

        admin = admin_headers(client)
        analytics = client.get("/api/analytics", headers=admin)
        assert analytics.status_code == 200
        body = analytics.json()
        assert body["response_count"] == 1
        assert body["topics"][0]["quadrant"] == "重大主題"
        assert body["topics"][0]["impact"] == 4.5
        assert any(group["name"] == "學生" and group["weight"] == 1.0 for group in body["stakeholders"])

        groups = client.get("/api/admin/stakeholder-groups", headers=admin)
        assert groups.status_code == 200
        student_group = next(group for group in groups.json() if group["name"] == "學生")
        update = client.patch(
            f"/api/admin/stakeholder-groups/{student_group['id']}",
            headers=admin,
            json={"weight": 1.5, "description": "Student respondents"},
        )
        assert update.status_code == 200
        assert update.json()["weight"] == 1.5

        excel = client.get("/api/exports/responses.xlsx", headers=admin)
        assert excel.status_code == 200
        assert excel.content.startswith(b"PK")

        csv = client.get("/api/exports/responses.csv?anonymized=true", headers=admin)
        assert csv.status_code == 200
        assert "student@nuk.edu.tw" not in csv.content.decode("utf-8-sig")

        matrix = client.get("/api/exports/materiality-matrix.png", headers=admin)
        assert matrix.status_code == 200
        assert matrix.content.startswith(b"\x89PNG\r\n\x1a\n")

        report = client.get("/api/reports/materiality.docx", headers=admin)
        assert report.status_code == 200
        assert report.content.startswith(b"PK")
        with zipfile.ZipFile(BytesIO(report.content)) as archive:
            assert any(name.startswith("word/media/") and name.endswith(".png") for name in archive.namelist())

        posted_report = client.post(
            "/api/reports/materiality.docx",
            headers=admin,
            json={
                "campaign_id": campaign["id"],
                "matrix_png_base64": "data:image/png;base64," + base64.b64encode(matrix.content).decode("ascii"),
            },
        )
        assert posted_report.status_code == 200
        assert posted_report.content.startswith(b"PK")


def test_anonymous_invitation_code_can_submit_once(tmp_path: Path):
    app = reset_app_database(tmp_path, "invite.db")

    with TestClient(app) as client:
        admin = admin_headers(client)
        campaign = client.get("/api/campaigns/active", headers=admin).json()

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
    app = reset_app_database(tmp_path, "admin.db")

    with TestClient(app) as client:
        admin = admin_headers(client)

        created_topic = client.post(
            "/api/admin/topics",
            headers=admin,
            json={
                "code": "G99",
                "category": "G",
                "name_zh": "測試治理議題",
                "name_en": "Test Governance Topic",
                "description": "測試新增議題",
                "gri_mapping": "GRI 3",
                "sdgs_mapping": "SDG 16",
                "responsible_unit": "永續發展辦公室",
                "management_approach": "年度檢討",
                "kpi": "完成率",
                "sort_order": 99,
            },
        )
        assert created_topic.status_code == 200
        topic_id = created_topic.json()["id"]
        patched_topic = client.patch(
            f"/api/admin/topics/{topic_id}",
            headers=admin,
            json={"is_active": False},
        )
        assert patched_topic.status_code == 200
        assert patched_topic.json()["is_active"] is False

        created_campaign = client.post(
            "/api/admin/campaigns",
            headers=admin,
            json={
                "title": "2027 測試問卷活動",
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
            headers=admin,
            json={"status": "active", "is_open": True},
        )
        assert opened_campaign.status_code == 200
        assert opened_campaign.json()["is_open"] is True

        groups = client.get("/api/admin/stakeholder-groups", headers=admin).json()
        student_group = next(group for group in groups if group["name"] == "學生")
        invitations = client.post(
            f"/api/admin/campaigns/{campaign_id}/invitations",
            headers=admin,
            json={"stakeholder_group_id": student_group["id"], "count": 3, "label_prefix": "STU"},
        )
        assert invitations.status_code == 200
        assert len(invitations.json()) == 3
        listed = client.get(f"/api/admin/campaigns/{campaign_id}/invitations", headers=admin)
        assert listed.status_code == 200
        assert len(listed.json()) == 3
