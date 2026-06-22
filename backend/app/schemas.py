from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


Score1To5 = int


class StakeholderGroupOut(BaseModel):
    id: int
    name: str
    scope: str
    description: str | None = None
    weight: float = 1.0
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)


class StakeholderGroupAdminOut(StakeholderGroupOut):
    response_count: int = 0


class StakeholderGroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    scope: Literal["internal", "external"]
    description: str | None = Field(default=None, max_length=255)
    weight: float = Field(default=1.0, ge=0, le=10)
    is_active: bool = True


class StakeholderGroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    scope: Literal["internal", "external"] | None = None
    description: str | None = Field(default=None, max_length=255)
    weight: float | None = Field(default=None, ge=0, le=10)
    is_active: bool | None = None


class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str
    role: Literal["admin", "respondent"]
    stakeholder_group: StakeholderGroupOut
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class InviteLoginRequest(BaseModel):
    campaign_id: int
    invitation_code: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TopicOut(BaseModel):
    id: int
    code: str
    category: str
    name_zh: str
    name_en: str
    description: str | None
    gri_mapping: str | None = None
    sdgs_mapping: str | None = None
    responsible_unit: str | None = None
    management_approach: str | None = None
    kpi: str | None = None
    sort_order: int
    model_config = ConfigDict(from_attributes=True)


class CampaignOut(BaseModel):
    id: int
    title: str
    year: int
    status: str
    is_open: bool = True
    impact_threshold: float
    financial_threshold: float
    model_config = ConfigDict(from_attributes=True)


class ScoreInput(BaseModel):
    topic_id: int
    organization_score: int = Field(ge=1, le=5)

    actual_or_potential: Literal["actual", "potential"] = "actual"
    positive_or_negative: Literal["positive", "negative"] = "negative"
    scale_score: int | None = Field(default=None, ge=1, le=5)
    scope_score: int | None = Field(default=None, ge=1, le=5)
    remediability_score: int | None = Field(default=None, ge=1, le=5)
    impact_likelihood_score: int | None = Field(default=None, ge=1, le=5)
    impact_score: float | None = Field(default=None, ge=1, le=5)

    risk_or_opportunity: Literal["risk", "opportunity"] = "risk"
    time_horizon: Literal["short", "medium", "long"] = "medium"
    financial_magnitude_score: int | None = Field(default=None, ge=1, le=5)
    operational_resilience_score: int | None = Field(default=None, ge=1, le=5)
    financial_likelihood_score: int | None = Field(default=None, ge=1, le=5)
    financial_score: float | None = Field(default=None, ge=1, le=5)

    @field_validator("remediability_score")
    @classmethod
    def remediability_only_for_negative(cls, value: int | None, info):
        if info.data.get("positive_or_negative") == "negative" and value is None:
            return 3
        return value


class SurveySubmit(BaseModel):
    campaign_id: int
    scores: list[ScoreInput] = Field(min_length=1)
    open_answer: str | None = Field(default=None, max_length=2000)


class AnonymousSurveySubmit(SurveySubmit):
    invitation_code: str


class SurveyDraftIn(BaseModel):
    campaign_id: int
    payload: dict


class AnonymousSurveyDraftIn(SurveyDraftIn):
    invitation_code: str


class SurveyStatusOut(BaseModel):
    campaign_id: int
    submitted: bool
    submitted_at: datetime | None = None


class TopicMetric(BaseModel):
    topic_id: int
    code: str
    name: str
    category: str
    organization: float
    impact: float
    financial: float
    weighted_impact: float
    weighted_financial: float
    response_count: int
    quadrant: str


class StakeholderMetric(BaseModel):
    id: int
    name: str
    count: int
    weight: float


class StakeholderTopicMetric(BaseModel):
    stakeholder_group_id: int
    stakeholder_group_name: str
    topic_id: int
    code: str
    impact: float
    financial: float
    response_count: int


class KeywordMetric(BaseModel):
    keyword: str
    count: int


class AnalyticsOut(BaseModel):
    campaign: CampaignOut
    response_count: int
    stakeholder_count: int
    completion_rate: float
    topics: list[TopicMetric]
    stakeholders: list[StakeholderMetric]
    stakeholder_topics: list[StakeholderTopicMetric]
    keywords: list[KeywordMetric]
    analysis_zh: str
    analysis_en: str
