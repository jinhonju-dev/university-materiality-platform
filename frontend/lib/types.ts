export type StakeholderGroup = {
  id: number;
  name: string;
  scope: string;
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
  category: string;
  name_zh: string;
  name_en: string;
  description: string | null;
  sort_order: number;
};

export type Campaign = {
  id: number;
  title: string;
  year: number;
  status: string;
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
  response_count: number;
  quadrant: string;
};

export type Analytics = {
  campaign: Campaign;
  response_count: number;
  stakeholder_count: number;
  completion_rate: number;
  topics: TopicMetric[];
  stakeholders: { name: string; count: number }[];
  keywords: { keyword: string; count: number }[];
  analysis_zh: string;
  analysis_en: string;
};

