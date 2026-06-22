export type StakeholderGroup = {
  id: number;
  name: string;
  scope: string;
  description?: string | null;
  weight: number;
  is_active?: boolean;
};

export type StakeholderGroupAdmin = StakeholderGroup & {
  response_count: number;
};

export type User = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "respondent";
  stakeholder_group: StakeholderGroup;
};

export type Topic = {
  id: number;
  code: string;
  category: "E" | "S" | "G" | string;
  name_zh: string;
  name_en: string;
  description: string | null;
  gri_mapping?: string | null;
  sdgs_mapping?: string | null;
  responsible_unit?: string | null;
  management_approach?: string | null;
  kpi?: string | null;
  sort_order: number;
};

export type Campaign = {
  id: number;
  title: string;
  year: number;
  status: string;
  is_open: boolean;
  impact_threshold: number;
  financial_threshold: number;
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
  response_count: number;
  quadrant: string;
};

export type Analytics = {
  campaign: Campaign;
  response_count: number;
  stakeholder_count: number;
  completion_rate: number;
  topics: TopicMetric[];
  stakeholders: { id: number; name: string; count: number; weight: number }[];
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
  analysis_zh: string;
  analysis_en: string;
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
