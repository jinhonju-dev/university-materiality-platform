import type { AIAnalysisVersion, Analytics, Campaign, CampaignAdmin, InvitationCode, StakeholderGroupAdmin, Topic, TopicAdmin, User } from "./types";

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const demoCampaign: Campaign = {
  id: 1,
  title: "2026 大學永續報告書利害關係人問卷",
  year: 2026,
  status: "active",
  is_open: true,
  impact_threshold: 3.5,
  financial_threshold: 3.5,
};

export const demoTopics: Topic[] = [
  { id: 1, code: "E01", category: "E", name_zh: "能源管理", name_en: "Energy Management", description: "校園能源使用、節能措施、再生能源採購與用電效率管理。", sort_order: 1 },
  { id: 2, code: "E02", category: "E", name_zh: "溫室氣體排放", name_en: "Greenhouse Gas Emissions", description: "溫室氣體盤查、減碳目標、排放管理與氣候行動。", sort_order: 2 },
  { id: 3, code: "E03", category: "E", name_zh: "水資源", name_en: "Water Resources", description: "用水效率、水回收、節水措施與水資源風險管理。", sort_order: 3 },
  { id: 4, code: "S01", category: "S", name_zh: "職業安全衛生", name_en: "Occupational Safety", description: "教職員工與學生之校園安全、實驗安全及健康促進。", sort_order: 4 },
  { id: 5, code: "S02", category: "S", name_zh: "人才培育與學習發展", name_en: "Talent Development", description: "學生學習、教師專業發展、跨域能力與永續教育。", sort_order: 5 },
  { id: 6, code: "G01", category: "G", name_zh: "資訊安全與隱私", name_en: "Information Security and Privacy", description: "資安治理、個資保護、系統韌性與資料安全。", sort_order: 6 },
];

export const demoTopicAdmins: TopicAdmin[] = demoTopics.map((topic) => ({
  ...topic,
  gri_mapping: topic.code.startsWith("E") ? "GRI 302 / 305" : topic.code.startsWith("S") ? "GRI 401 / 403" : "GRI 2 / 3",
  sdgs_mapping: topic.code.startsWith("E") ? "SDG 7, 13" : topic.code.startsWith("S") ? "SDG 4, 8" : "SDG 16",
  responsible_unit: "永續發展辦公室",
  management_approach: "每年檢視重大主題、管理方針、年度目標與 KPI。",
  kpi: "年度改善目標與追蹤指標",
  is_active: true,
}));

const demoScores = [
  [4.45, 4.72, 4.51],
  [4.31, 4.66, 4.28],
  [3.82, 4.06, 3.34],
  [4.08, 4.29, 4.11],
  [4.52, 4.58, 4.47],
  [4.39, 4.44, 4.63],
];

export const demoStakeholderGroups: StakeholderGroupAdmin[] = [
  { id: 1, name: "學生", scope: "internal", description: "在學學生", weight: 1.0, is_active: true, response_count: 532 },
  { id: 2, name: "教師", scope: "internal", description: "專任與兼任教師", weight: 1.2, is_active: true, response_count: 205 },
  { id: 3, name: "職員", scope: "internal", description: "行政與校務人員", weight: 1.1, is_active: true, response_count: 178 },
  { id: 4, name: "校友", scope: "external", description: "畢業校友", weight: 0.9, is_active: true, response_count: 126 },
  { id: 5, name: "政府機關", scope: "external", description: "主管機關與地方政府", weight: 1.2, is_active: true, response_count: 35 },
  { id: 6, name: "企業", scope: "external", description: "企業夥伴", weight: 1.0, is_active: true, response_count: 74 },
  { id: 7, name: "廠商", scope: "external", description: "供應商與合作廠商", weight: 0.9, is_active: true, response_count: 27 },
  { id: 8, name: "社區居民", scope: "external", description: "周邊社區", weight: 1.0, is_active: true, response_count: 58 },
  { id: 9, name: "NGO", scope: "external", description: "非政府組織", weight: 1.1, is_active: true, response_count: 15 },
];

