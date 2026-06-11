from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class StakeholderGroup(Base):
    __tablename__ = "stakeholder_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    scope: Mapped[str] = mapped_column(String(20))
    description: Mapped[str | None] = mapped_column(String(255))

    users: Mapped[list["User"]] = relationship(back_populates="stakeholder_group")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="respondent")
    stakeholder_group_id: Mapped[int] = mapped_column(ForeignKey("stakeholder_groups.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    stakeholder_group: Mapped[StakeholderGroup] = relationship(back_populates="users")
    responses: Mapped[list["SurveyResponse"]] = relationship(back_populates="respondent")


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(20), index=True)
    name_zh: Mapped[str] = mapped_column(String(100))
    name_en: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class SurveyCampaign(Base):
    __tablename__ = "survey_campaigns"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    year: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="active")
    impact_threshold: Mapped[float] = mapped_column(Float, default=3.5)
    financial_threshold: Mapped[float] = mapped_column(Float, default=3.5)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    responses: Mapped[list["SurveyResponse"]] = relationship(back_populates="campaign")


class SurveyResponse(Base):
    __tablename__ = "survey_responses"
    __table_args__ = (
        UniqueConstraint("campaign_id", "respondent_id", name="uq_campaign_respondent"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("survey_campaigns.id"))
    respondent_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    open_answer: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    campaign: Mapped[SurveyCampaign] = relationship(back_populates="responses")
    respondent: Mapped[User] = relationship(back_populates="responses")
    scores: Mapped[list["TopicScore"]] = relationship(
        back_populates="response", cascade="all, delete-orphan"
    )


class TopicScore(Base):
    __tablename__ = "topic_scores"
    __table_args__ = (
        UniqueConstraint("response_id", "topic_id", name="uq_response_topic"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    response_id: Mapped[int] = mapped_column(ForeignKey("survey_responses.id"))
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"))
    organization_score: Mapped[int] = mapped_column(Integer)
    impact_score: Mapped[int] = mapped_column(Integer)
    financial_score: Mapped[int] = mapped_column(Integer)

    response: Mapped[SurveyResponse] = relationship(back_populates="scores")
    topic: Mapped[Topic] = relationship()
