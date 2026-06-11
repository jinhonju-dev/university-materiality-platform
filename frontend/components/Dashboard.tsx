"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BrainCircuit,
  Check,
  FileText,
  RefreshCw,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import { api, downloadReport } from "@/lib/api";
import type { Analytics } from "@/lib/types";
import { MatrixChart } from "./MatrixChart";

const quadrantClass: Record<string, string> = {
  重大主題: "critical",
  揭露主題: "disclosure",
  風險主題: "risk",
  觀察主題: "watch",
  尚無資料: "pending",
};

export function Dashboard({ token }: { token: string }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"zh" | "en">("zh");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await api<Analytics>("/analytics", {}, token));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <div className="page-loader"><RefreshCw className="spin" /> 正在彙整重大性資料</div>;
  if (!data) return <div className="error-state">{error}<button onClick={load}>重新載入</button></div>;

  const majorTopics = data.topics.filter((topic) => topic.quadrant === "重大主題");
  const topScore = [...data.topics].sort(
    (a, b) => b.impact + b.financial - (a.impact + a.financial),
  )[0];

  return (
    <div className="content-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow green">DOUBLE MATERIALITY</span>
          <h1>重大性分析總覽</h1>
          <p>{data.campaign.title}・資料即時更新</p>
        </div>
        <div className="header-actions">
          <button className="button secondary" onClick={load}><RefreshCw size={16} />更新</button>
          <button
            className="button primary"
            onClick={() => downloadReport(token, data.campaign.id)}
          >
            <ArrowDownToLine size={17} /> 輸出 Word 報告
          </button>
        </div>
      </header>

      <section className="metric-grid">
        <article className="metric-card">
          <span className="metric-icon mint"><FileText /></span>
          <div><span>有效問卷</span><strong>{data.response_count.toLocaleString()}</strong></div>
          <small><ArrowUpRight /> 完成率 {data.completion_rate}%</small>
        </article>
        <article className="metric-card">
          <span className="metric-icon sand"><Users /></span>
          <div><span>利害關係人類別</span><strong>{data.stakeholder_count}</strong></div>
          <small><Check /> 已納入分析</small>
        </article>
        <article className="metric-card">
          <span className="metric-icon blue"><Target /></span>
          <div><span>重大主題</span><strong>{majorTopics.length}</strong></div>
          <small>雙高象限議題</small>
        </article>
        <article className="metric-card accent-card">
          <span>目前最高關注</span>
          <strong>{topScore?.response_count ? topScore.name : "等待填答"}</strong>
          <small>
            {topScore?.response_count
              ? `綜合分數 ${((topScore.impact + topScore.financial) / 2).toFixed(2)}`
              : "尚無評分資料"}
          </small>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel matrix-panel">
          <div className="panel-heading">
            <div><h2>雙重重大性矩陣</h2><p>以衝擊與財務重大性辨識優先議題</p></div>
            <div className="legend">
              <span><i className="environment" />環境</span>
              <span><i className="social" />社會</span>
              <span><i className="governance" />治理</span>
            </div>
          </div>
          <MatrixChart topics={data.topics} campaign={data.campaign} />
          <div className="quadrant-labels">
            <span>揭露主題</span><span>重大主題</span><span>觀察主題</span><span>風險主題</span>
          </div>
        </article>

        <article className="panel ai-panel">
          <div className="panel-heading">
            <div className="ai-title"><span><BrainCircuit /></span><div><h2>AI 分析摘要</h2><p>依目前資料自動生成</p></div></div>
            <div className="language-switch">
              <button className={language === "zh" ? "active" : ""} onClick={() => setLanguage("zh")}>中</button>
              <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
            </div>
          </div>
          <div className="ai-copy">
            <Sparkles size={17} />
            <p>{language === "zh" ? data.analysis_zh : data.analysis_en}</p>
          </div>
          <div className="keyword-section">
            <span>開放題高頻議題</span>
            <div className="keyword-cloud">
              {data.keywords.length ? data.keywords.map((item) => (
                <span key={item.keyword}>{item.keyword}<b>{item.count}</b></span>
              )) : <em>尚無開放題資料</em>}
            </div>
          </div>
        </article>
      </section>

      <section className="panel topic-panel">
        <div className="panel-heading">
          <div><h2>議題評估結果</h2><p>三項評分與雙重重大性判定</p></div>
          <span className="record-count">{data.topics.length} 項議題</span>
        </div>
        <div className="topic-table-wrap">
          <table className="topic-table">
            <thead>
              <tr>
                <th>議題</th><th>類別</th><th>組織影響</th><th>衝擊重大性</th>
                <th>財務重大性</th><th>判定</th>
              </tr>
            </thead>
            <tbody>
              {[...data.topics]
                .sort((a, b) => b.impact + b.financial - (a.impact + a.financial))
                .map((topic) => (
                <tr key={topic.topic_id}>
                  <td><strong>{topic.name}</strong><small>{topic.code}</small></td>
                  <td><span className={`category ${topic.category}`}>{topic.category}</span></td>
                  <td>{topic.response_count ? topic.organization.toFixed(2) : "—"}</td>
                  <td>{topic.response_count ? topic.impact.toFixed(2) : "—"}</td>
                  <td>{topic.response_count ? topic.financial.toFixed(2) : "—"}</td>
                  <td><span className={`quadrant ${quadrantClass[topic.quadrant]}`}>{topic.quadrant}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

