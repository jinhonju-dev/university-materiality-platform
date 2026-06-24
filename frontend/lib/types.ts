export type StakeholderGroup = {
  id: number;
  code?: string;
  name: string;
  scope: string;
  description?: string | null;
  weight: number;
  is_active?: boolean;
  sort_order?: number;
};

export type StakeholderGroupAdmin = StakeholderGroup & {
  response_count: number;
};

export type User = {
  id: number;
  email: string;
  name: string;
  role: "super_admin" | "admin" | "reviewer" | "respondent";
  stakeholder_group: StakeholderGroup;
};

export type Topic = {
  id: number;
  code: string;
  topic_code?: string;
  category: "E" | "S" | "G" | string;
  name_zh: string;
  name_en: string;
  description: string | null;
  scenario_description?: string | null;
  gri_mapping?: string | null;
  sdgs_mapping?: string | null;
  responsible_unit?: string | null;
  management_approach?: string | null;
  kpi?: string | null;
  sort_order: number;
  is_active?: boolean;
};

export type TopicAdmin = Topic & {
  is_active: boolean;
};

export type Campaign = {
  id: number;
  title: string;
  name?: string;
  year: number;
  survey_type?: "concern" | "expert_materiality" | string;
  status: string;
  is_open: boolean;
  is_active?: boolean;
  impact_threshold: number;
  financial_threshold: number;
  materiality_threshold?: number;
  allow_public_response?: boolean;
  require_invitation_code?: boolean;
  description?: string | null;
  privacy_notice?: string | null;
};

export type CampaignAdmin = Campaign & {
  starts_at?: string | null;
  ends_at?: string | null;
  response_count: number;
  invitation_count: number;
  used_invitation_count: number;
};

export type InvitationCode = {
  id: number;
  campaign_id: number;
  code: string | null;
  code_prefix: string;
  stakeholder_group_id: number;
  stakeholder_group_name: string;
  label: string | null;
  evaluator_role?: string | null;
  survey_type: string;
  expires_at?: string | null;
  max_uses?: number;
  used_count?: number;
  is_active: boolean;
  used_at: string | null;
  revoked_at?: string | null;
  created_at: string;
};

export type PublicSurveyConfig = {
  app_mode: string;
  campaign: Campaign;
  topics: Topic[];
  stakeholder_groups: StakeholderGroup[];
};

export type ExpertSurveyScore = {
  topic_id: number;
  positive_likelihood_score?: number | null;
  positive_impact_magnitude_score?: number | null;
  negative_likelihood_score?: number | null;
  negative_impact_magnitude_score?: number | null;
  enrollment_revenue_score?: number | null;
  reputation_score?: number | null;
  operating_cost_score?: number | null;
  funding_score?: number | null;
  legal_responsibility_score?: number | null;
  financial_likelihood_score?: number | null;
};

export type TopicMetric = {
  topic_id: number;
  code: string;
  name: string;
  category: string;
  organization: number;
  impact: number;
  financial: number;
  weighted_impact: number;
  weighted_financial: number;
  concern_score: number;
  concern_response_count: number;
  impact_materiality_score: number;
  financial_materiality_score: number;
  unknown_ratio: number;
  is_final_material_topic: boolean;
  final_topic_reason?: string | null;
  manually_adjusted: boolean;
  response_count: number;
  quadrant: string;
};

export type Analytics = {
  campaign: Campaign;
  concern_campaign?: Campaign | null;
  expert_campaign?: Campaign | null;
  response_count: number;
  concern_response_count: number;
  expert_response_count: number;
  issued_invitation_count: number;
  used_invitation_count: number;
  stakeholder_count: number;
  completion_rate: number;
  topics: TopicMetric[];
  stakeholders: { id: number; name: string; count: number; weight: number }[];
  evaluator_roles: { evaluator_role: string; count: number }[];
  final_material_topics: TopicMetric[];
  unknown_ratio: number;
  threshold: number;
  stakeholder_topics: {
    stakeholder_group_id: number;
    stakeholder_group_name: string;
    topic_id: number;
    code: string;
    impact: number;
    financial: number;
    response_count: number;
  }[];
  keywords: { keyword: string; count: number }[];
  ai_analysis: AIAnalysisContent;
  analysis_zh: string;
  analysis_en: string;
};

export type AIAnalysisContent = {
  zh_summary: string;
  en_summary: string;
  concern_result_summary: string;
  impact_result_summary: string;
  financial_result_summary: string;
  material_topic_ranking: string;
  stakeholder_difference_analysis: string;
  management_recommendations: string;
  report_paragraph_zh: string;
  report_paragraph_en: string;
  gri_3_1: string;
  gri_3_2: string;
  gri_3_3: string;
  disclaimer: string;
};

export type AIAnalysisVersion = {
  id: number;
  campaign_id: number;
  version: number;
  model: string;
  prompt_version: string;
  input_hash: string;
  content: AIAnalysisContent;
  is_active: boolean;
  created_at: string;
};

export type SurveyScore = {
  topic_id: number;
  organization_score: number;
  actual_or_potential: "actual" | "potential";
  positive_or_negative: "positive" | "negative";
  scale_score: number;
  scope_score: number;
  remediability_score: number;
  impact_likelihood_score: number;
  risk_or_opportunity: "risk" | "opportunity";
  time_horizon: "short" | "medium" | "long";
  financial_magnitude_score: number;
  operational_resilience_score: number;
  financial_likelihood_score: number;
};
