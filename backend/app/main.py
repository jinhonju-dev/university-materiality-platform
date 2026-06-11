from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .analytics import build_analytics
from .config import get_settings
from .database import Base, SessionLocal, engine, get_db
from .models import SurveyCampaign, SurveyResponse, Topic, TopicScore, User
from .report import create_materiality_report
from .schemas import (
    AnalyticsOut,
    CampaignOut,
    LoginRequest,
    SurveyStatusOut,
    SurveySubmit,
    TokenOut,
    TopicOut,
    UserOut,
)
from .security import (
    create_access_token,
    get_current_user,
    require_admin,
    verify_password,
)
from .seed import seed_database


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_database(db)
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": settings.app_name}


@app.post("/api/auth/login", response_model=TokenOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    return {
        "access_token": create_access_token(user.id),
        "user": user,
    }


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@app.get("/api/topics", response_model=list[TopicOut])
def list_topics(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Topic).where(Topic.is_active.is_(True)).order_by(Topic.sort_order)
    ).all()


@app.get("/api/campaigns/active", response_model=CampaignOut)
def active_campaign(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    campaign = db.scalar(
        select(SurveyCampaign)
        .where(SurveyCampaign.status == "active")
        .order_by(SurveyCampaign.year.desc())
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="目前沒有進行中的問卷")
    return campaign


@app.get("/api/surveys/{campaign_id}/status", response_model=SurveyStatusOut)
def survey_status(
    campaign_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response = db.scalar(
        select(SurveyResponse).where(
            SurveyResponse.campaign_id == campaign_id,
            SurveyResponse.respondent_id == user.id,
        )
    )
    return {
        "campaign_id": campaign_id,
        "submitted": response is not None,
        "submitted_at": response.submitted_at if response else None,
    }


@app.post("/api/surveys/submit", response_model=SurveyStatusOut)
def submit_survey(
    payload: SurveySubmit,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    campaign = db.get(SurveyCampaign, payload.campaign_id)
    if not campaign or campaign.status != "active":
        raise HTTPException(status_code=400, detail="問卷未開放")
    topic_ids = set(
        db.scalars(select(Topic.id).where(Topic.is_active.is_(True))).all()
    )
    submitted_ids = {score.topic_id for score in payload.scores}
    if submitted_ids != topic_ids:
        raise HTTPException(status_code=422, detail="請完成所有議題評分")

    response = db.scalar(
        select(SurveyResponse).where(
            SurveyResponse.campaign_id == campaign.id,
            SurveyResponse.respondent_id == user.id,
        )
    )
    if response:
        db.execute(delete(TopicScore).where(TopicScore.response_id == response.id))
        response.open_answer = payload.open_answer
    else:
        response = SurveyResponse(
            campaign_id=campaign.id,
            respondent_id=user.id,
            open_answer=payload.open_answer,
        )
        db.add(response)
        db.flush()

    response.scores = [
        TopicScore(
            topic_id=score.topic_id,
            organization_score=score.organization_score,
            impact_score=score.impact_score,
            financial_score=score.financial_score,
        )
        for score in payload.scores
    ]
    db.commit()
    db.refresh(response)
    return {
        "campaign_id": campaign.id,
        "submitted": True,
        "submitted_at": response.submitted_at,
    }


def get_campaign_or_404(db: Session, campaign_id: int | None) -> SurveyCampaign:
    campaign = (
        db.get(SurveyCampaign, campaign_id)
        if campaign_id
        else db.scalar(
            select(SurveyCampaign)
            .where(SurveyCampaign.status == "active")
            .order_by(SurveyCampaign.year.desc())
        )
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="找不到評估活動")
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
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    campaign = get_campaign_or_404(db, campaign_id)
    report = create_materiality_report(build_analytics(db, campaign))
    filename = f"materiality-report-{campaign.year}.docx"
    return StreamingResponse(
        report,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

