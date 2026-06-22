"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Database, Plus, RefreshCw, Save } from "lucide-react";

import { api } from "@/lib/api";
import type { TopicAdmin } from "@/lib/types";

type TopicDraft = {
  code: string;
  category: "E" | "S" | "G";
  name_zh: string;
  name_en: string;
  description: string;
  gri_mapping: string;
  sdgs_mapping: string;
  responsible_unit: string;
  management_approach: string;
  kpi: string;
  sort_order: string;
  is_active: boolean;
};

const emptyDraft: TopicDraft = {
  code: "",
  category: "E",
  name_zh: "",
  name_en: "",
  description: "",
  gri_mapping: "",
  sdgs_mapping: "",
  responsible_unit: "",
  management_approach: "",
  kpi: "",
  sort_order: "0",
  is_active: true,
};

function toDraft(topic: TopicAdmin): TopicDraft {
  return {
    code: topic.code,
    category: topic.category as "E" | "S" | "G",
    name_zh: topic.name_zh,
    name_en: topic.name_en,
    description: topic.description || "",
    gri_mapping: topic.gri_mapping || "",
    sdgs_mapping: topic.sdgs_mapping || "",
    responsible_unit: topic.responsible_unit || "",
    management_approach: topic.management_approach || "",
    kpi: topic.kpi || "",
    sort_order: String(topic.sort_order),
    is_active: topic.is_active,
  };
}

function toPayload(draft: TopicDraft) {
  return {
    ...draft,
    sort_order: Number(draft.sort_order || 0),
    description: draft.description || null,
    gri_mapping: draft.gri_mapping || null,
    sdgs_mapping: draft.sdgs_mapping || null,
    responsible_unit: draft.responsible_unit || null,
    management_approach: draft.management_approach || null,
    kpi: draft.kpi || null,
  };
}

export function TopicAdmin({ token }: { token: string }) {
  const [topics, setTopics] = useState<TopicAdmin[]>([]);
  const [drafts, setDrafts] = useState<Record<number, TopicDraft>>({});
  const [newDraft, setNewDraft] = useState<TopicDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | "new" | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<TopicAdmin[]>("/admin/topics", {}, token);
      setTopics(data);
      setDrafts(Object.fromEntries(data.map((topic) => [topic.id, toDraft(topic)])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "議題庫載入失敗。");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft(id: number, key: keyof TopicDraft, value: string | boolean) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));
  }

  async function saveTopic(event: FormEvent, topic: TopicAdmin) {
    event.preventDefault();
    setSavingId(topic.id);
    setError("");
    setMessage("");
    try {
      const updated = await api<TopicAdmin>(`/admin/topics/${topic.id}`, {
        method: "PATCH",
        body: JSON.stringify(toPayload(drafts[topic.id])),
      }, token);
      setTopics((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(`${updated.code} 已更新。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "議題更新失敗。");
    } finally {
      setSavingId(null);
    }
  }

  async function createTopic(event: FormEvent) {
    event.preventDefault();
    setSavingId("new");
    setError("");
    setMessage("");
    try {
      const created = await api<TopicAdmin>("/admin/topics", {
        method: "POST",
        body: JSON.stringify(toPayload(newDraft)),
      }, token);
      setTopics((current) => [...current, created].sort((a, b) => a.sort_order - b.sort_order));
      setDrafts((current) => ({ ...current, [created.id]: toDraft(created) }));
      setNewDraft(emptyDraft);
      setMessage(`${created.code} 已新增。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "議題新增失敗。");
    } finally {
      setSavingId(null);
    }
  }

  const filtered = topics.filter((topic) => categoryFilter === "all" || topic.category === categoryFilter);

  if (loading) return <div className="page-loader"><RefreshCw className="spin" /> 正在載入議題庫...</div>;

  return (
    <div className="content-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow green">TOPIC LIBRARY</span>
          <h1>議題庫管理</h1>
          <p>管理 E/S/G 議題、GRI/SDGs 對應、責任單位、管理方針與 KPI。</p>
        </div>
        <button className="button secondary" onClick={load}><RefreshCw size={16} />重新載入</button>
      </header>
      {message && <div className="success-state">{message}</div>}
      {error && <div className="form-error">{error}</div>}
      <section className="filter-bar">
        <label>
          類別篩選
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">全部</option>
            <option value="E">E 環境</option>
            <option value="S">S 社會</option>
            <option value="G">G 治理</option>
          </select>
        </label>
      </section>

      <form className="admin-card wide-card" onSubmit={createTopic}>
        <div className="admin-card-heading">
          <span><Plus size={18} /></span>
          <div><h2>新增議題</h2><p>新增後可立即納入後續問卷活動。</p></div>
        </div>
        <TopicFields draft={newDraft} onChange={(key, value) => setNewDraft((current) => ({ ...current, [key]: value }))} />
        <button className="button primary" disabled={savingId === "new"}><Plus size={16} />新增議題</button>
      </form>

      <section className="admin-list">
        {filtered.map((topic) => (
          <form className="admin-card wide-card" key={topic.id} onSubmit={(event) => saveTopic(event, topic)}>
            <div className="admin-card-heading">
              <span><Database size={18} /></span>
              <div><h2>{topic.code} {topic.name_zh}</h2><p>{topic.category} / 排序 {topic.sort_order}</p></div>
            </div>
            <TopicFields draft={drafts[topic.id]} onChange={(key, value) => updateDraft(topic.id, key, value)} />
            <button className="button primary" disabled={savingId === topic.id}><Save size={16} />儲存議題</button>
          </form>
        ))}
      </section>
    </div>
  );
}

function TopicFields({
  draft,
  onChange,
}: {
  draft: TopicDraft;
  onChange: (key: keyof TopicDraft, value: string | boolean) => void;
}) {
  return (
    <div className="form-grid">
      <label>議題代碼<input value={draft.code} onChange={(event) => onChange("code", event.target.value)} required /></label>
      <label>類別<select value={draft.category} onChange={(event) => onChange("category", event.target.value)}><option value="E">E</option><option value="S">S</option><option value="G">G</option></select></label>
      <label>中文名稱<input value={draft.name_zh} onChange={(event) => onChange("name_zh", event.target.value)} required /></label>
      <label>英文名稱<input value={draft.name_en} onChange={(event) => onChange("name_en", event.target.value)} required /></label>
      <label>GRI 對應<input value={draft.gri_mapping} onChange={(event) => onChange("gri_mapping", event.target.value)} /></label>
      <label>SDGs 對應<input value={draft.sdgs_mapping} onChange={(event) => onChange("sdgs_mapping", event.target.value)} /></label>
      <label>責任單位<input value={draft.responsible_unit} onChange={(event) => onChange("responsible_unit", event.target.value)} /></label>
      <label>排序<input type="number" value={draft.sort_order} onChange={(event) => onChange("sort_order", event.target.value)} /></label>
      <label className="full-span">說明<textarea value={draft.description} onChange={(event) => onChange("description", event.target.value)} /></label>
      <label className="full-span">管理方針<textarea value={draft.management_approach} onChange={(event) => onChange("management_approach", event.target.value)} /></label>
      <label className="full-span">KPI<textarea value={draft.kpi} onChange={(event) => onChange("kpi", event.target.value)} /></label>
      <label className="inline-check"><input type="checkbox" checked={draft.is_active} onChange={(event) => onChange("is_active", event.target.checked)} />啟用議題</label>
    </div>
  );
}

