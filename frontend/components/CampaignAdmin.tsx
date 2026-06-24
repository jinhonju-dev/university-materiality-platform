"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarDays, Plus, RefreshCw, Save, Ticket } from "lucide-react";

import { api } from "@/lib/api";
import type { CampaignAdmin as CampaignAdminType, InvitationCode, StakeholderGroupAdmin } from "@/lib/types";

type CampaignDraft = {
  title: string;
  year: string;
  survey_type: "concern" | "expert_materiality";
  status: "draft" | "active" | "closed";
  starts_at: string;
  ends_at: string;
  is_open: boolean;
  materiality_threshold: string;
  allow_public_response: boolean;
  require_invitation_code: boolean;
};

const emptyCampaign: CampaignDraft = {
  title: "",
  year: String(new Date().getFullYear()),
  survey_type: "concern",
  status: "draft",
  starts_at: "",
  ends_at: "",
  is_open: false,
  materiality_threshold: "3.5",
  allow_public_response: true,
  require_invitation_code: false,
};

function toDraft(campaign: CampaignAdminType): CampaignDraft {
  return {
    title: campaign.name || campaign.title,
    year: String(campaign.year),
    survey_type: campaign.survey_type === "expert_materiality" ? "expert_materiality" : "concern",
    status: campaign.status as "draft" | "active" | "closed",
    starts_at: campaign.starts_at ? campaign.starts_at.slice(0, 16) : "",
    ends_at: campaign.ends_at ? campaign.ends_at.slice(0, 16) : "",
    is_open: campaign.is_open,
    materiality_threshold: String(campaign.materiality_threshold || 3.5),
    allow_public_response: campaign.allow_public_response ?? true,
    require_invitation_code: campaign.require_invitation_code ?? false,
  };
}

function toPayload(draft: CampaignDraft) {
  return {
    title: draft.title,
    name: draft.title,
    year: Number(draft.year),
    survey_type: draft.survey_type,
    status: draft.status,
    starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
    start_date: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
    ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
    end_date: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
    is_open: draft.is_open,
    is_active: draft.status === "active",
    impact_threshold: Number(draft.materiality_threshold),
    financial_threshold: Number(draft.materiality_threshold),
    materiality_threshold: Number(draft.materiality_threshold),
    allow_public_response: draft.allow_public_response,
    require_invitation_code: draft.require_invitation_code,
  };
}

