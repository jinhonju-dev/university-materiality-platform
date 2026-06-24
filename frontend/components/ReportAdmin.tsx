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
      setError(caught instanceof Error ? caught.message : "無法載入 AI 分析資料。");
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

  if (loading) return <div className="page-loader"><RefreshCw className="spin" /> 載入報告管理中...</div>;
  if (!analytics) return <div className="error-state">{error}<button onClick={load}>重新讀取</button></div>;

  const content = active?.content || analytics.ai_analysis;

  return (
    <div className="content-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow green">AI + GRI DRAFT</span>
          <h1>報告管理與 AI 草稿</h1>
          <p>AI 僅使用彙整後與去識別化資料；所有內容需由管理者人工審閱後使用。</p>
        </div>
        <div className="header-actions">
          <button className="button secondary" onClick={load}><RefreshCw size={16} />重新整理</button>
          <button className="button secondary" onClick={generate} disabled={generating}>
            <Sparkles size={17} /> {generating ? "產生中..." : "重新產生 AI 草稿"}
          </button>
          <button className="button primary" onClick={() => downloadReport(token, analytics.campaign.id)}>
            <FileText size={17} />下載 Word
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
          <div><span>最終重大主題</span><strong>{analytics.final_material_topics.length}</strong></div>
          <small>{analytics.ai_analysis.disclaimer}</small>
        </article>
      </section>

      <section className="dashboard-grid">
        <AIBlock title="中文摘要" text={content.zh_summary} disclaimer={content.disclaimer} />
        <AIBlock title="English Summary" text={content.en_summary} disclaimer={content.disclaimer} />
        <AIBlock title="關注度調查結果說明" text={content.concern_result_summary} disclaimer={content.disclaimer} />
        <AIBlock title="衝擊重大性評估結果說明" text={content.impact_result_summary} disclaimer={content.disclaimer} />
        <AIBlock title="財務重大性評估結果說明" text={content.financial_result_summary} disclaimer={content.disclaimer} />
        <AIBlock title="重大主題排序說明" text={content.material_topic_ranking} disclaimer={content.disclaimer} />
        <AIBlock title="管理建議" text={content.management_recommendations} disclaimer={content.disclaimer} />
        <AIBlock title="報告書可用段落" text={content.report_paragraph_zh} disclaimer={content.disclaimer} />
      </section>

      <section className="panel topic-panel">
        <div className="panel-heading"><div><h2>GRI 章節草稿</h2><p>{content.disclaimer}</p></div></div>
        <h3>GRI 3-1 Process to determine material topics</h3>
        <p>{content.gri_3_1}</p>
        <h3>GRI 3-2 List of material topics</h3>
        <p>{content.gri_3_2}</p>
        <h3>GRI 3-3 Management of material topics</h3>
        <p>{content.gri_3_3}</p>
      </section>

      <section className="panel topic-panel">
        <div className="panel-heading"><div><h2>AI 版本紀錄</h2><p>重新產生會封存舊 active 版本。</p></div></div>
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
              )) : <tr><td colSpan={5}>尚無 AI 版本。</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AIBlock({ title, text, disclaimer }: { title: string; text: string; disclaimer: string }) {
  return (
    <article className="panel ai-panel">
      <div className="panel-heading"><div><h2>{title}</h2><p>{disclaimer}</p></div></div>
      <div className="ai-copy"><Sparkles size={17} /><p>{text}</p></div>
    </article>
  );
}
