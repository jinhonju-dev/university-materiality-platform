import type { Analytics, Campaign, Topic, User } from "./types";

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const demoCampaign: Campaign = {
  id: 1,
  title: "2026 高雄大學雙重重大性評估",
  year: 2026,
  status: "active",
  impact_threshold: 3.5,
  financial_threshold: 3.5,
};

export const demoTopics: Topic[] = [
  { id: 1, code: "E01", category: "環境", name_zh: "能源管理", name_en: "Energy Management", description: "提升能源效率與再生能源使用", sort_order: 1 },
  { id: 2, code: "E02", category: "環境", name_zh: "溫室氣體排放", name_en: "Greenhouse Gas Emissions", description: "盤查與降低溫室氣體排放", sort_order: 2 },
  { id: 3, code: "E03", category: "環境", name_zh: "水資源", name_en: "Water Resources", description: "節水、回收與水風險管理", sort_order: 3 },
  { id: 4, code: "E04", category: "環境", name_zh: "廢棄物", name_en: "Waste Management", description: "源頭減量與資源循環", sort_order: 4 },
  { id: 5, code: "S01", category: "社會", name_zh: "職業安全", name_en: "Occupational Safety", description: "教職員工生健康與安全", sort_order: 5 },
  { id: 6, code: "S02", category: "社會", name_zh: "人才培育", name_en: "Talent Development", description: "教學品質、職能與生涯發展", sort_order: 6 },
  { id: 7, code: "S03", category: "社會", name_zh: "多元共融", name_en: "Diversity and Inclusion", description: "平等、尊重與友善校園", sort_order: 7 },
  { id: 8, code: "S04", category: "社會", name_zh: "社區參與", name_en: "Community Engagement", description: "在地連結與社會影響力", sort_order: 8 },
  { id: 9, code: "G01", category: "治理", name_zh: "資訊安全", name_en: "Information Security", description: "個資保護與資安韌性", sort_order: 9 },
  { id: 10, code: "G02", category: "治理", name_zh: "法遵", name_en: "Compliance", description: "法規遵循與風險管理", sort_order: 10 },
  { id: 11, code: "G03", category: "治理", name_zh: "誠信經營", name_en: "Integrity and Ethics", description: "誠信、透明與問責", sort_order: 11 },
];

const demoScores = [
  [4.45, 4.72, 4.51],
  [4.31, 4.66, 4.28],
  [3.82, 4.06, 3.34],
  [3.75, 4.12, 3.18],
  [4.08, 4.29, 4.11],
  [4.52, 4.58, 4.47],
  [4.13, 4.36, 3.72],
  [3.86, 4.18, 3.21],
  [4.39, 4.44, 4.63],
  [4.02, 3.86, 4.25],
  [4.21, 4.08, 4.19],
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
      response_count: 1250,
      quadrant: highImpact && highFinancial
        ? "重大主題"
        : highImpact
          ? "揭露主題"
          : highFinancial
            ? "風險主題"
            : "觀察主題",
    };
  }),
  stakeholders: [
    { name: "學生", count: 532 },
    { name: "教師", count: 205 },
    { name: "職員", count: 178 },
    { name: "校友", count: 126 },
    { name: "企業夥伴", count: 74 },
    { name: "社區居民", count: 58 },
    { name: "政府機關", count: 35 },
    { name: "廠商", count: 27 },
    { name: "NGO", count: 15 },
  ],
  keywords: [
    { keyword: "能源管理", count: 186 },
    { keyword: "人才培育", count: 153 },
    { keyword: "資訊安全", count: 128 },
    { keyword: "溫室氣體排放", count: 112 },
    { keyword: "多元共融", count: 76 },
  ],
  analysis_zh:
    "本次示範資料共彙整 1,250 份問卷，涵蓋九類利害關係人。分析顯示，能源管理、人才培育、資訊安全及溫室氣體排放同時具有高度衝擊與財務重大性，建議列為優先治理與揭露主題。",
  analysis_en:
    "This demonstration consolidates 1,250 responses from nine stakeholder groups. Energy management, talent development, information security and greenhouse gas emissions show high impact and financial materiality and should be prioritized for governance and disclosure.",
};

export function demoLogin(email: string, password: string): { access_token: string; user: User } | null {
  if (email === "admin@nuk.edu.tw" && password === "admin123") {
    return {
      access_token: "public-demo-admin",
      user: {
        id: 1,
        email,
        name: "永續辦公室管理者",
        role: "admin",
        stakeholder_group: { id: 1, name: "教師", scope: "校內" },
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
        stakeholder_group: { id: 3, name: "學生", scope: "校內" },
      },
    };
  }
  return null;
}