export function CampaignAdmin({ token }: { token: string }) {
  const [campaigns, setCampaigns] = useState<CampaignAdminType[]>([]);
  const [groups, setGroups] = useState<StakeholderGroupAdmin[]>([]);
  const [invitations, setInvitations] = useState<InvitationCode[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, CampaignDraft>>({});
  const [newDraft, setNewDraft] = useState<CampaignDraft>(emptyCampaign);
  const [inviteGroupId, setInviteGroupId] = useState("");
  const [inviteCount, setInviteCount] = useState("10");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | "new" | "invite" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadInvitations = useCallback(async (campaignId: number) => {
    setInvitations(await api<InvitationCode[]>(`/admin/campaigns/${campaignId}/invitation-codes`, {}, token));
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [campaignData, groupData] = await Promise.all([
        api<CampaignAdminType[]>("/admin/campaigns", {}, token),
        api<StakeholderGroupAdmin[]>("/admin/stakeholder-groups", {}, token),
      ]);
      setCampaigns(campaignData);
      setGroups(groupData.filter((group) => group.is_active));
      setDrafts(Object.fromEntries(campaignData.map((campaign) => [campaign.id, toDraft(campaign)])));
      const firstId = selectedCampaignId || campaignData[0]?.id || null;
      setSelectedCampaignId(firstId);
      if (firstId) await loadInvitations(firstId);
      if (!inviteGroupId && groupData[0]) setInviteGroupId(String(groupData[0].id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "無法載入問卷活動資料。");
    } finally {
      setLoading(false);
    }
  }, [inviteGroupId, loadInvitations, selectedCampaignId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function selectCampaign(id: number) {
    setSelectedCampaignId(id);
    await loadInvitations(id);
  }

  function updateDraft(id: number, key: keyof CampaignDraft, value: string | boolean) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));
  }

  async function saveCampaign(event: FormEvent, campaign: CampaignAdminType) {
    event.preventDefault();
    setSavingId(campaign.id);
    setError("");
    setMessage("");
    try {
      const updated = await api<CampaignAdminType>(`/admin/campaigns/${campaign.id}`, {
        method: "PATCH",
        body: JSON.stringify(toPayload(drafts[campaign.id])),
      }, token);
      setCampaigns((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(`${updated.name || updated.title} 已更新。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新問卷活動失敗。");
    } finally {
      setSavingId(null);
    }
  }

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    setSavingId("new");
    setError("");
    setMessage("");
    try {
      const created = await api<CampaignAdminType>("/admin/campaigns", {
        method: "POST",
        body: JSON.stringify(toPayload(newDraft)),
      }, token);
      setCampaigns((current) => [created, ...current]);
      setDrafts((current) => ({ ...current, [created.id]: toDraft(created) }));
      setSelectedCampaignId(created.id);
      setInvitations([]);
      setNewDraft(emptyCampaign);
      setMessage(`${created.name || created.title} 已建立。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "建立問卷活動失敗。");
    } finally {
      setSavingId(null);
    }
  }

  async function generateInvitations(event: FormEvent) {
    event.preventDefault();
    if (!selectedCampaignId) return;
    setSavingId("invite");
    setError("");
    setMessage("");
    try {
      const created = await api<InvitationCode[]>(`/admin/campaigns/${selectedCampaignId}/invitation-codes`, {
        method: "POST",
        body: JSON.stringify({
          stakeholder_group_id: Number(inviteGroupId),
          count: Number(inviteCount),
          label_prefix: "INV",
        }),
      }, token);
      downloadInvitationCsv(created);
      await loadInvitations(selectedCampaignId);
      setMessage(`已產生 ${created.length} 組邀請碼，完整邀請碼已下載為 CSV，列表僅保留前綴與使用狀態。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "產生邀請碼失敗。");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <div className="page-loader"><RefreshCw className="spin" /> 載入問卷活動中...</div>;

  return (
    <div className="content-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow green">SURVEY CAMPAIGNS</span>
          <h1>問卷活動管理</h1>
          <p>建立年度問卷活動，設定是否開放填答，並為專家重大性評估產生一次性邀請碼。</p>
        </div>
        <button className="button secondary" onClick={load}><RefreshCw size={16} />重新載入</button>
      </header>
      {message && <div className="success-state">{message}</div>}
      {error && <div className="form-error">{error}</div>}

      <form className="admin-card wide-card" onSubmit={createCampaign}>
        <div className="admin-card-heading">
          <span><Plus size={18} /></span>
          <div><h2>建立問卷活動</h2><p>正式模式會將活動設定寫入後端資料庫。</p></div>
        </div>
        <CampaignFields draft={newDraft} onChange={(key, value) => setNewDraft((current) => ({ ...current, [key]: value }))} />
        <button className="button primary" disabled={savingId === "new"}><Plus size={16} />建立活動</button>
      </form>

      <section className="admin-list">
        {campaigns.map((campaign) => (
          <form className="admin-card wide-card" key={campaign.id} onSubmit={(event) => saveCampaign(event, campaign)}>
            <div className="admin-card-heading">
              <span><CalendarDays size={18} /></span>
              <div>
                <h2>{campaign.name || campaign.title}</h2>
                <p>回收 {campaign.response_count} / 邀請碼 {campaign.used_invitation_count}/{campaign.invitation_count}</p>
              </div>
            </div>
            <CampaignFields draft={drafts[campaign.id]} onChange={(key, value) => updateDraft(campaign.id, key, value)} />
            <div className="button-row">
              <button type="button" className="button secondary" onClick={() => selectCampaign(campaign.id)}>查看邀請碼</button>
              <button className="button primary" disabled={savingId === campaign.id}><Save size={16} />儲存活動</button>
            </div>
          </form>
        ))}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>邀請碼管理</h2><p>邀請碼不會以明碼保存；列表僅顯示 prefix，完整碼只會於產生當下顯示一次。</p></div>
        </div>
        <form className="filter-bar" onSubmit={generateInvitations}>
          <label>
            問卷活動
            <select value={selectedCampaignId || ""} onChange={(event) => selectCampaign(Number(event.target.value))}>
              {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.year} {campaign.name || campaign.title}</option>)}
            </select>
          </label>
          <label>
            利害關係人類別
            <select value={inviteGroupId} onChange={(event) => setInviteGroupId(event.target.value)}>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
          <label>
            數量
            <input type="number" min="1" max="500" value={inviteCount} onChange={(event) => setInviteCount(event.target.value)} />
          </label>
          <button className="button primary" disabled={savingId === "invite"}><Ticket size={16} />產生邀請碼</button>
        </form>
        <div className="topic-table-wrap">
          <table className="topic-table">
            <thead><tr><th>邀請碼前綴</th><th>利害關係人</th><th>標籤</th><th>狀態</th><th>產生時間</th><th>使用時間</th></tr></thead>
            <tbody>
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td>
                    <strong>{invitation.code_prefix}••••</strong>
                    <small>完整碼僅於產生當下 CSV 顯示</small>
                  </td>
                  <td>{invitation.stakeholder_group_name}</td>
                  <td>{invitation.label || "-"}</td>
                  <td>{invitation.used_count ? "已使用" : invitation.is_active ? "可使用" : "已停用"}</td>
                  <td>{new Date(invitation.created_at).toLocaleString()}</td>
                  <td>{invitation.used_at ? new Date(invitation.used_at).toLocaleString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function downloadInvitationCsv(items: InvitationCode[]) {
  const header = ["code", "code_prefix", "stakeholder_group", "label", "evaluator_role", "expires_at", "max_uses"];
  const rows = items.map((item) => [
    item.code || "",
    item.code_prefix,
    item.stakeholder_group_name,
    item.label || "",
    item.evaluator_role || "",
    item.expires_at || "",
    String(item.max_uses || 1),
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `invitation-codes-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function CampaignFields({
  draft,
  onChange,
}: {
  draft: CampaignDraft;
  onChange: (key: keyof CampaignDraft, value: string | boolean) => void;
}) {
  return (
    <div className="form-grid">
      <label className="full-span">活動名稱<input value={draft.title} onChange={(event) => onChange("title", event.target.value)} required /></label>
      <label>年度<input type="number" value={draft.year} onChange={(event) => onChange("year", event.target.value)} required /></label>
      <label>類型<select value={draft.survey_type} onChange={(event) => onChange("survey_type", event.target.value)}><option value="concern">concern</option><option value="expert_materiality">expert_materiality</option></select></label>
      <label>狀態<select value={draft.status} onChange={(event) => onChange("status", event.target.value)}><option value="draft">draft</option><option value="active">active</option><option value="closed">closed</option></select></label>
      <label>開始時間<input type="datetime-local" value={draft.starts_at} onChange={(event) => onChange("starts_at", event.target.value)} /></label>
      <label>結束時間<input type="datetime-local" value={draft.ends_at} onChange={(event) => onChange("ends_at", event.target.value)} /></label>
      <label>重大性門檻<input type="number" min="1" max="5" step="0.1" value={draft.materiality_threshold} onChange={(event) => onChange("materiality_threshold", event.target.value)} /></label>
      <label className="inline-check"><input type="checkbox" checked={draft.is_open} onChange={(event) => onChange("is_open", event.target.checked)} />開放填答</label>
      <label className="inline-check"><input type="checkbox" checked={draft.allow_public_response} onChange={(event) => onChange("allow_public_response", event.target.checked)} />允許公開填答</label>
      <label className="inline-check"><input type="checkbox" checked={draft.require_invitation_code} onChange={(event) => onChange("require_invitation_code", event.target.checked)} />需要邀請碼</label>
    </div>
  );
}
