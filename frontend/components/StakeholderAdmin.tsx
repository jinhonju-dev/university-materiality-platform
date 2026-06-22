"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { RefreshCw, Save, Users } from "lucide-react";

import { api } from "@/lib/api";
import type { StakeholderGroupAdmin } from "@/lib/types";

type Draft = Record<number, { weight: string; description: string; is_active: boolean }>;

export function StakeholderAdmin({ token }: { token: string }) {
  const [groups, setGroups] = useState<StakeholderGroupAdmin[]>([]);
  const [draft, setDraft] = useState<Draft>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<StakeholderGroupAdmin[]>("/admin/stakeholder-groups", {}, token);
      setGroups(data);
      setDraft(Object.fromEntries(data.map((group) => [
        group.id,
        {
          weight: String(group.weight),
          description: group.description || "",
          is_active: group.is_active ?? true,
        },
      ])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "利害關係人資料載入失敗。");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft(id: number, key: keyof Draft[number], value: string | boolean) {
    setDraft((current) => ({
      ...current,
      [id]: { ...current[id], [key]: value },
    }));
  }

  async function save(event: FormEvent, group: StakeholderGroupAdmin) {
    event.preventDefault();
    setSavingId(group.id);
    setMessage("");
    setError("");
    try {
      const next = await api<StakeholderGroupAdmin>(`/admin/stakeholder-groups/${group.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          weight: Number(draft[group.id].weight),
          description: draft[group.id].description,
          is_active: draft[group.id].is_active,
        }),
      }, token);
      setGroups((current) => current.map((item) => item.id === next.id ? next : item));
      setMessage(`${group.name} 已更新。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新失敗。");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <div className="page-loader"><RefreshCw className="spin" /> 正在載入利害關係人設定...</div>;

  return (
    <div className="content-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow green">STAKEHOLDER WEIGHTS</span>
          <h1>利害關係人管理</h1>
          <p>設定權重、啟用狀態與回收數，Dashboard 與報表會同步使用。</p>
        </div>
        <button className="button secondary" onClick={load}><RefreshCw size={16} />重新載入</button>
      </header>
      {message && <div className="success-state">{message}</div>}
      {error && <div className="form-error">{error}</div>}
      <section className="admin-grid">
        {groups.map((group) => (
          <form className="admin-card" key={group.id} onSubmit={(event) => save(event, group)}>
            <div className="admin-card-heading">
              <span><Users size={18} /></span>
              <div>
                <h2>{group.name}</h2>
                <p>{group.scope === "internal" ? "校內" : "校外"} / 回收 {group.response_count} 份</p>
              </div>
            </div>
            <label>
              權重
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={draft[group.id]?.weight || "1"}
                onChange={(event) => updateDraft(group.id, "weight", event.target.value)}
              />
            </label>
            <label>
              說明
              <textarea
                value={draft[group.id]?.description || ""}
                onChange={(event) => updateDraft(group.id, "description", event.target.value)}
              />
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={draft[group.id]?.is_active ?? true}
                onChange={(event) => updateDraft(group.id, "is_active", event.target.checked)}
              />
              啟用此類別
            </label>
            <button className="button primary" disabled={savingId === group.id}>
              <Save size={16} /> {savingId === group.id ? "儲存中..." : "儲存設定"}
            </button>
          </form>
        ))}
      </section>
    </div>
  );
}
