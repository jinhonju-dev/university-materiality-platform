from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


Score1To5 = int


class StakeholderGroupOut(BaseModel):
    id: int
    code: str = ""
    name: str
    scope: str
    description: str | None = None
    weight: float = 1.0
    is_active: bool = True
    sort_order: int = 0
    model_config = ConfigDict(from_attributes=True)


class StakeholderGroupAdminOut(StakeholderGroupOut):
    response_count: int = 0


class StakeholderGroupCreate(BaseModel):
    code: str | None = Field(default=None, max_length=40)
    name: str = Field(min_length=1, max_length=80)
    scope: Literal["internal", "external"] = "internal"
    description: str | None = Field(default=None, max_length=255)
    weight: float = Field(default=1.0, ge=0, le=10)
    is_active: bool = True
    sort_order: int = 0


class StakeholderGroupUpdate(BaseModel):
    code: str | None = Field(default=None, max_length=40)
    name: str | None = Field(default=None, min_length=1, max_length=80)
    scope: Literal["internal", "external"] | None = None
    description: str | None = Field(default=None, max_length=255)
    weight: float | None = Field(default=None, ge=0, le=10)
    is_active: bool | None = None
    sort_order: int | None = None


AdminRole = Literal["super_admin", "admin", "reviewer"]


class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str
    role: Literal["super_admin", "admin", "reviewer", "respondent"]
    stakeholder_group: StakeholderGroupOut
    model_config = ConfigDict(from_attributes=True)


class UserAdminOut(BaseModel):
    id: int
    email: EmailStr
    name: str
    role: Literal["super_admin", "admin", "reviewer", "respondent"]
    stakeholder_group_id: int | None = None
    is_active: bool
    last_login_at: datetime | None = None
    failed_login_count: int = 0
    locked_until: datetime | None = None
    force_password_change: bool = False
    created_by_user_id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class AdminUserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=12, max_length=128)
    role: AdminRole
    stakeholder_group_id: int


class AdminUserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    role: AdminRole | None = None
    stakeholder_group_id: int | None = None
    is_active: bool | None = None


class AdminPasswordReset(BaseModel):
    password: str = Field(min_length=12, max_length=128)


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
    topic_code: str = ""
    category: str
    name_zh: str
    name_en: str
    description: str | None
    scenario_description: str | None = None
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
    topic_code: str | None = Field(default=None, max_length=20)
    category: Literal["E", "S", "G"]
    name_zh: str = Field(min_length=1, max_length=100)
    name_en: str = Field(min_length=1, max_length=120)
    description: str | None = None
    scenario_description: str | None = None
    gri_mapping: str | None = Field(default=None, max_length=255)
    sdgs_mapping: str | None = Field(default=None, max_length=255)
    responsible_unit: str | None = Field(default=None, max_length=120)
    management_approach: str | None = None
    kpi: str | None = None
    sort_order: int = 0
    is_active: bool = True


class TopicUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=20)
    topic_code: str | None = Field(default=None, max_length=20)
    category: Literal["E", "S", "G"] | None = None
    name_zh: str | None = Field(default=None, min_length=1, max_length=100)
    name_en: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    scenario_description: str | None = None
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
    name: str = ""
    year: int
    survey_type: Literal["concern", "expert_materiality"] = "concern"
    status: str
    is_open: bool = True
    is_active: bool = True
    impact_threshold: float
    financial_threshold: float
    materiality_threshold: float = 3.5
    allow_public_response: bool = True
    require_invitation_code: bool = False
    description: str | None = None
    privacy_notice: str | None = None
    model_config = ConfigDict(from_attributes=True)


class CampaignAdminOut(CampaignOut):
    starts_at: datetime | None = None
    start_date: datetime | None = None
    ends_at: datetime | None = None
    end_date: datetime | None = None
    response_count: int = 0
    invitation_count: int = 0
    used_invitation_count: int = 0


