import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .analytics import build_analytics
from .config import get_settings
from .database import Base, SessionLocal, engine, get_db
from .export import create_csv_export, create_excel_export
from .models import AuditLog, InvitationCode, StakeholderGroup, SurveyCampaign, SurveyDraft, SurveyResponse, Topic, TopicScore, User
from .report import create_materiality_report
from .schemas import (
    AnalyticsOut,
    AnonymousSurveyDraftIn,
    AnonymousSurveySubmit,
    CampaignOut,
    InviteLoginRequest,
    LoginRequest,
    StakeholderGroupAdminOut,
    StakeholderGroupCreate,
    StakeholderGroupUpdate,
    SurveyDraftIn,
    SurveyStatusOut,
    SurveySubmit,
    TokenOut,
    TopicOut,
    UserOut,
)
from .security import create_access_token, get_current_principal, get_current_user, require_admin, verify_password
from .seed import seed_database


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_database(db)
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def log_event(db: Session, action: str, resource_type: str, resource_id: str | None = None, user: User | None = None, detail: str | None = None) -> None:
    db.add(
        AuditLog(
            actor_user_id=user.id if user else None,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            detail=detail,
        )
    )


def is_campaign_open(campaign: SurveyCampaign) -> bool:
    now = datetime.now(timezone.utc)
    if campaign.status != "active" or not campaign.is_open:
        return False
    if campaign.starts_at and campaign.starts_at > now:
        return False
    if campaign.ends_at and campaign.ends_at < now:
        return False
    return True


def score_value(values: list[int | None]) -> float:
    numeric = [value for value in values if value is not None]
    return round(sum(numeric) / len(numeric), 2)


def resolve_invitation(db: Session, campaign_id: int, code: str) -> InvitationCode:
    invitation = db.scalar(
        select(InvitationCode).where(
            InvitationCode.campaign_id == campaign_id,
            InvitationCode.code == code.strip(),
            InvitationCode.is_active.is_(True),
        )
    )
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation code is invalid.")
    return invitation


def validate_topic_coverage(db: Session, scores) -> None:
    topic_ids = set(db.scalars(select(Topic.id).where(Topic.is_active.is_(True))).all())
    submitted_ids = {score.topic_id for score in scores}
    if submitted_ids != topic_ids:
        raise HTTPException(status_code=422, detail="Please score every active topic before submitting.")


def score_models(response_id: int, scores) -> list[TopicScore]:
    models = []
    for score in scores:
        impact_score = score.impact_score or score_value(
            [
                score.scale_score,
                score.scope_score,
                score.remediability_score if score.positive_or_negative == "negative" else None,
                score.impact_likelihood_score,
            ]
        )
        financial_score = score.financial_score or score_value(
            [
                score.financial_magnitude_score,
                score.operational_resilience_score,
                score.financial_likelihood_score,
            ]
        )
        models.append(
            TopicScore(
                response_id=response_id,
                topic_id=score.topic_id,
                organization_score=score.organization_score,
                actual_or_potential=score.actual_or_potential,
                positive_or_negative=score.positive_or_negative,
                scale_score=score.scale_score or int(round(impact_score)),
                scope_score=score.scope_score or int(round(impact_score)),
                remediability_score=score.remediability_score if score.positive_or_negative == "negative" else None,
                impact_likelihood_score=score.impact_likelihood_score or int(round(impact_score)),
                impact_score=impact_score,
                risk_or_opportunity=score.risk_or_opportunity,
                time_horizon=score.time_horizon,
                financial_magnitude_score=score.financial_magnitude_score or int(round(financial_score)),
                operational_resilience_score=score.operational_resilience_score or int(round(financial_score)),
                financial_likelihood_score=score.financial_likelihood_score or int(round(financial_score)),
                financial_score=financial_score,
            )
        )
    return models


@app.get("/api/health")
def health():
    return {"status": "ok", "service": settings.app_name}


