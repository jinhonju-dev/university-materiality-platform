from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import get_settings


def reset_app_database(
    tmp_path: Path,
    name: str,
    *,
    app_mode: str = "production",
    secret_key: str = "test-secret-for-unit-tests-32-bytes",
):
    settings = get_settings()
    settings.database_url = f"sqlite:///{tmp_path / name}"
    settings.app_env = "test"
    settings.app_mode = app_mode
    settings.seed_demo_accounts = app_mode == "demo"
    settings.bootstrap_admin_email = "root@nuk.edu.tw"
    settings.bootstrap_admin_password = "StrongRootPass123!"
    settings.secret_key = secret_key
    settings.openai_api_key = None

    from app.database import Base, engine
    from app.main import app

    Base.metadata.drop_all(bind=engine)
    return app


def login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def public_config(client: TestClient, path: str):
    response = client.get(path)
    assert response.status_code == 200
    return response.json()


def concern_scores(topics):
    return [{"topic_id": topic["id"], "concern_score": 4} for topic in topics]


def expert_scores(topics):
    return [
        {
            "topic_id": topic["id"],
            "positive_likelihood_score": 5,
            "positive_impact_magnitude_score": 4,
            "negative_likelihood_score": 5,
            "negative_impact_magnitude_score": 4,
            "enrollment_revenue_score": 4,
            "reputation_score": 5,
            "operating_cost_score": 3,
            "funding_score": 4,
            "legal_responsibility_score": 3,
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
        assert "password_hash" not in users.json()[0]


def test_roles_invitation_codes_persistence_and_exports(tmp_path: Path):
    app = reset_app_database(tmp_path, "phase2.db", app_mode="production")
    with TestClient(app) as client:
        root_headers = login(client, "root@nuk.edu.tw", "StrongRootPass123!")
        concern_config = public_config(client, "/api/surveys/concern/current")
        expert_config = public_config(client, "/api/surveys/expert/current")
        concern_campaign_id = concern_config["campaign"]["id"]
        expert_campaign_id = expert_config["campaign"]["id"]
        teacher_group = next(group for group in concern_config["stakeholder_groups"] if group["name"] == "教師")
        student_group = next(group for group in concern_config["stakeholder_groups"] if group["name"] == "學生")

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
        assert "items" in audit_as_root.json()

        concern = client.post(
            "/api/surveys/concern/submit",
            json={
                "campaign_id": concern_campaign_id,
                "stakeholder_group_id": student_group["id"],
                "scores": concern_scores(concern_config["topics"]),
                "open_answer": "關注能源管理與資訊安全。",
            },
        )
        assert concern.status_code == 200
        assert concern.json()["submitted"] is True

        invitations = client.post(
            f"/api/admin/campaigns/{expert_campaign_id}/invitation-codes",
            headers=admin_headers,
            json={"stakeholder_group_id": teacher_group["id"], "count": 1, "label_prefix": "EXP", "evaluator_role": "主管代表"},
        )
        assert invitations.status_code == 200
        invitation_payload = invitations.json()[0]
        code = invitation_payload["code"]
        assert code
        assert invitation_payload["code_prefix"]
        assert invitation_payload["survey_type"] == "expert_materiality"

        listed = client.get(f"/api/admin/campaigns/{expert_campaign_id}/invitation-codes", headers=admin_headers)
        assert listed.status_code == 200
        assert listed.json()[0]["code"] is None
        assert listed.json()[0]["code_prefix"] == invitation_payload["code_prefix"]

        invite_login = client.post("/api/auth/invitation-login", json={"campaign_id": expert_campaign_id, "invitation_code": code})
        assert invite_login.status_code == 200

        draft = client.post(
            "/api/surveys/expert/draft",
            json={"campaign_id": expert_campaign_id, "invitation_code": code, "payload": {"page": 1}},
        )
        assert draft.status_code == 200

        expert = client.post(
            "/api/surveys/expert/submit",
            json={
                "campaign_id": expert_campaign_id,
                "invitation_code": code,
                "scores": expert_scores(expert_config["topics"]),
                "open_answer": "建議強化資安與人才培育。",
            },
        )
        assert expert.status_code == 200

        duplicate = client.post(
            "/api/surveys/expert/submit",
            json={
                "campaign_id": expert_campaign_id,
                "invitation_code": code,
                "scores": expert_scores(expert_config["topics"]),
            },
        )
        assert duplicate.status_code == 409

        analytics = client.get("/api/analytics", headers=reviewer_headers)
        assert analytics.status_code == 200
        body = analytics.json()
        assert body["response_count"] == 2
        assert body["concern_response_count"] == 1
        assert body["expert_response_count"] == 1
        assert body["topics"][0]["impact_materiality_score"] == 4.0
        assert body["topics"][0]["financial_materiality_score"] == 3.8
        assert body["evaluator_roles"][0]["evaluator_role"] == "主管代表"
        assert body["final_material_topics"]

        override = client.patch(
            f"/api/admin/material-topics/{body['topics'][0]['topic_id']}/override",
            headers=admin_headers,
            json={"campaign_id": expert_campaign_id, "is_material": False, "reason": "測試管理者手動調整"},
        )
        assert override.status_code == 200
        assert override.json()["topics"][0]["manually_adjusted"] is True

        report = client.get("/api/reports/materiality.docx", headers=reviewer_headers)
        assert report.status_code == 200

        blocked_invites = client.post(
            f"/api/admin/campaigns/{expert_campaign_id}/invitation-codes",
            headers=reviewer_headers,
            json={"stakeholder_group_id": teacher_group["id"], "count": 1},
        )
        assert blocked_invites.status_code == 403

        concern_export = client.get("/api/admin/export/concern-responses.xlsx", headers=admin_headers)
        assert concern_export.status_code == 200
        expert_export = client.get("/api/admin/export/expert-responses.xlsx", headers=admin_headers)
        assert expert_export.status_code == 200
        anonymized_export = client.get("/api/admin/export/anonymized-responses.xlsx", headers=admin_headers)
        assert anonymized_export.status_code == 200


def test_production_default_secret_blocks_startup(tmp_path: Path):
    app = reset_app_database(
        tmp_path,
        "bad-secret.db",
        app_mode="production",
        secret_key="change-this-secret-in-production",
    )
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        with TestClient(app):
            pass


@pytest.mark.parametrize(
    "database_url",
    [
        "",
        "<Supabase PostgreSQL connection string>",
        "postgresql+psycopg://<user>:<password>@<host>:5432/<database>",
        "sqlite:///./materiality.db",
        "DATABASE_URL=postgresql+psycopg://user:pass@host:5432/postgres",
        '"postgresql+psycopg://user:pass@host:5432/postgres"',
    ],
)
def test_production_database_url_validation_rejects_bad_values(database_url: str):
    from app.config import Settings

    settings = Settings(
        app_env="production",
        app_mode="production",
        database_url=database_url,
        secret_key="test-secret-for-unit-tests-32-bytes",
    )
    with pytest.raises(RuntimeError, match="Render Environment Variables"):
        settings.validate_database_url()


def test_postgresql_url_is_normalized_to_psycopg_driver():
    from app.config import Settings

    settings = Settings(
        app_env="production",
        app_mode="production",
        database_url="postgresql://user:pass@example.supabase.co:5432/postgres",
        secret_key="test-secret-for-unit-tests-32-bytes",
    )
    settings.validate_database_url()
    assert settings.sqlalchemy_database_url == "postgresql+psycopg://user:pass@example.supabase.co:5432/postgres"


def test_topic_score_null_subscores_are_not_backfilled(tmp_path: Path):
    app = reset_app_database(tmp_path, "null-subscores.db", app_mode="production")
    with TestClient(app) as client:
        headers = login(client, "root@nuk.edu.tw", "StrongRootPass123!")
        concern_config = public_config(client, "/api/surveys/concern/current")
        campaign_id = concern_config["campaign"]["id"]
        scores = [
            {
                "topic_id": topic["id"],
                "organization_score": 4,
                "positive_or_negative": "negative",
                "scale_score": 5,
                "scope_score": None,
                "remediability_score": None,
                "impact_likelihood_score": 5,
                "financial_magnitude_score": 4,
                "operational_resilience_score": None,
                "financial_likelihood_score": 5,
            }
            for topic in concern_config["topics"]
        ]
        submitted = client.post("/api/surveys/submit", headers=headers, json={"campaign_id": campaign_id, "scores": scores})
        assert submitted.status_code == 200

        from app.database import SessionLocal
        from app.models import TopicScore

        with SessionLocal() as db:
            score = db.scalars(select(TopicScore).order_by(TopicScore.id)).first()
            assert score is not None
            assert score.scale_score == 5
            assert score.scope_score is None
            assert score.remediability_score is None
            assert score.impact_likelihood_score == 5
            assert score.impact_score == 5.0
            assert score.financial_magnitude_score == 4
            assert score.operational_resilience_score is None
            assert score.financial_likelihood_score == 5
            assert score.financial_score == 4.5