class CampaignCreate(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    name: str | None = Field(default=None, max_length=160)
    year: int = Field(ge=2000, le=2100)
    survey_type: Literal["concern", "expert_materiality"] = "concern"
    status: Literal["draft", "active", "closed"] = "draft"
    starts_at: datetime | None = None
    start_date: datetime | None = None
    ends_at: datetime | None = None
    end_date: datetime | None = None
    is_open: bool = False
    is_active: bool = True
    impact_threshold: float = Field(default=3.5, ge=1, le=5)
    financial_threshold: float = Field(default=3.5, ge=1, le=5)
    materiality_threshold: float = Field(default=3.5, ge=1, le=5)
    allow_public_response: bool = True
    require_invitation_code: bool = False
    description: str | None = None
    privacy_notice: str | None = None

    @model_validator(mode="after")
    def require_name_or_title(self):
        if not self.name and not self.title:
            raise ValueError("name or title is required")
        return self


class CampaignUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    name: str | None = Field(default=None, min_length=1, max_length=160)
    year: int | None = Field(default=None, ge=2000, le=2100)
    survey_type: Literal["concern", "expert_materiality"] | None = None
    status: Literal["draft", "active", "closed"] | None = None
    starts_at: datetime | None = None
    start_date: datetime | None = None
    ends_at: datetime | None = None
    end_date: datetime | None = None
    is_open: bool | None = None
    is_active: bool | None = None
    impact_threshold: float | None = Field(default=None, ge=1, le=5)
    financial_threshold: float | None = Field(default=None, ge=1, le=5)
    materiality_threshold: float | None = Field(default=None, ge=1, le=5)
    allow_public_response: bool | None = None
    require_invitation_code: bool | None = None
    description: str | None = None
    privacy_notice: str | None = None


class InvitationCodeOut(BaseModel):
    id: int
    campaign_id: int
    code: str | None = None
    code_prefix: str
    stakeholder_group_id: int
    stakeholder_group_name: str
    label: str | None = None
    evaluator_role: str | None = None
    survey_type: str = "expert_materiality"
    expires_at: datetime | None = None
    max_uses: int = 1
    used_count: int = 0
    is_active: bool
    used_at: datetime | None = None
    revoked_at: datetime | None = None
    created_at: datetime


class InvitationGenerateRequest(BaseModel):
    stakeholder_group_id: int
    count: int = Field(default=1, ge=1, le=500)
    label_prefix: str | None = Field(default=None, max_length=80)
    evaluator_role: str | None = Field(default=None, max_length=80)
    expires_at: datetime | None = None
    max_uses: int = Field(default=1, ge=1, le=10)


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


class PublicSurveyConfig(BaseModel):
    app_mode: str
    campaign: CampaignOut
    topics: list[TopicOut]
    stakeholder_groups: list[StakeholderGroupOut]


class ConcernScoreInput(BaseModel):
    topic_id: int
    concern_score: int = Field(ge=1, le=5)


class ConcernSurveySubmit(BaseModel):
    campaign_id: int
    stakeholder_group_id: int
    scores: list[ConcernScoreInput] = Field(min_length=1)
    open_answer: str | None = Field(default=None, max_length=2000)


class ExpertScoreInput(BaseModel):
    topic_id: int
    positive_likelihood_score: int | None = Field(default=None, ge=1, le=5)
    positive_impact_magnitude_score: int | None = Field(default=None, ge=1, le=5)
    negative_likelihood_score: int | None = Field(default=None, ge=1, le=5)
    negative_impact_magnitude_score: int | None = Field(default=None, ge=1, le=5)
    enrollment_revenue_score: int | None = Field(default=None, ge=1, le=5)
    legal_responsibility_score: int | None = Field(default=None, ge=1, le=5)
    impact_likelihood_score: int | None = Field(default=None, ge=1, le=5)
    positive_impact_score: int | None = Field(default=None, ge=1, le=5)
    negative_impact_score: int | None = Field(default=None, ge=1, le=5)
    admissions_revenue_score: int | None = Field(default=None, ge=1, le=5)
    reputation_score: int | None = Field(default=None, ge=1, le=5)
    operating_cost_score: int | None = Field(default=None, ge=1, le=5)
    funding_score: int | None = Field(default=None, ge=1, le=5)
    legal_liability_score: int | None = Field(default=None, ge=1, le=5)
    financial_likelihood_score: int | None = Field(default=None, ge=1, le=5)


class ExpertSurveySubmit(BaseModel):
    campaign_id: int
    invitation_code: str
    scores: list[ExpertScoreInput] = Field(min_length=1)
    open_answer: str | None = Field(default=None, max_length=2000)


class PublicSurveySubmitOut(BaseModel):
    campaign_id: int
    submitted: bool
    submitted_at: datetime


class AuditLogOut(BaseModel):
    id: int
    actor_user_id: int | None
    action: str
    resource_type: str
    resource_id: str | None = None
    detail: str | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AuditLogPageOut(BaseModel):
    items: list[AuditLogOut]
    total: int
    page: int
    page_size: int


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
    concern_score: float = 0
    concern_response_count: int = 0
    impact_materiality_score: float = 0
    financial_materiality_score: float = 0
    unknown_ratio: float = 0
    is_final_material_topic: bool = False
    final_topic_reason: str | None = None
    manually_adjusted: bool = False
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


class RoleMetric(BaseModel):
    evaluator_role: str
    count: int


class MaterialTopicOverrideIn(BaseModel):
    campaign_id: int | None = None
    is_material: bool
    reason: str = Field(min_length=3, max_length=1000)


class KeywordMetric(BaseModel):
    keyword: str
    count: int


class AIAnalysisContent(BaseModel):
    zh_summary: str
    en_summary: str
    concern_result_summary: str = ""
    impact_result_summary: str = ""
    financial_result_summary: str = ""
    material_topic_ranking: str
    stakeholder_difference_analysis: str = ""
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
    matrix_png_base64: str | None = Field(default=None, max_length=2_000_000)


class AnalyticsOut(BaseModel):
    campaign: CampaignOut
    concern_campaign: CampaignOut | None = None
    expert_campaign: CampaignOut | None = None
    response_count: int
    concern_response_count: int = 0
    expert_response_count: int = 0
    issued_invitation_count: int = 0
    used_invitation_count: int = 0
    stakeholder_count: int
    completion_rate: float
    topics: list[TopicMetric]
    stakeholders: list[StakeholderMetric]
    evaluator_roles: list[RoleMetric] = []
    final_material_topics: list[TopicMetric] = []
    unknown_ratio: float = 0
    threshold: float = 3.5
    stakeholder_topics: list[StakeholderTopicMetric]
    keywords: list[KeywordMetric]
    ai_analysis: AIAnalysisContent
    analysis_zh: str
    analysis_en: str
