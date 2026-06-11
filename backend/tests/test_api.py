from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings


def test_end_to_end(tmp_path: Path):
    settings = get_settings()
    settings.database_url = f"sqlite:///{tmp_path / 'test.db'}"

    from app.database import Base, engine
    from app.main import app

    Base.metadata.drop_all(bind=engine)
    with TestClient(app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200

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
            "open_answer": "未來應重視能源管理、人才培育與資訊安全。",
            "scores": [
                {
                    "topic_id": topic["id"],
                    "organization_score": 4,
                    "impact_score": 4,
                    "financial_score": 4,
                }
                for topic in topics
            ],
        }
        submit = client.post("/api/surveys/submit", json=payload, headers=headers)
        assert submit.status_code == 200
        payload["scores"][0]["impact_score"] = 5
        resubmit = client.post("/api/surveys/submit", json=payload, headers=headers)
        assert resubmit.status_code == 200

        admin_login = client.post(
            "/api/auth/login",
            json={"email": "admin@nuk.edu.tw", "password": "admin123"},
        ).json()
        admin_headers = {"Authorization": f"Bearer {admin_login['access_token']}"}
        analytics = client.get("/api/analytics", headers=admin_headers)
        assert analytics.status_code == 200
        assert analytics.json()["response_count"] == 1
        assert analytics.json()["topics"][0]["quadrant"] == "重大主題"
        assert analytics.json()["topics"][0]["impact"] == 5

        report = client.get("/api/reports/materiality.docx", headers=admin_headers)
        assert report.status_code == 200
        assert report.content.startswith(b"PK")
