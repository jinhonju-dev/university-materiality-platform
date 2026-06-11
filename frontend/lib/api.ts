import { DEMO_MODE, demoAnalytics, demoCampaign, demoLogin, demoTopics } from "./demo";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  if (DEMO_MODE) {
    if (path === "/auth/login") {
      const credentials = JSON.parse(String(options.body || "{}"));
      const result = demoLogin(credentials.email, credentials.password);
      if (!result) throw new ApiError("展示帳號或密碼錯誤", 401);
      return result as T;
    }
    if (path === "/topics") return demoTopics as T;
    if (path === "/campaigns/active") return demoCampaign as T;
    if (path === "/analytics") return demoAnalytics as T;
    if (path === "/surveys/submit") {
      return {
        campaign_id: demoCampaign.id,
        submitted: true,
        submitted_at: new Date().toISOString(),
      } as T;
    }
    throw new ApiError("此功能未包含於公開展示版", 404);
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    let message = "系統暫時無法處理此要求";
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {
      // Keep the fallback message for non-JSON responses.
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export async function downloadReport(token: string, campaignId: number) {
  if (DEMO_MODE) {
    const rows = demoAnalytics.topics.map((topic) => (
      `<tr><td>${topic.name}</td><td>${topic.category}</td><td>${topic.organization.toFixed(2)}</td>` +
      `<td>${topic.impact.toFixed(2)}</td><td>${topic.financial.toFixed(2)}</td><td>${topic.quadrant}</td></tr>`
    )).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>雙重重大性評估報告</title>
      <style>body{font-family:"Microsoft JhengHei",sans-serif;line-height:1.7;padding:40px;color:#19352a}
      table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd8d1;padding:8px;text-align:left}
      th{background:#e8f5ee}h1,h2{color:#177854}</style></head><body>
      <h1>高雄大學雙重重大性評估報告</h1><h2>2.3 利害關係人溝通</h2>
      <p>本示範共彙整 ${demoAnalytics.response_count.toLocaleString()} 份問卷，涵蓋 ${demoAnalytics.stakeholder_count} 類利害關係人。</p>
      <h2>2.4 重大主題分析</h2><p>${demoAnalytics.analysis_zh}</p>
      <table><thead><tr><th>議題</th><th>類別</th><th>組織影響</th><th>衝擊重大性</th><th>財務重大性</th><th>判定</th></tr></thead>
      <tbody>${rows}</tbody></table><h2>2.5 雙重重大性評估</h2>
      <p>本評估同步考量組織對環境與社會的衝擊，以及永續議題對財務與營運的影響。</p>
      <h2>English Summary</h2><p>${demoAnalytics.analysis_en}</p></body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `雙重重大性評估報告-${demoCampaign.year}.doc`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const response = await fetch(
    `${API_URL}/reports/materiality.docx?campaign_id=${campaignId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error("報告產生失敗");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `雙重重大性評估報告-${new Date().getFullYear()}.docx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
