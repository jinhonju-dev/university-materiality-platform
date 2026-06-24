import type { AIAnalysisVersion, Analytics, Campaign, CampaignAdmin, InvitationCode, StakeholderGroupAdmin, Topic, TopicAdmin, User } from "./types";

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const demoCampaign: Campaign = {
  id: 1,
  title: "2026 大學永續雙重重大性評估",
  name: "2026 大學永續雙重重大性評估",
  year: 2026,
  survey_type: "expert_materiality",
  status: "active",
  is_open: true,
  is_active: true,
  impact_threshold: 3.5,
  financial_threshold: 3.5,
  materiality_threshold: 3.5,
  allow_public_response: false,
  require_invitation_code: true,
  privacy_notice: "展示模式資料僅供操作示範，不會永久保存。正式模式請勿於開放意見填入姓名、Email、電話或其他個人資料。",
};

export const demoTopics: Topic[] = [
  { id: 1, code: "E01", topic_code: "E01", category: "E", name_zh: "能源管理", name_en: "Energy Management", description: "提升能源效率、再生能源使用與校園節能治理。", scenario_description: "未來 3～5 年內，能源價格與淨零要求可能影響學校營運成本與聲譽。", sort_order: 1 },
  { id: 2, code: "E02", topic_code: "E02", category: "E", name_zh: "溫室氣體排放", name_en: "Greenhouse Gas Emissions", description: "盤查與管理範疇一、二及重要範疇三排放。", scenario_description: "碳盤查與減量成效可能影響補助、評鑑與利害關係人信任。", sort_order: 2 },
  { id: 3, code: "E03", topic_code: "E03", category: "E", name_zh: "水資源", name_en: "Water Resources", description: "校園用水效率、水風險與回收再利用管理。", scenario_description: "極端氣候與缺水風險可能影響校園營運韌性。", sort_order: 3 },
  { id: 4, code: "S01", topic_code: "S01", category: "S", name_zh: "職業安全", name_en: "Occupational Safety", description: "教職員工與學生於校園活動中的安全與健康。", scenario_description: "校園安全事件可能影響教學運作、法律責任與校譽。", sort_order: 4 },
  { id: 5, code: "S02", topic_code: "S02", category: "S", name_zh: "人才培育", name_en: "Talent Development", description: "教學品質、跨域能力與終身學習支持。", scenario_description: "人才培育成效直接影響招生、校友連結與大學社會責任。", sort_order: 5 },
  { id: 6, code: "G01", topic_code: "G01", category: "G", name_zh: "資訊安全", name_en: "Information Security and Privacy", description: "資通安全、個資保護與資料治理。", scenario_description: "資安事件可能造成服務中斷、個資外洩、法律責任與聲譽損失。", sort_order: 6 },
];

export const demoTopicAdmins: TopicAdmin[] = demoTopics.map((topic) => ({
  ...topic,
  gri_mapping: topic.code.startsWith("E") ? "GRI 302 / 305" : topic.code.startsWith("S") ? "GRI 403 / 404" : "GRI 418",
  sdgs_mapping: topic.code.startsWith("E") ? "SDG 7, 13" : topic.code.startsWith("S") ? "SDG 3, 4" : "SDG 16",
  responsible_unit: "永續發展辦公室",
  management_approach: "建立年度目標、管理程序與定期追蹤機制。",
  kpi: "年度改善率、事件數、教育訓練完成率或相關績效指標。",
  is_active: true,
}));

const demoScores = [
  [4.72, 4.51, 4.6],
  [4.66, 4.28, 4.3],
  [4.06, 3.34, 3.8],
  [4.29, 4.11, 4.1],
  [4.58, 4.47, 4.7],
  [4.44, 4.63, 4.2],
];

export const demoStakeholderGroups: StakeholderGroupAdmin[] = [
  { id: 1, code: "student", name: "學生", scope: "internal", description: "在校學生", weight: 1.0, is_active: true, sort_order: 1, response_count: 532 },
  { id: 2, code: "teacher", name: "教師", scope: "internal", description: "專任與兼任教師", weight: 1.2, is_active: true, sort_order: 2, response_count: 205 },
  { id: 3, code: "staff", name: "職員", scope: "internal", description: "行政與技術人員", weight: 1.1, is_active: true, sort_order: 3, response_count: 178 },
  { id: 4, code: "alumni", name: "校友", scope: "external", description: "畢業校友", weight: 0.9, is_active: true, sort_order: 4, response_count: 126 },
  { id: 5, code: "government", name: "政府機關", scope: "external", description: "主管機關與地方政府", weight: 1.1, is_active: true, sort_order: 5, response_count: 35 },
  { id: 6, code: "enterprise_vendor", name: "企業／廠商", scope: "external", description: "合作企業與供應商", weight: 1.0, is_active: true, sort_order: 6, response_count: 74 },
  { id: 7, code: "community", name: "社區居民", scope: "external", description: "鄰近社區居民", weight: 0.9, is_active: true, sort_order: 7, response_count: 27 },
  { id: 8, code: "ngo_association", name: "NGO／社團", scope: "external", description: "非營利組織與社團", weight: 1.0, is_active: true, sort_order: 8, response_count: 58 },
  { id: 9, code: "senior_manager", name: "一級主管", scope: "internal", description: "專家評估對象", weight: 1.3, is_active: true, sort_order: 9, response_count: 15 },
];

