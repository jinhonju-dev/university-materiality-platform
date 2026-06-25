import { DEMO_MODE, demoAIAnalysisVersion, demoAnalytics, demoCampaign, demoCampaigns, demoInvitations, demoLogin, demoStakeholderGroups, demoTopicAdmins, demoTopics } from "./demo";

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || "";

function apiRoot() {
  return RAW_API_URL.replace(/\/+$/, "").replace(/\/api$/, "");
}

export function apiUrl(path: string) {
  if (!RAW_API_URL) {
    throw new ApiError("NEXT_PUBLIC_API_URL is not configured for Production Mode.", 500, undefined, "config");
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (normalizedPath === "/health") return `${apiRoot()}/health`;
  return `${apiRoot()}/api${normalizedPath}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public url?: string,
    public kind: "http" | "network" | "config" = "http",
  ) {
    super(message);
  }

  get isAuthExpired() {
    return this.status === 401;
  }

  get isNetworkOrCorsError() {
    return this.kind === "network";
  }
}

function networkApiError(caught: unknown, url: string) {
  const original = caught instanceof Error ? caught.message : String(caught);
  return new ApiError(
    [
      "Network request failed.",
      `API URL: ${url}`,
      "HTTP status: unavailable",
      "Likely cause: CORS blocked the request, the Render service is sleeping/down, or the browser cannot reach the API.",
      `Original error: ${original}`,
    ].join("\n"),
    0,
    url,
    "network",
  );
}

function httpApiError(message: string, status: number, url: string) {
  const details = [
    message,
    `API URL: ${url}`,
    `HTTP status: ${status}`,
  ];
  if (status === 401) details.push("Likely cause: token expired or login session is invalid. Please log out and sign in again.");
  if (status === 403) details.push("Likely cause: this account does not have permission for the requested admin API.");
  if (status >= 500) details.push("Likely cause: backend server error. Check Render logs.");
  return new ApiError(details.join("\n"), status, url, "http");
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
      if (!result) throw new ApiError("Demo login failed.", 401);
      return result as T;
    }
    if (path === "/topics") return demoTopics as T;
    if (path === "/system/mode") return { mode: "demo", demo: true } as T;
    if (path === "/public/survey-config" || path === "/surveys/concern/current" || path === "/surveys/expert/current") {
      return {
        app_mode: "demo",
        campaign: demoCampaign,
        topics: demoTopics,
        stakeholder_groups: demoStakeholderGroups,
      } as T;
    }
    if (path === "/admin/topics" && options.method === "POST") {
      const body = JSON.parse(String(options.body || "{}"));
      return { ...body, id: Date.now(), code: body.code || body.topic_code, topic_code: body.topic_code || body.code, is_active: true } as T;
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
    if (path.startsWith("/admin/campaigns/") && (path.endsWith("/invitations") || path.endsWith("/invitation-codes")) && options.method !== "POST") {
      return demoInvitations as T;
    }
    if (path.startsWith("/admin/campaigns/") && (path.endsWith("/invitations") || path.endsWith("/invitation-codes")) && options.method === "POST") {
      const body = JSON.parse(String(options.body || "{}"));
      return Array.from({ length: body.count || 1 }, (_, index) => ({
        ...demoInvitations[0],
        id: Date.now() + index,
        code: `DEMO-${index + 1}`.padEnd(10, "X"),
        code_prefix: "DEMO",
        stakeholder_group_id: body.stakeholder_group_id,
        label: `${body.label_prefix || "DEMO"}-${index + 1}`,
      })) as T;
    }
    if (path.startsWith("/admin/invitation-codes/") && path.endsWith("/revoke")) {
      return { ...demoInvitations[0], is_active: false, revoked_at: new Date().toISOString() } as T;
    }
    if (path.startsWith("/admin/campaigns/")) {
      const id = Number(path.split("/")[3]);
      const current = demoCampaigns.find((campaign) => campaign.id === id) || demoCampaigns[0];
      const updates = options.body ? JSON.parse(String(options.body)) : {};
      return { ...current, ...updates } as T;
    }
    if (path === "/analytics") return demoAnalytics as T;
    if (path.startsWith("/admin/material-topics/") && path.endsWith("/override")) {
      const body = JSON.parse(String(options.body || "{}"));
      return {
        ...demoAnalytics,
        topics: demoAnalytics.topics.map((topic) => topic.topic_id === Number(path.split("/")[3])
          ? { ...topic, is_final_material_topic: body.is_material, manually_adjusted: true, final_topic_reason: body.reason }
          : topic),
      } as T;
    }
    if (path === "/admin/ai-analyses") return [demoAIAnalysisVersion] as T;
    if (path === "/admin/ai-analyses/latest") return demoAIAnalysisVersion as T;
    if (path === "/admin/ai-analyses/generate") {
      return { ...demoAIAnalysisVersion, id: Date.now(), version: demoAIAnalysisVersion.version + 1, created_at: new Date().toISOString() } as T;
    }
    if (path === "/admin/stakeholder-groups") return demoStakeholderGroups as T;
    if (path.startsWith("/admin/stakeholder-groups/")) {
      const id = Number(path.split("/").pop());
      const current = demoStakeholderGroups.find((group) => group.id === id) || demoStakeholderGroups[0];
      const updates = options.body ? JSON.parse(String(options.body)) : {};
      return { ...current, ...updates } as T;
    }
    if (path === "/surveys/submit" || path === "/surveys/submit/anonymous" || path === "/surveys/concern" || path === "/surveys/concern/submit" || path === "/surveys/expert" || path === "/surveys/expert/submit") {
      return {
        campaign_id: demoCampaign.id,
        submitted: true,
        submitted_at: new Date().toISOString(),
      } as T;
    }
    if (path === "/surveys/draft" || path === "/surveys/expert/draft") return { saved: true } as T;
    throw new ApiError("Demo mode does not implement this endpoint.", 404);
  }

  const requestUrl = apiUrl(path);
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (caught) {
    throw networkApiError(caught, requestUrl);
  }
  if (!response.ok) {
    let message = "Request failed.";
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {
      // Keep the fallback message for non-JSON responses.
    }
    throw httpApiError(message, response.status, requestUrl);
  }
  return response.json() as Promise<T>;
}

async function downloadFile(token: string, url: string, filename: string, options: RequestInit = {}) {
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

  const requestUrl = apiUrl(url);
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch (caught) {
    throw networkApiError(caught, requestUrl);
  }
  if (!response.ok) throw httpApiError("File download failed.", response.status, requestUrl);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadReport(token: string, campaignId: number) {
  const canvas = document.querySelector<HTMLCanvasElement>(".matrix-wrap canvas");
  const matrixImage = canvas?.toDataURL("image/png");
  if (!matrixImage) {
    return downloadFile(token, `/reports/materiality.docx?campaign_id=${campaignId}`, `materiality-report-${campaignId}.docx`);
  }
  return downloadFile(token, "/reports/materiality.docx", `materiality-report-${campaignId}.docx`, {
    method: "POST",
    body: JSON.stringify({ campaign_id: campaignId, matrix_png_base64: matrixImage }),
  });
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
  if (!canvas) throw new Error("Matrix chart is not available.");
  const anchor = document.createElement("a");
  anchor.href = canvas.toDataURL("image/png");
  anchor.download = filename;
  anchor.click();
}