@app.post("/api/auth/login", response_model=TokenOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email, User.is_active.is_(True)))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    log_event(db, "login", "user", str(user.id), user=user)
    db.commit()
    return {"access_token": create_access_token(user_id=user.id), "user": user}


@app.post("/api/auth/invite", response_model=TokenOut)
def invite_login(payload: InviteLoginRequest, db: Session = Depends(get_db)):
    campaign = db.get(SurveyCampaign, payload.campaign_id)
    if not campaign or not is_campaign_open(campaign):
        raise HTTPException(status_code=400, detail="Survey campaign is not open.")
    invitation = resolve_invitation(db, payload.campaign_id, payload.invitation_code)
    if invitation.used_at:
        raise HTTPException(status_code=409, detail="Invitation code has already been used.")
    pseudo_user = UserOut(
        id=-invitation.id,
        email="anonymous@example.org",
        name=f"匿名填答者-{invitation.stakeholder_group.name}",
        role="respondent",
        stakeholder_group=invitation.stakeholder_group,
    )
    return {
        "access_token": create_access_token(invitation_code_id=invitation.id),
        "user": pseudo_user,
    }


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@app.get("/api/topics", response_model=list[TopicOut])
def list_topics(
    _: User | InvitationCode = Depends(get_current_principal),
    db: Session = Depends(get_db),
):
    return db.scalars(select(Topic).where(Topic.is_active.is_(True)).order_by(Topic.sort_order)).all()


@app.get("/api/campaigns/active", response_model=CampaignOut)
def active_campaign(
    _: User | InvitationCode = Depends(get_current_principal),
    db: Session = Depends(get_db),
):
    campaign = db.scalar(
        select(SurveyCampaign).where(SurveyCampaign.status == "active").order_by(SurveyCampaign.year.desc())
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="No active survey campaign.")
    return campaign


