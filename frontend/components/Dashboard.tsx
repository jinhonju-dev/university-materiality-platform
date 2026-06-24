"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
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
  核心重大主題: "critical",
  衝擊重大主題: "disclosure",
  財務重大主題: "risk",
  持續觀察議題: "watch",
  尚無資料: "pending",
};

const MIN_EFFECTIVE_EXPERT_SAMPLES = 3;

export function Dashboard({ token }: { token: string }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"zh" | "en">("zh");
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stakeholderFilter, setStakeholderFilter] = useState("all");
  const [overrideReason, setOverrideReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api<Analytics>("/analytics", {}, token));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "無法載入儀表板資料。");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function overrideTopic(topic: TopicMetric) {
    if (!data) return;
    const reason = overrideReason.trim() || window.prompt("請填寫手動調整理由");
    if (!reason) return;
    const updated = await api<Analytics>(
      `/admin/material-topics/${topic.topic_id}/override`,
      {
        method: "PATCH",
        body: JSON.stringify({
          campaign_id: data.expert_campaign?.id || data.campaign.id,
          is_material: !topic.is_final_material_topic,
          reason,
        }),
      },
      token,
    );
    setData(updated);
    setOverrideReason("");
  }

  if (loading) return <div className="page-loader"><RefreshCw className="spin" /> 載入重大性儀表板中...</div>;
  if (!data) return <div className="error-state">{error}<button onClick={load}>重新讀取</button></div>;

  const filteredTopics = data.topics.filter((topic) => categoryFilter === "all" || topic.category === categoryFilter);
  const majorTopics = filteredTopics.filter((topic) => topic.is_final_material_topic);
  const concernRank = [...data.topics].sort((a, b) => b.concern_score - a.concern_score);
  const impactRank = [...data.topics].sort((a, b) => b.impact_materiality_score - a.impact_materiality_score);
  const financialRank = [...data.topics].sort((a, b) => b.financial_materiality_score - a.financial_materiality_score);
  const unknownRank = [...data.topics].sort((a, b) => b.unknown_ratio - a.unknown_ratio);
  const unansweredInvitations = Math.max(0, data.issued_invitation_count - data.used_invitation_count);
  const matrixTopics = stakeholderFilter === "all" ? filteredTopics : filteredTopics.map((topic) => {
    const segment = data.stakeholder_topics.find((item) =>
      item.stakeholder_group_id === Number(stakeholderFilter) && item.topic_id === topic.topic_id
    );
    if (!segment) return { ...topic, response_count: 0, impact: 0, financial: 0, impact_materiality_score: 0, financial_materiality_score: 0, quadrant: "尚無資料" };
    return {
      ...topic,
      impact: segment.impact,
      financial: segment.financial,
      impact_materiality_score: segment.impact,
      financial_materiality_score: segment.financial,
      response_count: segment.response_count,
    };
  });

  return (
    <div className="content-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow green">DOUBLE MATERIALITY</span>
          <h1>正式重大性儀表板</h1>
          <p>{data.campaign.name || data.campaign.title}，門檻值 {data.threshold.toFixed(1)}。關注度作為排序與佐證，最終重大主題依衝擊或財務重大性判定。</p>
        </div>
        <div className="header-actions">
          <button className="button secondary" onClick={load}><RefreshCw size={16} />重新整理</button>
          <button className="button secondary" onClick={() => downloadCsv(token, data.campaign.id, true)}><ArrowDownToLine size={17} />去識別 CSV</button>
          <button className="button secondary" onClick={() => downloadExcel(token, data.campaign.id)}><FileSpreadsheet size={17} />Excel</button>
          <button className="button secondary" onClick={() => downloadMatrixPng(`materiality-matrix-${data.campaign.year}.png`)}><ArrowDownToLine size={17} />矩陣 PNG</button>
          <button className="button primary" onClick={() => downloadReport(token, data.campaign.id)}><ArrowDownToLine size={17} />Word 報告</button>
        </div>
      </header>

      <section className="metric-grid">
        <article className="metric-card">
          <span className="metric-icon mint"><FileText /></span>
          <div><span>關注度調查回收</span><strong>{data.concern_response_count.toLocaleString()}</strong></div>
          <small><Users size={14} />{data.stakeholder_count} 類利害關係人</small>
        </article>
        <article className="metric-card">
          <span className="metric-icon sand"><BrainCircuit /></span>
          <div><span>專家評估回收</span><strong>{data.expert_response_count.toLocaleString()}</strong></div>
          <small><Check size={14} />邀請碼 {data.used_invitation_count}/{data.issued_invitation_count}，{data.evaluator_roles.length} 類評估角色</small>
        </article>
        <article className="metric-card">
          <span className="metric-icon blue"><Target /></span>
          <div><span>最終重大主題</span><strong>{data.final_material_topics.length}</strong></div>
          <small>總回收 {data.response_count.toLocaleString()} 份</small>
        </article>
        <article className="metric-card accent-card">
          <span>完成率</span>
          <strong>{data.completion_rate.toFixed(1)}%</strong>
          <small>不清楚比例 {data.unknown_ratio.toFixed(1)}%</small>
        </article>
      </section>

      <section className="survey-summary-grid">
        <article className="panel">
          <div className="panel-heading">
            <div><h2>關注度調查摘要</h2><p>公開問卷回收與高關注議題。</p></div>
          </div>
          <div className="summary-list">
            <span><b>總回收數</b><strong>{data.concern_response_count.toLocaleString()}</strong></span>
            <span><b>疑似重複填答數</b><strong>尚無判定資料</strong></span>
            {data.stakeholders.filter((group) => group.count > 0).slice(0, 5).map((group) => (
              <span key={group.id}><b>{group.name}</b><strong>{group.count}</strong></span>
            ))}
          </div>
          <div className="topic-table-wrap">
            <table className="topic-table">
              <thead><tr><th>前五名高關注議題</th><th>Concern</th></tr></thead>
              <tbody>
                {concernRank.slice(0, 5).map((topic) => <tr key={topic.topic_id}><td><strong>{topic.code}</strong> {topic.name}</td><td>{topic.concern_score.toFixed(2)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div><h2>專家重大性評估摘要</h2><p>邀請碼回收、角色分布與不清楚比例。</p></div>
          </div>
          <div className="summary-list">
            <span><b>邀請碼發出數</b><strong>{data.issued_invitation_count}</strong></span>
            <span><b>已填答數</b><strong>{data.used_invitation_count}</strong></span>
            <span><b>未填答數</b><strong>{unansweredInvitations}</strong></span>
            <span><b>回收率</b><strong>{data.issued_invitation_count ? (data.used_invitation_count / data.issued_invitation_count * 100).toFixed(1) : "0.0"}%</strong></span>
            {data.evaluator_roles.map((role) => <span key={role.evaluator_role}><b>{role.evaluator_role}</b><strong>{role.count}</strong></span>)}
          </div>
          <div className="topic-table-wrap">
            <table className="topic-table">
              <thead><tr><th>不清楚比例最高議題</th><th>比例</th></tr></thead>
              <tbody>
                {unknownRank.slice(0, 5).map((topic) => <tr key={topic.topic_id}><td><strong>{topic.code}</strong> {topic.name}</td><td>{topic.unknown_ratio.toFixed(1)}%</td></tr>)}
              </tbody>
            </table>
          </div>
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
          專家分群
          <select value={stakeholderFilter} onChange={(event) => setStakeholderFilter(event.target.value)}>
            <option value="all">全部專家分群</option>
            {data.stakeholders.map((group) => (
              <option key={group.id} value={group.id}>{group.name} / n={group.count} / w={group.weight}</option>
            ))}
          </select>
        </label>
      </section>

      <section className="dashboard-grid">
        <article className="panel matrix-panel">
          <div className="panel-heading">
            <div><h2>雙重重大性矩陣</h2><p>X 軸為財務重大性，Y 軸為衝擊重大性；點大小代表關注度調查平均分數。</p></div>
            <div className="legend"><span><i className="environment" />E</span><span><i className="social" />S</span><span><i className="governance" />G</span></div>
          </div>
          <MatrixChart topics={matrixTopics} campaign={data.campaign} />
        </article>

        <article className="panel ai-panel">
          <div className="panel-heading">
            <div className="ai-title"><span><Sparkles /></span><div><h2>AI 分析草稿</h2><p>{data.ai_analysis.disclaimer}</p></div></div>
            <div className="language-switch">
              <button className={language === "zh" ? "active" : ""} onClick={() => setLanguage("zh")}>中文</button>
              <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
            </div>
          </div>
          <div className="ai-copy"><Sparkles size={17} /><p>{language === "zh" ? data.ai_analysis.zh_summary : data.ai_analysis.en_summary}</p></div>
          <div className="ai-copy"><p>{data.ai_analysis.concern_result_summary}</p></div>
          <div className="ai-copy"><p>{data.ai_analysis.impact_result_summary}</p></div>
          <div className="ai-copy"><p>{data.ai_analysis.financial_result_summary}</p></div>
        </article>
      </section>

      <section className="dashboard-grid">
        <RankPanel title="關注度調查 concern_score 排名" topics={concernRank} value={(topic) => topic.concern_score} suffix="" />
        <RankPanel title="衝擊重大性 impact_materiality_score" topics={impactRank} value={(topic) => topic.impact_materiality_score} suffix="" />
        <RankPanel title="財務重大性 financial_materiality_score" topics={financialRank} value={(topic) => topic.financial_materiality_score} suffix="" />
      </section>

      <section className="dashboard-grid">
        <article className="panel segment-panel">
          <div className="panel-heading"><div><h2>各利害關係人類別回收數</h2><p>來自關注度調查。</p></div></div>
          <div className="segment-grid">
            {data.stakeholders.map((group) => (
              <button key={group.id} className="segment-card" onClick={() => setStakeholderFilter(String(group.id))}>
                <strong>{group.name}</strong><span>回收 {group.count}</span><small>權重 {group.weight.toFixed(2)}</small>
              </button>
            ))}
          </div>
        </article>
        <article className="panel segment-panel">
          <div className="panel-heading"><div><h2>各 evaluator_role 回收數</h2><p>來自專家重大性評估邀請碼。</p></div></div>
          <div className="segment-grid">
            {data.evaluator_roles.length ? data.evaluator_roles.map((role) => (
              <div className="segment-card" key={role.evaluator_role}><strong>{role.evaluator_role}</strong><span>回收 {role.count}</span></div>
            )) : <p>尚無專家評估回收。</p>}
          </div>
        </article>
      </section>

      <section className="panel topic-panel">
        <div className="panel-heading">
          <div><h2>最終重大主題清單</h2><p>管理者可手動調整，但必須填寫理由並寫入 audit_logs。</p></div>
        </div>
        <label className="full-span">
          手動調整理由
          <input value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="例如：經管理階層審查，雖未達門檻但列為策略優先議題。" />
        </label>
        <TopicTable topics={filteredTopics} onOverride={overrideTopic} />
      </section>
    </div>
  );
}

function RankPanel({ title, topics, value }: { title: string; topics: TopicMetric[]; value: (topic: TopicMetric) => number; suffix: string }) {
  return (
    <article className="panel topic-panel">
      <div className="panel-heading"><div><h2>{title}</h2></div></div>
      <div className="topic-table-wrap">
        <table className="topic-table">
          <thead><tr><th>排名</th><th>議題</th><th>分數</th></tr></thead>
          <tbody>
            {topics.slice(0, 8).map((topic, index) => (
              <tr key={topic.topic_id}><td>{index + 1}</td><td><strong>{topic.code}</strong> {topic.name}</td><td>{value(topic).toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function TopicTable({ topics, onOverride }: { topics: TopicMetric[]; onOverride: (topic: TopicMetric) => void }) {
  return (
    <div className="topic-table-wrap">
      <table className="topic-table">
        <thead>
          <tr>
            <th>議題</th><th>類別</th><th>Concern</th><th>Impact</th><th>Financial</th><th>不清楚</th><th>樣本</th><th>象限</th><th>最終</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          {[...topics].sort((a, b) => Number(b.is_final_material_topic) - Number(a.is_final_material_topic) || b.impact + b.financial - (a.impact + a.financial)).map((topic) => (
            <tr key={topic.topic_id}>
              <td><strong>{topic.name}</strong><small>{topic.code}{topic.manually_adjusted ? " / 手動調整" : ""}</small></td>
              <td><span className={`category ${topic.category}`}>{topic.category}</span></td>
              <td>{topic.concern_score.toFixed(2)}</td>
              <td>{topic.impact_materiality_score.toFixed(2)}</td>
              <td>{topic.financial_materiality_score.toFixed(2)}</td>
              <td>{topic.unknown_ratio.toFixed(1)}%</td>
              <td>
                {topic.response_count}
                {topic.response_count > 0 && topic.response_count < MIN_EFFECTIVE_EXPERT_SAMPLES && <small className="sample-warning">有效樣本不足</small>}
              </td>
              <td><span className={`quadrant ${quadrantClass[topic.quadrant] || "pending"}`}>{topic.quadrant}</span></td>
              <td>{topic.is_final_material_topic ? "重大" : "觀察"}</td>
              <td><button className="button secondary" onClick={() => onOverride(topic)}>{topic.is_final_material_topic ? "改為非重大" : "列為重大"}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
