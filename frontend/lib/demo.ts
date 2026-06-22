import type { Analytics, Campaign, StakeholderGroupAdmin, Topic, User } from "./types";

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const demoCampaign: Campaign = {
  id: 1,
  title: "2026 大學永續報告書重大性問卷",
  year: 2026,
  status: "active",
  is_open: true,
  impact_threshold: 3.5,
  financial_threshold: 3.5,
};

export const demoTopics: Topic[] = [
  { id: 1, code: "E01", category: "E", name_zh: "能源管理", name_en: "Energy Management", description: "校園能源使用、節能改善與再生能源規劃。", sort_order: 1 },
  { id: 2, code: "E02", category: "E", name_zh: "溫室氣體排放", name_en: "Greenhouse Gas Emissions", description: "溫室氣體盤查、減量目標與碳管理。", sort_order: 2 },
  { id: 3, code: "E03", category: "E", name_zh: "水資源管理", name_en: "Water Resources", description: "用水效率、回收水與校園水風險管理。", sort_order: 3 },
  { id: 4, code: "S01", category: "S", name_zh: "職業安全衛生", name_en: "Occupational Safety", description: "教職員工與承攬商安全衛生管理。", sort_order: 4 },
  { id: 5, code: "S02", category: "S", name_zh: "人才培育與發展", name_en: "Talent Development", description: "教學品質、學生能力培育與員工發展。", sort_order: 5 },
  { id: 6, code: "G01", category: "G", name_zh: "資訊安全與隱私", name_en: "Information Security and Privacy", description: "個資保護、資安治理與事件應變。", sort_order: 6 },
];

const demoScores = [
  [4.45, 4.72, 4.51],
  [4.31, 4.66, 4.28],
  [3.82, 4.06, 3.34],
  [4.08, 4.29, 4.11],
  [4.52, 4.58, 4.47],
  [4.39, 4.44, 4.63],
];

export const demoAnalytics: Analytics = {
  campaign: demoCampaign,
  response_count: 1250,
  stakeholder_count: 9,
  completion_rate: 83.6,
  topics: demoTopics.map((topic, index) => {
    const [organization, impact, financial] = demoScores[index];
    const highImpact = impact >= demoCampaign.impact_threshold;
    const highFinancial = financial >= demoCampaign.financial_threshold;
    return {
      topic_id: topic.id,
      code: topic.code,
      name: topic.name_zh,
      category: topic.category,
      organization,
      impact,
      financial,
      weighted_impact: impact + 0.03,
      weighted_financial: financial + 0.02,
      response_count: 1250,
      quadrant: highImpact && highFinancial ? "重大主題" : highImpact ? "揭露主題" : highFinancial ? "風險主題" : "觀察主題",
    };
  }),
  stakeholders: [
    { id: 1, name: "學生", count: 532, weight: 1.0 },
    { id: 2, name: "教師", count: 205, weight: 1.2 },
    { id: 3, name: "職員", count: 178, weight: 1.1 },
    { id: 4, name: "校友", count: 126, weight: 0.9 },
  ],
  stakeholder_topics: demoTopics.flatMap((topic, topicIndex) =>
    [
      { id: 1, name: "學生", delta: -0.08, count: 532 },
      { id: 2, name: "教師", delta: 0.12, count: 205 },
      { id: 3, name: "職員", delta: 0.04, count: 178 },
      { id: 4, name: "校友", delta: -0.03, count: 126 },
    ].map((group) => ({
      stakeholder_group_id: group.id,
      stakeholder_group_name: group.name,
      topic_id: topic.id,
      code: topic.code,
      impact: Math.min(5, Math.max(1, Number((demoScores[topicIndex][1] + group.delta).toFixed(2)))),
      financial: Math.min(5, Math.max(1, Number((demoScores[topicIndex][2] + group.delta).toFixed(2)))),
      response_count: group.count,
    })),
  ),
  keywords: [
    { keyword: "能源", count: 186 },
    { keyword: "人才", count: 153 },
    { keyword: "資安", count: 128 },
  ],
  analysis_zh:
    "AI 草稿，需人工審閱。示範資料顯示能源管理、人才培育與資訊安全同時具備較高衝擊與財務重大性，建議列為優先管理與揭露主題。",
  analysis_en:
    "AI draft, human review required. Demo data indicates that energy management, talent development and information security have high impact and financial materiality.",
};

export const demoStakeholderGroups: StakeholderGroupAdmin[] = [
  { id: 1, name: "學生", scope: "internal", description: "在學學生", weight: 1.0, is_active: true, response_count: 532 },
  { id: 2, name: "教師", scope: "internal", description: "專兼任教師", weight: 1.2, is_active: true, response_count: 205 },
  { id: 3, name: "職員", scope: "internal", description: "行政與技術人員", weight: 1.1, is_active: true, response_count: 178 },
  { id: 4, name: "校友", scope: "external", description: "畢業校友", weight: 0.9, is_active: true, response_count: 126 },
  { id: 5, name: "政府機關", scope: "external", description: "主管機關與地方政府", weight: 1.2, is_active: true, response_count: 35 },
  { id: 6, name: "企業", scope: "external", description: "企業夥伴", weight: 1.0, is_active: true, response_count: 74 },
  { id: 7, name: "廠商", scope: "external", description: "供應商與承攬商", weight: 0.9, is_active: true, response_count: 27 },
  { id: 8, name: "社區居民", scope: "external", description: "鄰近社區", weight: 1.0, is_active: true, response_count: 58 },
  { id: 9, name: "NGO", scope: "external", description: "非營利組織", weight: 1.1, is_active: true, response_count: 15 },
];

export function demoLogin(email: string, password: string): { access_token: string; user: User } | null {
  if (email === "admin@nuk.edu.tw" && password === "admin123") {
    return {
      access_token: "public-demo-admin",
      user: {
        id: 1,
        email,
        name: "示範管理者",
        role: "admin",
        stakeholder_group: { id: 1, name: "教師", scope: "internal", weight: 1.2 },
      },
    };
  }
  if (email === "student@nuk.edu.tw" && password === "survey123") {
    return {
      access_token: "public-demo-respondent",
      user: {
        id: 2,
        email,
        name: "示範填答者",
        role: "respondent",
        stakeholder_group: { id: 3, name: "學生", scope: "internal", weight: 1.0 },
      },
    };
  }
  return null;
}
