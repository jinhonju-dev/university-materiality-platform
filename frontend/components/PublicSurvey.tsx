"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";

import { api } from "@/lib/api";
import { DEMO_MODE } from "@/lib/demo";
import type { PublicSurveyConfig } from "@/lib/types";

type Mode = "concern" | "expert";
type ConcernScores = Record<number, number>;
type ExpertScores = Record<number, Record<string, number | null>>;

const concernLabels = ["極低", "低", "中等", "高", "極高"];
const expertLabels = ["極低", "低", "中等", "高", "極高／已發生"];

const expertQuestions = [
  ["impact_likelihood_score", "未來3～5年內，本校發生此情境的可能性？"],
  ["positive_impact_score", "若此情境帶來正面效益，其效益程度為何？"],
  ["negative_impact_score", "若此情境帶來負面損害，其損害程度為何？"],
  ["admissions_revenue_score", "對招生數／服務收益的影響"],
  ["reputation_score", "對學校校譽的影響"],
  ["operating_cost_score", "對營運成本的影響"],
  ["funding_score", "對獲得資金／補助的影響"],
  ["legal_liability_score", "對法律責任的影響"],
  ["financial_likelihood_score", "此議題對本校財務或營運造成影響的可能性"],
] as const;

export function PublicSurvey({ mode }: { mode: Mode }) {
  const [config, setConfig] = useState<PublicSurveyConfig | null>(null);
  const [stakeholderGroupId, setStakeholderGroupId] = useState("");
  const [invitationCode, setInvitationCode] = useState(DEMO_MODE && mode === "expert" ? "DEMO-EXPERT" : "");
  const [concernScores, setConcernScores] = useState<ConcernScores>({});
  const [expertScores, setExpertScores] = useState<ExpertScores>({});
  const [openAnswer, setOpenAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<PublicSurveyConfig>("/public/survey-config")
      .then((data) => {
        setConfig(data);
        setStakeholderGroupId(String(data.stakeholder_groups[0]?.id || ""));
        setConcernScores(Object.fromEntries(data.topics.map((topic) => [topic.id, 0])));
        setExpertScores(Object.fromEntries(data.topics.map((topic) => [topic.id, Object.fromEntries(expertQuestions.map(([key]) => [key, null]))])));
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "讀取問卷失敗。"))
      .finally(() => setLoading(false));
  }, []);

  function setExpertScore(topicId: number, key: string, value: number | null) {
    setExpertScores((current) => ({
      ...current,
      [topicId]: { ...current[topicId], [key]: value },
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!config) return;
    setSubmitting(true);
    setError("");
    try {
      if (mode === "concern") {
        await api("/surveys/concern", {
          method: "POST",
          body: JSON.stringify({
            campaign_id: config.campaign.id,
            stakeholder_group_id: Number(stakeholderGroupId),
            scores: config.topics.map((topic) => ({ topic_id: topic.id, concern_score: concernScores[topic.id] })),
            open_answer: openAnswer,
          }),
        });
      } else {
        await api("/surveys/expert", {
          method: "POST",
          body: JSON.stringify({
            campaign_id: config.campaign.id,
            invitation_code: invitationCode,
            scores: config.topics.map((topic) => ({ topic_id: topic.id, ...expertScores[topic.id] })),
            open_answer: openAnswer,
          }),
        });
      }
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "送出失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page-loader">正在讀取問卷...</div>;
  if (!config) return <div className="error-state">{error}</div>;
  if (submitted) return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-card">
          <span><CheckCircle2 /></span>
          <h2>已完成送出</h2>
          <p>感謝您的填答，資料已正式寫入後端資料庫。</p>
        </div>
      </section>
    </main>
  );

  const title = mode === "concern" ? "關注度調查 Concern Survey" : "專家重大性評估 Expert Materiality Assessment";

  return (
    <main className="content-shell survey-shell public-survey">
      {DEMO_MODE && <div className="public-demo-bar">展示模式：此頁使用展示資料，不會永久保存正式問卷。</div>}
      <header className="survey-header">
        <div>
          <span className="eyebrow green">{mode === "concern" ? "CONCERN SURVEY" : "EXPERT ASSESSMENT"}</span>
          <h1>{title}</h1>
          <p>{config.campaign.title}</p>
        </div>
      </header>
      <form onSubmit={submit}>
        <section className="question-card">
          {mode === "concern" ? (
            <label>
              請選擇您的利害關係人類別
              <select value={stakeholderGroupId} onChange={(event) => setStakeholderGroupId(event.target.value)} required>
                {config.stakeholder_groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
          ) : (
            <label>
              專家邀請碼
              <input value={invitationCode} onChange={(event) => setInvitationCode(event.target.value)} required />
            </label>
          )}
        </section>

        {config.topics.map((topic) => (
          <section className="question-card" key={topic.id}>
            <div className="topic-heading">
              <span>{topic.code}</span>
              <div><h2>{topic.name_zh}</h2><p>{topic.description}</p></div>
            </div>
            {mode === "concern" ? (
              <div className="dimension-row">
                <div><b>關注</b><span><strong>您對此議題的關注程度？</strong><small>1 = 極低，5 = 極高</small></span></div>
                <div className="rating">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button type="button" key={value} className={concernScores[topic.id] === value ? "selected" : ""} title={`${value} ${concernLabels[value - 1]}`} onClick={() => setConcernScores((current) => ({ ...current, [topic.id]: value }))}>{value}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="dimension-list">
                {expertQuestions.map(([key, label], index) => (
                  <div className="dimension-row" key={key}>
                    <div><b>{index + 1}</b><span><strong>{label}</strong><small>1 = 極低，5 = 極高／已發生；可選不清楚</small></span></div>
                    <div className="rating rating-with-unknown">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button type="button" key={value} className={expertScores[topic.id]?.[key] === value ? "selected" : ""} title={`${value} ${expertLabels[value - 1]}`} onClick={() => setExpertScore(topic.id, key, value)}>{value}</button>
                      ))}
                      <button type="button" className={expertScores[topic.id]?.[key] === null ? "selected" : ""} onClick={() => setExpertScore(topic.id, key, null)}>不清楚</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        <section className="question-card">
          <label>
            開放意見
            <textarea value={openAnswer} onChange={(event) => setOpenAnswer(event.target.value)} maxLength={2000} />
          </label>
        </section>
        {error && <div className="form-error">{error}</div>}
        <footer className="survey-footer">
          <button className="button primary" disabled={submitting}>
            <Send size={16} /> {submitting ? "送出中..." : "送出問卷"}
          </button>
        </footer>
      </form>
    </main>
  );
}
