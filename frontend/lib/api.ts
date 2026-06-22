import { DEMO_MODE, demoAnalytics, demoCampaign, demoCampaigns, demoInvitations, demoLogin, demoStakeholderGroups, demoTopicAdmins, demoTopics } from "./demo";

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
      if (!result) throw new ApiError("示範帳號或密碼錯誤。", 401);
      return result as T;
    }
    if (path === "/topics") return demoTopics as T;
    if (path === "/admin/topics" && options.method === "POST") {
      const body = JSON.parse(String(options.body || "{}"));
      return { ...body, id: Date.now(), is_active: true } as T;
    }
    if (path === "/admin/topics") return demoTopicAdmins as T;
    if (path.startsWith("/admin/topics/")) {
      const id = Number(path.split("/").pop());
      const current = demoTopicAdmins.find((topic) => topic.id === id) || demoTopicAdmins[0];
      const updates = options.body ? JSON.parse(String(options.body)) : {};
      return { ...current, ...updates } as T;
    }
    if (path === "/campaigns/active") return demoCampaign as T;
    if (path === "/admin/campaigns" && options.method === "POST") {
      const body = JSON.parse(String(options.body || "{}"));
      return { ...demoCampaigns[0], ...body, id: Date.now(), response_count: 0, invitation_count: 0, used_invitation_count: 0 } as T;
    }
    if (path === "/admin/campaigns") return demoCampaigns as T;
    if (path.startsWith("/admin/campaigns/") && path.endsWith("/invitations") && options.method !== "POST") {
      return demoInvitations as T;
    }
    if (path.startsWith("/admin/campaigns/") && path.endsWith("/invitations") && options.method === "POST") {
      const body = JSON.parse(String(options.body || "{}"));
      return Array.from({ length: body.count || 1 }, (_, index) => ({
        ...demoInvitations[0],
        id: Date.now() + index,
        code: `DEMO-${index + 1}`.padEnd(10, "X"),
        stakeholder_group_id: body.stakeholder_group_id,
        label: `${body.label_prefix || "DEMO"}-${index + 1}`,
      })) as T;
    }
    if (path.startsWith("/admin/campaigns/")) {
      const id = Number(path.split("/")[3]);
      const current = demoCampaigns.find((campaign) => campaign.id === id) || demoCampaigns[0];
      const updates = options.body ? JSON.parse(String(options.body)) : {};
      return { ...current, ...updates } as T;
    }
    if (path === "/analytics") return demoAnalytics as T;
    if (path === "/admin/stakeholder-groups") return demoStakeholderGroups as T;
    if (path.startsWith("/admin/stakeholder-groups/")) {
      const id = Number(path.split("/").pop());
      const current = demoStakeholderGroups.find((group) => group.id === id) || demoStakeholderGroups[0];
      const updates = options.body ? JSON.parse(String(options.body)) : {};
      return { ...current, ...updates } as T;
    }
    if (path === "/surveys/submit" || path === "/surveys/submit/anonymous") {
      return {
        campaign_id: demoCampaign.id,
        submitted: true,
        submitted_at: new Date().toISOString(),
      } as T;
    }
    if (path === "/surveys/draft") return { saved: true } as T;
    throw new ApiError("Demo mode does not implement this endpoint.", 404);
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
    let message = "Request failed.";
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

async function downloadFile(token: string, url: string, filename: string) {
  if (DEMO_MODE) {
    const blob = new Blob(["Demo mode does not contain persisted export data."], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename.replace(/\.(xlsx|docx)$/i, ".txt");
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    return;
  }

  const response = await fetch(`${API_URL}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("下載失敗，請確認管理者權限與後端狀態。");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadReport(token: string, campaignId: number) {
  return downloadFile(token, `/reports/materiality.docx?campaign_id=${campaignId}`, `materiality-report-${campaignId}.docx`);
}

export async function downloadExcel(token: string, campaignId: number) {
  return downloadFile(token, `/exports/responses.xlsx?campaign_id=${campaignId}`, `materiality-export-${campaignId}.xlsx`);
}

export async function downloadCsv(token: string, campaignId: number, anonymized = false) {
  return downloadFile(
    token,
    `/exports/responses.csv?campaign_id=${campaignId}&anonymized=${anonymized ? "true" : "false"}`,
    `materiality-responses-${campaignId}${anonymized ? "-anonymized" : ""}.csv`,
  );
}

export function downloadMatrixPng(filename = "materiality-matrix.png") {
  const canvas = document.querySelector<HTMLCanvasElement>(".matrix-wrap canvas");
  if (!canvas) throw new Error("找不到矩陣圖。");
  const anchor = document.createElement("a");
  anchor.href = canvas.toDataURL("image/png");
  anchor.download = filename;
  anchor.click();
}