@app.get("/api/admin/stakeholder-groups", response_model=list[StakeholderGroupAdminOut])
def list_stakeholder_groups(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    count_rows = db.execute(
        select(SurveyResponse.stakeholder_group_id, func.count(SurveyResponse.id))
        .group_by(SurveyResponse.stakeholder_group_id)
    ).all()
    counts = {group_id: count for group_id, count in count_rows}
    groups = db.scalars(select(StakeholderGroup).order_by(StakeholderGroup.scope, StakeholderGroup.name)).all()
    return [
        StakeholderGroupAdminOut.model_validate(group).model_copy(update={"response_count": counts.get(group.id, 0)})
        for group in groups
    ]


@app.post("/api/admin/stakeholder-groups", response_model=StakeholderGroupAdminOut)
def create_stakeholder_group(
    payload: StakeholderGroupCreate,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    exists = db.scalar(select(StakeholderGroup).where(StakeholderGroup.name == payload.name))
    if exists:
        raise HTTPException(status_code=409, detail="Stakeholder group already exists.")
    group = StakeholderGroup(**payload.model_dump())
    db.add(group)
    db.flush()
    log_event(db, "create_stakeholder_group", "stakeholder_group", str(group.id), user=user)
    db.commit()
    db.refresh(group)
    return StakeholderGroupAdminOut.model_validate(group).model_copy(update={"response_count": 0})


@app.patch("/api/admin/stakeholder-groups/{group_id}", response_model=StakeholderGroupAdminOut)
def update_stakeholder_group(
    group_id: int,
    payload: StakeholderGroupUpdate,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    group = db.get(StakeholderGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Stakeholder group not found.")
    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates:
        duplicate = db.scalar(
            select(StakeholderGroup).where(StakeholderGroup.name == updates["name"], StakeholderGroup.id != group_id)
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="Stakeholder group name already exists.")
    for key, value in updates.items():
        setattr(group, key, value)
    count = db.scalar(select(func.count(SurveyResponse.id)).where(SurveyResponse.stakeholder_group_id == group.id)) or 0
    log_event(db, "update_stakeholder_group", "stakeholder_group", str(group.id), user=user, detail=json.dumps(updates, ensure_ascii=False))
    db.commit()
    db.refresh(group)
    return StakeholderGroupAdminOut.model_validate(group).model_copy(update={"response_count": count})


@app.get("/api/surveys/{campaign_id}/status", response_model=SurveyStatusOut)
def survey_status(
    campaign_id: int,
    principal: User | InvitationCode = Depends(get_current_principal),
    db: Session = Depends(get_db),
):
    if isinstance(principal, User):
        response = db.scalar(
            select(SurveyResponse).where(
                SurveyResponse.campaign_id == campaign_id,
                SurveyResponse.respondent_id == principal.id,
            )
        )
    else:
        response = db.scalar(
            select(SurveyResponse).where(
                SurveyResponse.campaign_id == campaign_id,
                SurveyResponse.invitation_code_id == principal.id,
            )
        )
    return {"campaign_id": campaign_id, "submitted": response is not None, "submitted_at": response.submitted_at if response else None}


@app.put("/api/surveys/draft")
def save_draft(
    payload: SurveyDraftIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    draft = db.scalar(
        select(SurveyDraft).where(
            SurveyDraft.campaign_id == payload.campaign_id,
            SurveyDraft.respondent_id == user.id,
        )
    )
    if not draft:
        draft = SurveyDraft(campaign_id=payload.campaign_id, respondent_id=user.id, payload_json="{}")
        db.add(draft)
    draft.payload_json = json.dumps(payload.payload, ensure_ascii=False)
    db.commit()
    return {"saved": True}


@app.put("/api/surveys/draft/anonymous")
def save_anonymous_draft(payload: AnonymousSurveyDraftIn, db: Session = Depends(get_db)):
    invitation = resolve_invitation(db, payload.campaign_id, payload.invitation_code)
    if invitation.used_at:
        raise HTTPException(status_code=409, detail="Invitation code has already been used.")
    draft = db.scalar(
        select(SurveyDraft).where(
            SurveyDraft.campaign_id == payload.campaign_id,
            SurveyDraft.invitation_code_id == invitation.id,
        )
    )
    if not draft:
        draft = SurveyDraft(campaign_id=payload.campaign_id, invitation_code_id=invitation.id, payload_json="{}")
        db.add(draft)
    draft.payload_json = json.dumps(payload.payload, ensure_ascii=False)
    db.commit()
    return {"saved": True}


@app.post("/api/surveys/submit", response_model=SurveyStatusOut)
def submit_survey(
    payload: SurveySubmit,
    principal: User | InvitationCode = Depends(get_current_principal),
    db: Session = Depends(get_db),
):
    campaign = db.get(SurveyCampaign, payload.campaign_id)
    if not campaign or not is_campaign_open(campaign):
        raise HTTPException(status_code=400, detail="Survey campaign is not open.")
    validate_topic_coverage(db, payload.scores)
    if isinstance(principal, User):
        existing = db.scalar(
            select(SurveyResponse).where(
                SurveyResponse.campaign_id == campaign.id,
                SurveyResponse.respondent_id == principal.id,
            )
        )
        if existing:
            raise HTTPException(status_code=409, detail="This account has already submitted this campaign.")
        response = SurveyResponse(
            campaign_id=campaign.id,
            respondent_id=principal.id,
            stakeholder_group_id=principal.stakeholder_group_id,
            open_answer=payload.open_answer,
        )
    else:
        if principal.campaign_id != campaign.id:
            raise HTTPException(status_code=403, detail="Invitation code is not valid for this campaign.")
        if principal.used_at:
            raise HTTPException(status_code=409, detail="Invitation code has already been used.")
        response = SurveyResponse(
            campaign_id=campaign.id,
            invitation_code_id=principal.id,
            stakeholder_group_id=principal.stakeholder_group_id,
            open_answer=payload.open_answer,
        )
        principal.used_at = datetime.now(timezone.utc)
    db.add(response)
    db.flush()
    response.scores = score_models(response.id, payload.scores)
    if isinstance(principal, User):
        db.execute(delete(SurveyDraft).where(SurveyDraft.campaign_id == campaign.id, SurveyDraft.respondent_id == principal.id))
        log_event(db, "survey_submit", "survey_campaign", str(campaign.id), user=principal)
    else:
        db.execute(delete(SurveyDraft).where(SurveyDraft.campaign_id == campaign.id, SurveyDraft.invitation_code_id == principal.id))
        log_event(db, "anonymous_survey_submit", "survey_campaign", str(campaign.id), detail=f"invitation_id={principal.id}")
    db.commit()
    db.refresh(response)
    return {"campaign_id": campaign.id, "submitted": True, "submitted_at": response.submitted_at}


@app.post("/api/surveys/submit/anonymous", response_model=SurveyStatusOut)
def submit_anonymous_survey(payload: AnonymousSurveySubmit, db: Session = Depends(get_db)):
    campaign = db.get(SurveyCampaign, payload.campaign_id)
    if not campaign or not is_campaign_open(campaign):
        raise HTTPException(status_code=400, detail="Survey campaign is not open.")
    invitation = resolve_invitation(db, payload.campaign_id, payload.invitation_code)
    if invitation.used_at:
        raise HTTPException(status_code=409, detail="Invitation code has already been used.")
    validate_topic_coverage(db, payload.scores)
    response = SurveyResponse(
        campaign_id=campaign.id,
        invitation_code_id=invitation.id,
        stakeholder_group_id=invitation.stakeholder_group_id,
        open_answer=payload.open_answer,
    )
    db.add(response)
    db.flush()
    response.scores = score_models(response.id, payload.scores)
    invitation.used_at = datetime.now(timezone.utc)
    db.execute(delete(SurveyDraft).where(SurveyDraft.campaign_id == campaign.id, SurveyDraft.invitation_code_id == invitation.id))
    log_event(db, "anonymous_survey_submit", "survey_campaign", str(campaign.id), detail=f"invitation_id={invitation.id}")
    db.commit()
    db.refresh(response)
    return {"campaign_id": campaign.id, "submitted": True, "submitted_at": response.submitted_at}


def get_campaign_or_404(db: Session, campaign_id: int | None) -> SurveyCampaign:
    campaign = (
        db.get(SurveyCampaign, campaign_id)
        if campaign_id
        else db.scalar(select(SurveyCampaign).where(SurveyCampaign.status == "active").order_by(SurveyCampaign.year.desc()))
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="Survey campaign not found.")
    return campaign


@app.get("/api/analytics", response_model=AnalyticsOut)
def analytics(
    campaign_id: int | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return build_analytics(db, get_campaign_or_404(db, campaign_id))


@app.get("/api/reports/materiality.docx")
def download_report(
    campaign_id: int | None = None,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    campaign = get_campaign_or_404(db, campaign_id)
    report = create_materiality_report(build_analytics(db, campaign))
    log_event(db, "export_word", "survey_campaign", str(campaign.id), user=user)
    db.commit()
    filename = f"materiality-report-{campaign.year}.docx"
    return StreamingResponse(
        report,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/exports/responses.xlsx")
def download_excel(
    campaign_id: int | None = None,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    campaign = get_campaign_or_404(db, campaign_id)
    export = create_excel_export(db, campaign)
    log_event(db, "export_excel", "survey_campaign", str(campaign.id), user=user)
    db.commit()
    filename = f"materiality-export-{campaign.year}.xlsx"
    return StreamingResponse(
        export,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/exports/responses.csv")
def download_csv(
    campaign_id: int | None = None,
    anonymized: bool = False,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    campaign = get_campaign_or_404(db, campaign_id)
    export = create_csv_export(db, campaign, anonymized=anonymized)
    log_event(db, "export_csv", "survey_campaign", str(campaign.id), user=user, detail=f"anonymized={anonymized}")
    db.commit()
    filename = f"materiality-responses-{campaign.year}{'-anonymized' if anonymized else ''}.csv"
    return StreamingResponse(
        export,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