export const demoAIAnalysis = {
  zh_summary: "AI 草稿，需人工審閱。示範資料顯示，能源管理、人才培育與資訊安全同時具有較高衝擊重大性與財務重大性。",
  en_summary: "AI draft, human review required. Demo data indicates that energy management, talent development and information security have high impact and financial materiality.",
  material_topic_ranking: "重大主題排序建議：1. E01 能源管理；2. S02 人才培育與學習發展；3. G01 資訊安全與隱私。",
  stakeholder_difference_analysis: "教師與政府機關對治理與氣候相關議題評分較高；學生對人才培育與學習發展較敏感。",
  management_recommendations: "建議由責任單位確認各重大主題之管理方針、年度目標、KPI、改善措施與追蹤頻率。",
  report_paragraph_zh: "AI 草稿，需人工審閱。本次示範評估依利害關係人回饋與雙重重大性門檻，辨識能源管理、人才培育與資訊安全為優先重大主題。",
  report_paragraph_en: "AI draft, human review required. The demo assessment identifies energy management, talent development and information security as priority material topics.",
  gri_3_1: "本校透過利害關係人識別、議題庫建立、問卷評分、衝擊重大性與財務重大性分析、權重設定及管理者審閱，決定年度重大主題。",
  gri_3_2: "依本次示範評估結果，重大主題包含：E01 能源管理、S02 人才培育與學習發展、G01 資訊安全與隱私。",
  gri_3_3: "各重大主題須由責任單位確認管理方針、政策承諾、行動方案、有效性追蹤、指標與目標，並於報告書揭露。",
  disclaimer: "AI 草稿，需人工審閱。",
};

export const demoAIAnalysisVersion: AIAnalysisVersion = {
  id: 1,
  campaign_id: 1,
  version: 1,
  model: "demo-fallback",
  prompt_version: "gri-v1",
  input_hash: "demo",
  content: demoAIAnalysis,
  is_active: true,
  created_at: "2026-08-01T00:00:00+08:00",
};

function quadrant(impact: number, financial: number) {
  const highImpact = impact >= demoCampaign.impact_threshold;
  const highFinancial = financial >= demoCampaign.financial_threshold;
  if (highImpact && highFinancial) return "重大主題";
  if (highImpact) return "揭露主題";
  if (highFinancial) return "風險主題";
  return "觀察主題";
}

export const demoAnalytics: Analytics = {
  campaign: demoCampaign,
  response_count: 1250,
  stakeholder_count: 9,
  completion_rate: 83.6,
  topics: demoTopics.map((topic, index) => {
    const [organization, impact, financial] = demoScores[index];
    return {
      topic_id: topic.id,
      code: topic.code,
      name: topic.name_zh,
      category: topic.category,
      organization,
      impact,
      financial,
      weighted_impact: Number((impact + 0.03).toFixed(2)),
      weighted_financial: Number((financial + 0.02).toFixed(2)),
      response_count: 1250,
      quadrant: quadrant(impact, financial),
    };
  }),
  stakeholders: demoStakeholderGroups.map((group) => ({ id: group.id, name: group.name, count: group.response_count, weight: group.weight })),
  stakeholder_topics: demoTopics.flatMap((topic, topicIndex) =>
    demoStakeholderGroups.slice(0, 4).map((group, groupIndex) => {
      const delta = [-0.08, 0.12, 0.04, -0.03][groupIndex] || 0;
      return {
        stakeholder_group_id: group.id,
        stakeholder_group_name: group.name,
        topic_id: topic.id,
        code: topic.code,
        impact: Math.min(5, Math.max(1, Number((demoScores[topicIndex][1] + delta).toFixed(2)))),
        financial: Math.min(5, Math.max(1, Number((demoScores[topicIndex][2] + delta).toFixed(2)))),
        response_count: group.response_count,
      };
    }),
  ),
  keywords: [
    { keyword: "能源", count: 186 },
    { keyword: "人才培育", count: 153 },
    { keyword: "資訊安全", count: 128 },
  ],
  ai_analysis: demoAIAnalysis,
  analysis_zh: demoAIAnalysis.zh_summary,
  analysis_en: demoAIAnalysis.en_summary,
};

export const demoCampaigns: CampaignAdmin[] = [
  {
    ...demoCampaign,
    starts_at: "2026-08-01T00:00:00+08:00",
    ends_at: "2026-09-30T23:59:59+08:00",
    response_count: 1250,
    invitation_count: 50,
    used_invitation_count: 18,
  },
];

export const demoInvitations: InvitationCode[] = [
  {
    id: 1,
    campaign_id: 1,
    code: "DEMO-EXPERT",
    stakeholder_group_id: 2,
    stakeholder_group_name: "教師",
    label: "Demo expert invitation",
    survey_type: "expert",
    is_active: true,
    used_at: null,
    created_at: "2026-08-01T00:00:00+08:00",
  },
];

export function demoLogin(email: string, password: string): { access_token: string; user: User } | null {
  if (email === "admin@nuk.edu.tw" && password === "admin123") {
    return {
      access_token: "public-demo-admin",
      user: {
        id: 1,
        email,
        name: "示範管理者",
        role: "super_admin",
        stakeholder_group: { id: 2, name: "教師", scope: "internal", weight: 1.2 },
      },
    };
  }
  return null;
}
