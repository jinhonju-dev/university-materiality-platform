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


class TopicAdminOut(TopicOut):
    is_active: bool = True


class TopicCreate(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    category: Literal["E", "S", "G"]
    name_zh: str = Field(min_length=1, max_length=100)
    name_en: str = Field(min_length=1, max_length=120)
    description: str | None = None
    gri_mapping: str | None = Field(default=None, max_length=255)
    sdgs_mapping: str | None = Field(default=None, max_length=255)
    responsible_unit: str | None = Field(default=None, max_length=120)
    management_approach: str | None = None
    kpi: str | None = None
    sort_order: int = 0
    is_active: bool = True


class TopicUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=20)
    category: Literal["E", "S", "G"] | None = None
    name_zh: str | None = Field(default=None, min_length=1, max_length=100)
    name_en: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    gri_mapping: str | None = Field(default=None, max_length=255)
    sdgs_mapping: str | None = Field(default=None, max_length=255)
    responsible_unit: str | None = Field(default=None, max_length=120)
    management_approach: str | None = None
    kpi: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class CampaignOut(BaseModel):
    id: int
    title: str
    year: int
    status: str
    is_open: bool = True
    impact_threshold: float
    financial_threshold: float
    model_config = ConfigDict(from_attributes=True)


class CampaignAdminOut(CampaignOut):
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    response_count: int = 0
    invitation_count: int = 0
    used_invitation_count: int = 0


class CampaignCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    year: int = Field(ge=2000, le=2100)
    status: Literal["draft", "active", "closed"] = "draft"
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_open: bool = False
    impact_threshold: float = Field(default=3.5, ge=1, le=5)
    financial_threshold: float = Field(default=3.5, ge=1, le=5)


class CampaignUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    year: int | None = Field(default=None, ge=2000, le=2100)
    status: Literal["draft", "active", "closed"] | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_open: bool | None = None
    impact_threshold: float | None = Field(default=None, ge=1, le=5)
    financial_threshold: float | None = Field(default=None, ge=1, le=5)


class InvitationCodeOut(BaseModel):
    id: int
    campaign_id: int
    code: str
    stakeholder_group_id: int
    stakeholder_group_name: str
    label: str | None = None
    is_active: bool
    used_at: datetime | None = None
    created_at: datetime


class InvitationGenerateRequest(BaseModel):
    stakeholder_group_id: int
    count: int = Field(default=1, ge=1, le=500)
    label_prefix: str | None = Field(default=None, max_length=80)


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


class AIAnalysisContent(BaseModel):
    zh_summary: str
    en_summary: str
    material_topic_ranking: str
    stakeholder_difference_analysis: str
    management_recommendations: str
    report_paragraph_zh: str
    report_paragraph_en: str
    gri_3_1: str
    gri_3_2: str
    gri_3_3: str
    disclaimer: str


class AIAnalysisVersionOut(BaseModel):
    id: int
    campaign_id: int
    version: int
    model: str
    prompt_version: str
    input_hash: str
    content: AIAnalysisContent
    is_active: bool
    created_at: datetime


class AIAnalysisGenerateRequest(BaseModel):
    campaign_id: int | None = None
    overwrite_active: bool = True


class MaterialityReportRequest(BaseModel):
    campaign_id: int | None = None
    matrix_png_base64: str | None = Field(default=None, max_length=8_000_000)


class AnalyticsOut(BaseModel):
    campaign: CampaignOut
    response_count: int
    stakeholder_count: int
    completion_rate: float
    topics: list[TopicMetric]
    stakeholders: list[StakeholderMetric]
    stakeholder_topics: list[StakeholderTopicMetric]
    keywords: list[KeywordMetric]
    ai_analysis: AIAnalysisContent
    analysis_zh: str
    analysis_en: str