export const demoAIAnalysis = {
  zh_summary: "AI 草稿，需人工審閱。展示資料顯示能源管理、人才培育與資訊安全具有較高的衝擊重大性與財務重大性。",
  en_summary: "AI draft, human review required. Demo data indicates that energy management, talent development and information security have high impact and financial materiality.",
  concern_result_summary: "關注度調查顯示人才培育、能源管理與資訊安全為利害關係人高度關注議題。",
  impact_result_summary: "衝擊重大性以發生可能性乘以正負衝擊程度後取較高者。",
  financial_result_summary: "財務重大性以財務影響程度平均值乘以財務影響可能性計算。",
  material_topic_ranking: "展示排序顯示 E01 能源管理、S02 人才培育、G01 資訊安全為優先重大主題。",
  stakeholder_difference_analysis: "教師與主管對資訊安全及能源管理的財務風險評分較高；學生族群對人才培育與職業安全的關注較高。",
  management_recommendations: "建議將高重大性議題納入年度管理目標，建立 KPI、責任單位與定期追蹤機制。",
  report_paragraph_zh: "本次展示評估以衝擊重大性與財務重大性雙軸分析永續議題，初步辨識能源管理、人才培育與資訊安全為優先揭露主題。",
  report_paragraph_en: "The demo assessment applies impact and financial materiality axes and identifies energy management, talent development and information security as priority topics.",
  gri_3_1: "組織透過利害關係人關注度調查與專家雙重重大性評估，辨識與排序重大主題。",
  gri_3_2: "展示重大主題包含 E01 能源管理、S02 人才培育及 G01 資訊安全。",
  gri_3_3: "各重大主題將建立管理方針、責任單位、行動方案與績效指標。",
  disclaimer: "AI 草稿，需由管理者人工審閱後使用。",
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
  const highImpact = impact >= (demoCampaign.materiality_threshold || 3.5);
  const highFinancial = financial >= (demoCampaign.materiality_threshold || 3.5);
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
  issued_invitation_count: 50,
  used_invitation_count: 18,
  topics: demoTopics.map((topic, index) => {
    const [impact, financial, concern] = demoScores[index];
    const isFinal = impact >= (demoCampaign.materiality_threshold || 3.5) || financial >= (demoCampaign.materiality_threshold || 3.5);
    return {
      topic_id: topic.id,
      code: topic.code,
      name: topic.name_zh,
      category: topic.category,
      organization: 0,
      impact,
      financial,
      weighted_impact: Number((impact + 0.03).toFixed(2)),
      weighted_financial: Number((financial + 0.02).toFixed(2)),
      concern_score: concern,
      concern_response_count: 1250,
      impact_materiality_score: impact,
      financial_materiality_score: financial,
      unknown_ratio: 6.5 + index,
      is_final_material_topic: isFinal,
      final_topic_reason: isFinal ? "達到衝擊或財務重大性門檻" : null,
      manually_adjusted: false,
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
        impact: Math.min(5, Math.max(1, Number((demoScores[topicIndex][0] + delta).toFixed(2)))),
        financial: Math.min(5, Math.max(1, Number((demoScores[topicIndex][1] + delta).toFixed(2)))),
        response_count: group.response_count,
      };
    }),
  ),
  keywords: [
    { keyword: "能源管理", count: 186 },
    { keyword: "人才培育", count: 153 },
    { keyword: "資訊安全", count: 128 },
  ],
  ai_analysis: demoAIAnalysis,
  analysis_zh: demoAIAnalysis.zh_summary,
  analysis_en: demoAIAnalysis.en_summary,
  concern_campaign: { ...demoCampaign, id: 2, survey_type: "concern", title: "2026 大學永續關注度調查", name: "2026 大學永續關注度調查", allow_public_response: true, require_invitation_code: false },
  expert_campaign: demoCampaign,
  concern_response_count: 1250,
  expert_response_count: 50,
  evaluator_roles: [
    { evaluator_role: "一級主管", count: 18 },
    { evaluator_role: "學術單位主管", count: 16 },
    { evaluator_role: "專責人員", count: 16 },
  ],
  final_material_topics: [],
  unknown_ratio: 8.2,
  threshold: 3.5,
};

demoAnalytics.final_material_topics = demoAnalytics.topics.filter((topic) => topic.is_final_material_topic);

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
    code: null,
    code_prefix: "DEMO",
    stakeholder_group_id: 9,
    stakeholder_group_name: "一級主管",
    label: "Demo expert invitation",
    evaluator_role: "主管代表",
    survey_type: "expert_materiality",
    max_uses: 1,
    used_count: 0,
    is_active: true,
    used_at: null,
    revoked_at: null,
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
        name: "展示模式管理者",
        role: "super_admin",
        stakeholder_group: { id: 2, code: "teacher", name: "教師", scope: "internal", weight: 1.2 },
      },
    };
  }
  return null;
}
