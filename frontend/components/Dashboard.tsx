"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BrainCircuit,
  Check,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import { api, downloadCsv, downloadExcel, downloadMatrixPng, downloadReport } from "@/lib/api";
import type { Analytics, TopicMetric } from "@/lib/types";
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
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stakeholderFilter, setStakeholderFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api<Analytics>("/analytics", {}, token));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "分析資料載入失敗。");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <div className="page-loader"><RefreshCw className="spin" /> 正在載入重大性分析...</div>;
  if (!data) return <div className="error-state">{error}<button onClick={load}>重新載入</button></div>;

  const analytics = data;

  function decideQuadrant(impact: number, financial: number) {
    const highImpact = impact >= analytics.campaign.impact_threshold;
    const highFinancial = financial >= analytics.campaign.financial_threshold;
    if (highImpact && highFinancial) return "重大主題";
    if (highImpact) return "揭露主題";
    if (highFinancial) return "風險主題";
    return "觀察主題";
  }

  const segmentTopics: TopicMetric[] = analytics.topics.map((topic) => {
    if (stakeholderFilter === "all") return topic;
    const segment = analytics.stakeholder_topics.find((item) =>
      item.stakeholder_group_id === Number(stakeholderFilter) && item.topic_id === topic.topic_id
    );
    if (!segment) return { ...topic, response_count: 0, impact: 0, financial: 0, weighted_impact: 0, weighted_financial: 0, quadrant: "尚無資料" };
    return {
      ...topic,
      impact: segment.impact,
      financial: segment.financial,
      weighted_impact: segment.impact,
      weighted_financial: segment.financial,
      response_count: segment.response_count,
      quadrant: decideQuadrant(segment.impact, segment.financial),
    };
  });
  const filteredTopics = segmentTopics.filter((topic) => categoryFilter === "all" || topic.category === categoryFilter);
  const majorTopics = filteredTopics.filter((topic) => topic.quadrant === "重大主題");
  const topScore = [...filteredTopics].sort(
    (a, b) => b.impact + b.financial - (a.impact + a.financial),
  )[0];

  return (
    <div className="content-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow green">DOUBLE MATERIALITY</span>
          <h1>重大性分析儀表板</h1>
          <p>{data.campaign.title}，同時呈現未加權平均、加權平均與利害關係人分群。</p>
        </div>
        <div className="header-actions">
          <button className="button secondary" onClick={load}><RefreshCw size={16} />更新</button>
          <button className="button secondary" onClick={() => downloadCsv(token, data.campaign.id, true)}>
            <ArrowDownToLine size={17} /> 去識別 CSV
          </button>
          <button className="button secondary" onClick={() => downloadExcel(token, data.campaign.id)}>
            <FileSpreadsheet size={17} /> Excel
          </button>
          <button className="button secondary" onClick={() => downloadMatrixPng(`materiality-matrix-${data.campaign.year}.png`)}>
            <ArrowDownToLine size={17} /> PNG
          </button>
          <button className="button primary" onClick={() => downloadReport(token, data.campaign.id)}>
            <ArrowDownToLine size={17} /> Word
          </button>
        </div>
      </header>

      <section className="metric-grid">
        <article className="metric-card">
          <span className="metric-icon mint"><FileText /></span>
          <div><span>有效回覆</span><strong>{data.response_count.toLocaleString()}</strong></div>
          <small><ArrowUpRight /> 回收率 {data.completion_rate}%</small>
        </article>
        <article className="metric-card">
          <span className="metric-icon sand"><Users /></span>
          <div><span>利害關係人類別</span><strong>{data.stakeholder_count}</strong></div>
          <small><Check /> 含權重設定</small>
        </article>
        <article className="metric-card">
          <span className="metric-icon blue"><Target /></span>
          <div><span>重大主題</span><strong>{majorTopics.length}</strong></div>
          <small>高衝擊 / 高財務</small>
        </article>
        <article className="metric-card accent-card">
          <span>最高排序議題</span>
          <strong>{topScore?.response_count ? `${topScore.code} ${topScore.name}` : "尚無填答"}</strong>
          <small>
            {topScore?.response_count
              ? `平均分數 ${((topScore.impact + topScore.financial) / 2).toFixed(2)}`
              : "等待問卷回收"}
          </small>
        </article>
      </section>

      <section className="filter-bar">
        <label>
          E/S/G 篩選
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">全部類別</option>
            <option value="E">E 環境</option>
            <option value="S">S 社會</option>
            <option value="G">G 治理</option>
          </select>
        </label>
        <label>
          利害關係人分群
          <select value={stakeholderFilter} onChange={(event) => setStakeholderFilter(event.target.value)}>
            <option value="all">全部利害關係人</option>
            {data.stakeholders.map((group) => (
              <option key={group.id} value={group.id}>{group.name} / n={group.count} / w={group.weight}</option>
            ))}
          </select>
        </label>
      </section>

      <section className="dashboard-grid">
        <article className="panel matrix-panel">
          <div className="panel-heading">
            <div><h2>雙重重大性矩陣</h2><p>以衝擊重大性與財務重大性判定四象限。</p></div>
            <div className="legend">
              <span><i className="environment" />E</span>
              <span><i className="social" />S</span>
              <span><i className="governance" />G</span>
            </div>
          </div>
          <MatrixChart topics={filteredTopics} campaign={data.campaign} />
          <div className="quadrant-labels">
            <span>揭露主題</span><span>重大主題</span><span>觀察主題</span><span>風險主題</span>
          </div>
        </article>

        <article className="panel ai-panel">
          <div className="panel-heading">
            <div className="ai-title"><span><BrainCircuit /></span><div><h2>AI 分析草稿</h2><p>僅使用彙整資料，仍需人工審閱。</p></div></div>
            <div className="language-switch">
              <button className={language === "zh" ? "active" : ""} onClick={() => setLanguage("zh")}>中文</button>
              <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
            </div>
          </div>
          <div className="ai-copy">
            <Sparkles size={17} />
            <p>{language === "zh" ? data.analysis_zh : data.analysis_en}</p>
          </div>
          <div className="keyword-section">
            <span>開放題關鍵字</span>
            <div className="keyword-cloud">
              {data.keywords.length ? data.keywords.map((item) => (
                <span key={item.keyword}>{item.keyword}<b>{item.count}</b></span>
              )) : <em>尚無關鍵字資料</em>}
            </div>
          </div>
        </article>
      </section>

      <section className="panel segment-panel">
        <div className="panel-heading">
          <div><h2>利害關係人分群摘要</h2><p>列出各群樣本數、權重與目前篩選狀態。</p></div>
        </div>
        <div className="segment-grid">
          {data.stakeholders.map((group) => (
            <button
              key={group.id}
              className={stakeholderFilter === String(group.id) ? "segment-card active" : "segment-card"}
              onClick={() => setStakeholderFilter(stakeholderFilter === String(group.id) ? "all" : String(group.id))}
            >
              <strong>{group.name}</strong>
              <span>樣本 {group.count}</span>
              <small>權重 {group.weight.toFixed(2)}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel topic-panel">
        <div className="panel-heading">
          <div><h2>議題評估結果</h2><p>列出樣本數、未加權平均、加權平均與四象限判定。</p></div>
          <span className="record-count">{filteredTopics.length} 項議題</span>
        </div>
        <div className="topic-table-wrap">
          <table className="topic-table">
            <thead>
              <tr>
                <th>議題</th><th>類別</th><th>組織</th><th>衝擊</th><th>財務</th>
                <th>加權衝擊</th><th>加權財務</th><th>樣本</th><th>判定</th>
              </tr>
            </thead>
            <tbody>
              {[...filteredTopics]
                .sort((a, b) => b.impact + b.financial - (a.impact + a.financial))
                .map((topic) => (
                <tr key={topic.topic_id}>
                  <td><strong>{topic.name}</strong><small>{topic.code}</small></td>
                  <td><span className={`category ${topic.category}`}>{topic.category}</span></td>
                  <td>{topic.response_count ? topic.organization.toFixed(2) : "-"}</td>
                  <td>{topic.response_count ? topic.impact.toFixed(2) : "-"}</td>
                  <td>{topic.response_count ? topic.financial.toFixed(2) : "-"}</td>
                  <td>{topic.response_count ? topic.weighted_impact.toFixed(2) : "-"}</td>
                  <td>{topic.response_count ? topic.weighted_financial.toFixed(2) : "-"}</td>
                  <td>{topic.response_count}</td>
                  <td><span className={`quadrant ${quadrantClass[topic.quadrant] || "pending"}`}>{topic.quadrant}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
