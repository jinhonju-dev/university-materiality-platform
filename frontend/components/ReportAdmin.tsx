"use client";

import { useCallback, useEffect, useState } from "react";
import { BrainCircuit, FileText, RefreshCw, Sparkles } from "lucide-react";

import { api, downloadReport } from "@/lib/api";
import type { AIAnalysisVersion, Analytics } from "@/lib/types";

export function ReportAdmin({ token }: { token: string }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [versions, setVersions] = useState<AIAnalysisVersion[]>([]);
  const [active, setActive] = useState<AIAnalysisVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextAnalytics = await api<Analytics>("/analytics", {}, token);
      const nextVersions = await api<AIAnalysisVersion[]>("/admin/ai-analyses", {}, token);
      setAnalytics(nextAnalytics);
      setVersions(nextVersions);
      setActive(nextVersions.find((version) => version.is_active) || null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "讀取 AI 分析資料失敗。");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    if (!analytics) return;
    setGenerating(true);
    setError("");
    try {
      const version = await api<AIAnalysisVersion>(
        "/admin/ai-analyses/generate",
        {
          method: "POST",
          body: JSON.stringify({ campaign_id: analytics.campaign.id, overwrite_active: true }),
        },
        token,
      );
      setActive(version);
      setVersions((current) => [version, ...current.map((item) => ({ ...item, is_active: false }))]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "產生 AI 分析失敗。");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <div className="page-loader"><RefreshCw className="spin" /> 正在讀取報告草稿...</div>;
  if (!analytics) return <div className="error-state">{error}<button onClick={load}>重新讀取</button></div>;

  const content = active?.content || analytics.ai_analysis;

  return (
    <div className="content-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow green">AI + GRI DRAFT</span>
          <h1>AI 分析與 GRI 章節草稿</h1>
          <p>僅使用彙整後數據與去識別化開放題；所有輸出均標示為 AI 草稿，需人工審閱。</p>
        </div>
        <div className="header-actions">
          <button className="button secondary" onClick={load}><RefreshCw size={16} />重新整理</button>
          <button className="button secondary" onClick={generate} disabled={generating}>
            <Sparkles size={17} /> {generating ? "產生中..." : "重新產生 AI 草稿"}
          </button>
          <button className="button primary" onClick={() => downloadReport(token, analytics.campaign.id)}>
            <FileText size={17} /> 下載 Word
          </button>
        </div>
      </header>

      {error && <div className="error-state">{error}</div>}

      <section className="metric-grid">
        <article className="metric-card">
          <span className="metric-icon mint"><BrainCircuit /></span>
          <div><span>目前版本</span><strong>{active ? `v${active.version}` : "fallback"}</strong></div>
          <small>{active ? `${active.model} / ${active.prompt_version}` : "尚未儲存 AI 版本"}</small>
        </article>
        <article className="metric-card">
          <span className="metric-icon sand"><FileText /></span>
          <div><span>有效回收</span><strong>{analytics.response_count}</strong></div>
          <small>{analytics.stakeholder_count} 類利害關係人</small>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel ai-panel">
          <div className="panel-heading"><div><h2>中文摘要</h2><p>{content.disclaimer}</p></div></div>
          <div className="ai-copy"><Sparkles size={17} /><p>{content.zh_summary}</p></div>
        </article>
        <article className="panel ai-panel">
          <div className="panel-heading"><div><h2>English Summary</h2><p>{content.disclaimer}</p></div></div>
          <div className="ai-copy"><Sparkles size={17} /><p>{content.en_summary}</p></div>
        </article>
      </section>

      <section className="panel topic-panel">
        <div className="panel-heading"><div><h2>重大主題排序與分群差異</h2><p>可直接貼入報告書前，仍需人工審閱。</p></div></div>
        <div className="ai-copy"><p>{content.material_topic_ranking}</p></div>
        <div className="ai-copy"><p>{content.stakeholder_difference_analysis}</p></div>
        <div className="ai-copy"><p>{content.management_recommendations}</p></div>
      </section>

      <section className="panel topic-panel">
        <div className="panel-heading"><div><h2>GRI 章節草稿</h2><p>GRI 3-1、3-2、3-3 報告書段落。</p></div></div>
        <h3>GRI 3-1 Process to determine material topics</h3>
        <p>{content.gri_3_1}</p>
        <h3>GRI 3-2 List of material topics</h3>
        <p>{content.gri_3_2}</p>
        <h3>GRI 3-3 Management of material topics</h3>
        <p>{content.gri_3_3}</p>
      </section>

      <section className="panel topic-panel">
        <div className="panel-heading"><div><h2>AI 版本紀錄</h2><p>每次重新產生會建立新版本並停用舊 active 版本。</p></div></div>
        <div className="topic-table-wrap">
          <table className="topic-table">
            <thead><tr><th>版本</th><th>模型</th><th>Prompt</th><th>狀態</th><th>建立時間</th></tr></thead>
            <tbody>
              {versions.length ? versions.map((version) => (
                <tr key={version.id}>
                  <td>v{version.version}</td>
                  <td>{version.model}</td>
                  <td>{version.prompt_version}</td>
                  <td>{version.is_active ? "active" : "archived"}</td>
                  <td>{new Date(version.created_at).toLocaleString()}</td>
                </tr>
              )) : (
                <tr><td colSpan={5}>尚未建立 AI 分析版本。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
