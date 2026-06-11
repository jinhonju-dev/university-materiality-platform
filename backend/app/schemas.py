from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class StakeholderGroupOut(BaseModel):
    id: int
    name: str
    scope: str
    model_config = ConfigDict(from_attributes=True)


class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str
    role: str
    stakeholder_group: StakeholderGroupOut
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


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
    sort_order: int
    model_config = ConfigDict(from_attributes=True)


class CampaignOut(BaseModel):
    id: int
    title: str
    year: int
    status: str
    impact_threshold: float
    financial_threshold: float
    model_config = ConfigDict(from_attributes=True)


class ScoreInput(BaseModel):
    topic_id: int
    organization_score: int = Field(ge=1, le=5)
    impact_score: int = Field(ge=1, le=5)
    financial_score: int = Field(ge=1, le=5)


class SurveySubmit(BaseModel):
    campaign_id: int
    scores: list[ScoreInput] = Field(min_length=1)
    open_answer: str | None = Field(default=None, max_length=2000)


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
    response_count: int
    quadrant: str


class StakeholderMetric(BaseModel):
    name: str
    count: int


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
    keywords: list[KeywordMetric]
    analysis_zh: str
    analysis_en: str

