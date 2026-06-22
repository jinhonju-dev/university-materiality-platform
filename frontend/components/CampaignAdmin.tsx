"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarDays, Copy, Plus, RefreshCw, Save, Ticket } from "lucide-react";

import { api } from "@/lib/api";
import type { CampaignAdmin as CampaignAdminType, InvitationCode, StakeholderGroupAdmin } from "@/lib/types";

type CampaignDraft = {
  title: string;
  year: string;
  status: "draft" | "active" | "closed";
  starts_at: string;
  ends_at: string;
  is_open: boolean;
  impact_threshold: string;
  financial_threshold: string;
};

const emptyCampaign: CampaignDraft = {
  title: "",
  year: String(new Date().getFullYear()),
  status: "draft",
  starts_at: "",
  ends_at: "",
  is_open: false,
  impact_threshold: "3.5",
  financial_threshold: "3.5",
};

function toDraft(campaign: CampaignAdminType): CampaignDraft {
  return {
    title: campaign.title,
    year: String(campaign.year),
    status: campaign.status as "draft" | "active" | "closed",
    starts_at: campaign.starts_at ? campaign.starts_at.slice(0, 16) : "",
    ends_at: campaign.ends_at ? campaign.ends_at.slice(0, 16) : "",
    is_open: campaign.is_open,
    impact_threshold: String(campaign.impact_threshold),
    financial_threshold: String(campaign.financial_threshold),
  };
}

function toPayload(draft: CampaignDraft) {
  return {
    title: draft.title,
    year: Number(draft.year),
    status: draft.status,
    starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
    ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
    is_open: draft.is_open,
    impact_threshold: Number(draft.impact_threshold),
    financial_threshold: Number(draft.financial_threshold),
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
      if (firstId) setInvitations(await api<InvitationCode[]>(`/admin/campaigns/${firstId}/invitations`, {}, token));
      if (!inviteGroupId && groupData[0]) setInviteGroupId(String(groupData[0].id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "問卷活動資料載入失敗。");
    } finally {
      setLoading(false);
    }
  }, [inviteGroupId, selectedCampaignId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function selectCampaign(id: number) {
    setSelectedCampaignId(id);
    setInvitations(await api<InvitationCode[]>(`/admin/campaigns/${id}/invitations`, {}, token));
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
      setMessage(`${updated.title} 已更新。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "活動更新失敗。");
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
      setMessage(`${created.title} 已建立。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "活動建立失敗。");
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
      const created = await api<InvitationCode[]>(`/admin/campaigns/${selectedCampaignId}/invitations`, {
        method: "POST",
        body: JSON.stringify({
          stakeholder_group_id: Number(inviteGroupId),
          count: Number(inviteCount),
          label_prefix: "INV",
        }),
      }, token);
      setInvitations((current) => [...created, ...current]);
      setMessage(`已產生 ${created.length} 組邀請碼。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "邀請碼產生失敗。");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <div className="page-loader"><RefreshCw className="spin" /> 正在載入問卷活動...</div>;

  return (
    <div className="content-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow green">SURVEY CAMPAIGNS</span>
          <h1>問卷活動管理</h1>
          <p>建立年度活動、設定門檻與開放狀態，並產生匿名邀請碼。</p>
        </div>
        <button className="button secondary" onClick={load}><RefreshCw size={16} />重新載入</button>
      </header>
      {message && <div className="success-state">{message}</div>}
      {error && <div className="form-error">{error}</div>}

      <form className="admin-card wide-card" onSubmit={createCampaign}>
        <div className="admin-card-heading">
          <span><Plus size={18} /></span>
          <div><h2>建立年度問卷活動</h2><p>建議先以 draft 建立，確認題庫後再開放填答。</p></div>
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
                <h2>{campaign.title}</h2>
                <p>回覆 {campaign.response_count} / 邀請碼 {campaign.used_invitation_count}/{campaign.invitation_count}</p>
              </div>
            </div>
            <CampaignFields draft={drafts[campaign.id]} onChange={(key, value) => updateDraft(campaign.id, key, value)} />
            <div className="button-row">
              <button type="button" className="button secondary" onClick={() => selectCampaign(campaign.id)}>管理邀請碼</button>
              <button className="button primary" disabled={savingId === campaign.id}><Save size={16} />儲存活動</button>
            </div>
          </form>
        ))}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>邀請碼管理</h2><p>匿名邀請碼每組只能填答一次。</p></div>
        </div>
        <form className="filter-bar" onSubmit={generateInvitations}>
          <label>
            活動
            <select value={selectedCampaignId || ""} onChange={(event) => selectCampaign(Number(event.target.value))}>
              {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.year} {campaign.title}</option>)}
            </select>
          </label>
          <label>
            利害關係人
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
            <thead><tr><th>邀請碼</th><th>利害關係人</th><th>標籤</th><th>狀態</th><th>使用時間</th></tr></thead>
            <tbody>
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td><strong>{invitation.code}</strong><small><button className="copy-button" type="button" onClick={() => navigator.clipboard.writeText(invitation.code)}><Copy size={12} />複製</button></small></td>
                  <td>{invitation.stakeholder_group_name}</td>
                  <td>{invitation.label || "-"}</td>
                  <td>{invitation.used_at ? "已使用" : invitation.is_active ? "可使用" : "停用"}</td>
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
      <label>狀態<select value={draft.status} onChange={(event) => onChange("status", event.target.value)}><option value="draft">draft</option><option value="active">active</option><option value="closed">closed</option></select></label>
      <label>開始時間<input type="datetime-local" value={draft.starts_at} onChange={(event) => onChange("starts_at", event.target.value)} /></label>
      <label>結束時間<input type="datetime-local" value={draft.ends_at} onChange={(event) => onChange("ends_at", event.target.value)} /></label>
      <label>衝擊門檻<input type="number" min="1" max="5" step="0.1" value={draft.impact_threshold} onChange={(event) => onChange("impact_threshold", event.target.value)} /></label>
      <label>財務門檻<input type="number" min="1" max="5" step="0.1" value={draft.financial_threshold} onChange={(event) => onChange("financial_threshold", event.target.value)} /></label>
      <label className="inline-check"><input type="checkbox" checked={draft.is_open} onChange={(event) => onChange("is_open", event.target.checked)} />開放填答</label>
    </div>
  );
}

