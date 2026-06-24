from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class StakeholderGroup(Base):
    __tablename__ = "stakeholder_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True, default="")
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    scope: Mapped[str] = mapped_column(String(20), default="internal")
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    users: Mapped[list["User"]] = relationship(back_populates="stakeholder_group")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="respondent")
    stakeholder_group_id: Mapped[int | None] = mapped_column(ForeignKey("stakeholder_groups.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    force_password_change: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    stakeholder_group: Mapped[StakeholderGroup] = relationship(back_populates="users")
    responses: Mapped[list["SurveyResponse"]] = relationship(back_populates="respondent")


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    topic_code: Mapped[str] = mapped_column(String(20), unique=True, index=True, default="")
    category: Mapped[str] = mapped_column(String(20), index=True)
    name_zh: Mapped[str] = mapped_column(String(100))
    name_en: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    scenario_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    gri_mapping: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sdgs_mapping: Mapped[str | None] = mapped_column(String(255), nullable=True)
    responsible_unit: Mapped[str | None] = mapped_column(String(120), nullable=True)
    management_approach: Mapped[str | None] = mapped_column(Text, nullable=True)
    kpi: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class SurveyCampaign(Base):
    __tablename__ = "survey_campaigns"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    name: Mapped[str] = mapped_column(String(160), default="")
    year: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="active")
    survey_type: Mapped[str] = mapped_column(String(40), default="concern")
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    impact_threshold: Mapped[float] = mapped_column(Float, default=3.5)
    financial_threshold: Mapped[float] = mapped_column(Float, default=3.5)
    materiality_threshold: Mapped[float] = mapped_column(Float, default=3.5)
    allow_public_response: Mapped[bool] = mapped_column(Boolean, default=True)
    require_invitation_code: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    privacy_notice: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    responses: Mapped[list["SurveyResponse"]] = relationship(back_populates="campaign")
    invitation_codes: Mapped[list["InvitationCode"]] = relationship(back_populates="campaign")


class InvitationCode(Base):
    __tablename__ = "invitation_codes"
    __table_args__ = (UniqueConstraint("campaign_id", "code_hash", name="uq_campaign_invitation_code_hash"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("survey_campaigns.id"))
    code_hash: Mapped[str] = mapped_column(String(64), index=True)
    code_prefix: Mapped[str] = mapped_column(String(16), index=True)
    stakeholder_group_id: Mapped[int] = mapped_column(ForeignKey("stakeholder_groups.id"))
    evaluator_role: Mapped[str | None] = mapped_column(String(80), nullable=True)
    label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    survey_type: Mapped[str] = mapped_column(String(30), default="expert_materiality")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    max_uses: Mapped[int] = mapped_column(Integer, default=1)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    campaign: Mapped[SurveyCampaign] = relationship(back_populates="invitation_codes")
    stakeholder_group: Mapped[StakeholderGroup] = relationship()
    response: Mapped["SurveyResponse | None"] = relationship(back_populates="invitation_code")


class ConcernSurveyResponse(Base):
    __tablename__ = "concern_responses"

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("survey_campaigns.id"))
    stakeholder_group_id: Mapped[int] = mapped_column(ForeignKey("stakeholder_groups.id"))
    open_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    campaign: Mapped[SurveyCampaign] = relationship()
    stakeholder_group: Mapped[StakeholderGroup] = relationship()
    scores: Mapped[list["ConcernSurveyScore"]] = relationship(back_populates="response", cascade="all, delete-orphan")


class ConcernSurveyScore(Base):
    __tablename__ = "concern_topic_scores"
    __table_args__ = (UniqueConstraint("response_id", "topic_id", name="uq_concern_response_topic"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    response_id: Mapped[int] = mapped_column(ForeignKey("concern_responses.id"))
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"))
    concern_score: Mapped[int] = mapped_column(Integer)

    response: Mapped[ConcernSurveyResponse] = relationship(back_populates="scores")
    topic: Mapped[Topic] = relationship()


class ExpertAssessmentResponse(Base):
    __tablename__ = "expert_assessment_responses"
    __table_args__ = (UniqueConstraint("campaign_id", "invitation_code_id", name="uq_expert_campaign_invitation"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("survey_campaigns.id"))
    invitation_code_id: Mapped[int] = mapped_column(ForeignKey("invitation_codes.id"))
    stakeholder_group_id: Mapped[int] = mapped_column(ForeignKey("stakeholder_groups.id"))
    open_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    campaign: Mapped[SurveyCampaign] = relationship()
    invitation_code: Mapped[InvitationCode] = relationship()
    stakeholder_group: Mapped[StakeholderGroup] = relationship()
    scores: Mapped[list["ExpertAssessmentScore"]] = relationship(back_populates="response", cascade="all, delete-orphan")


class ExpertAssessmentScore(Base):
    __tablename__ = "expert_topic_scores"
    __table_args__ = (UniqueConstraint("response_id", "topic_id", name="uq_expert_response_topic"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    response_id: Mapped[int] = mapped_column(ForeignKey("expert_assessment_responses.id"))
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"))
    positive_likelihood_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    positive_impact_magnitude_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    negative_likelihood_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    negative_impact_magnitude_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    enrollment_revenue_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    legal_responsibility_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    impact_likelihood_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    positive_impact_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    negative_impact_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    admissions_revenue_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reputation_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    operating_cost_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    funding_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    legal_liability_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    financial_likelihood_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    impact_score: Mapped[float] = mapped_column(Float, default=0)
    financial_score: Mapped[float] = mapped_column(Float, default=0)

    response: Mapped[ExpertAssessmentResponse] = relationship(back_populates="scores")
    topic: Mapped[Topic] = relationship()


class SurveyDraft(Base):
    __tablename__ = "survey_drafts"
    __table_args__ = (
        UniqueConstraint("campaign_id", "respondent_id", name="uq_draft_campaign_respondent"),
        UniqueConstraint("campaign_id", "invitation_code_id", name="uq_draft_campaign_invitation"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("survey_campaigns.id"))
    respondent_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    invitation_code_id: Mapped[int | None] = mapped_column(ForeignKey("invitation_codes.id"), nullable=True)
    payload_json: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class SurveyResponse(Base):
    __tablename__ = "survey_responses"
    __table_args__ = (
        UniqueConstraint("campaign_id", "respondent_id", name="uq_campaign_respondent"),
        UniqueConstraint("campaign_id", "invitation_code_id", name="uq_campaign_invitation"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("survey_campaigns.id"))
    respondent_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    invitation_code_id: Mapped[int | None] = mapped_column(ForeignKey("invitation_codes.id"), nullable=True)
    stakeholder_group_id: Mapped[int] = mapped_column(ForeignKey("stakeholder_groups.id"))
    open_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    campaign: Mapped[SurveyCampaign] = relationship(back_populates="responses")
    respondent: Mapped[User | None] = relationship(back_populates="responses")
    invitation_code: Mapped[InvitationCode | None] = relationship(back_populates="response")
    stakeholder_group: Mapped[StakeholderGroup] = relationship()
    scores: Mapped[list["TopicScore"]] = relationship(back_populates="response", cascade="all, delete-orphan")


class TopicScore(Base):
    __tablename__ = "topic_scores"
    __table_args__ = (UniqueConstraint("response_id", "topic_id", name="uq_response_topic"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    response_id: Mapped[int] = mapped_column(ForeignKey("survey_responses.id"))
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"))
    organization_score: Mapped[int] = mapped_column(Integer)

    actual_or_potential: Mapped[str] = mapped_column(String(20), default="actual")
    positive_or_negative: Mapped[str] = mapped_column(String(20), default="negative")
    scale_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scope_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    remediability_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    impact_likelihood_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    impact_score: Mapped[float] = mapped_column(Float)

    risk_or_opportunity: Mapped[str] = mapped_column(String(20), default="risk")
    time_horizon: Mapped[str] = mapped_column(String(20), default="medium")
    financial_magnitude_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    operational_resilience_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    financial_likelihood_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    financial_score: Mapped[float] = mapped_column(Float)

    response: Mapped[SurveyResponse] = relationship(back_populates="scores")
    topic: Mapped[Topic] = relationship()


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    resource_type: Mapped[str] = mapped_column(String(80))
    resource_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MaterialTopicOverride(Base):
    __tablename__ = "material_topic_overrides"
    __table_args__ = (UniqueConstraint("campaign_id", "topic_id", name="uq_material_override_campaign_topic"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("survey_campaigns.id"))
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"))
    is_material: Mapped[bool] = mapped_column(Boolean)
    reason: Mapped[str] = mapped_column(Text)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    campaign: Mapped[SurveyCampaign] = relationship()
    topic: Mapped[Topic] = relationship()
    created_by: Mapped[User | None] = relationship()


class AIAnalysisVersion(Base):
    __tablename__ = "ai_analysis_versions"
    __table_args__ = (UniqueConstraint("campaign_id", "version", name="uq_ai_analysis_campaign_version"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("survey_campaigns.id"))
    version: Mapped[int] = mapped_column(Integer)
    model: Mapped[str] = mapped_column(String(80))
    prompt_version: Mapped[str] = mapped_column(String(40), default="gri-v1")
    input_hash: Mapped[str] = mapped_column(String(64))
    content_json: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    campaign: Mapped[SurveyCampaign] = relationship()
    created_by: Mapped[User | None] = relationship()
