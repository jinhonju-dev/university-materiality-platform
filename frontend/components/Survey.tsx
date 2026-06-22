"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Info, Save, Send } from "lucide-react";

import { api } from "@/lib/api";
import type { Campaign, SurveyScore, Topic } from "@/lib/types";

type Scores = Record<number, Omit<SurveyScore, "topic_id">>;

const ratingLabels = ["極低", "低", "中", "高", "極高"];

const dimensions = [
  { key: "organization_score" as const, label: "組織影響程度", hint: "此議題對學校治理、聲譽、策略與營運的重要性。" },
  { key: "scale_score" as const, label: "衝擊規模", hint: "衝擊對環境、社會或人權造成的嚴重程度。" },
  { key: "scope_score" as const, label: "衝擊範圍", hint: "衝擊涵蓋的人數、地理範圍或價值鏈範圍。" },
  { key: "remediability_score" as const, label: "可補救性", hint: "負面衝擊發生後恢復或補救的難度；正面衝擊可維持預設值。" },
  { key: "impact_likelihood_score" as const, label: "衝擊發生可能性", hint: "實際或潛在衝擊發生的可能程度。" },
  { key: "financial_magnitude_score" as const, label: "財務影響程度", hint: "此議題造成成本、收入、資產或資金影響的程度。" },
  { key: "operational_resilience_score" as const, label: "營運韌性影響", hint: "此議題對學校營運持續性、調適能力或資源配置的影響。" },
  { key: "financial_likelihood_score" as const, label: "財務發生可能性", hint: "財務風險或機會發生的可能程度。" },
];

function defaultScore(): Omit<SurveyScore, "topic_id"> {
  return {
    organization_score: 0,
    actual_or_potential: "actual",
    positive_or_negative: "negative",
    scale_score: 0,
    scope_score: 0,
    remediability_score: 0,
    impact_likelihood_score: 0,
    risk_or_opportunity: "risk",
    time_horizon: "medium",
    financial_magnitude_score: 0,
    operational_resilience_score: 0,
    financial_likelihood_score: 0,
  };
}

export function Survey({ token }: { token: string }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [scores, setScores] = useState<Scores>({});
  const [openAnswer, setOpenAnswer] = useState("");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    Promise.all([
      api<Topic[]>("/topics", {}, token),
      api<Campaign>("/campaigns/active", {}, token),
    ]).then(([topicData, campaignData]) => {
      const storageKey = `survey-draft-${campaignData.id}`;
      const draft = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
      const parsed = draft ? JSON.parse(draft) as { scores?: Scores; openAnswer?: string } : {};
      setTopics(topicData);
      setCampaign(campaignData);
      setScores(parsed.scores || Object.fromEntries(topicData.map((topic) => [topic.id, defaultScore()])));
      setOpenAnswer(parsed.openAnswer || "");
      setLoading(false);
    }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : "問卷載入失敗。");
      setLoading(false);
    });
  }, [token]);

  const categories = useMemo(
    () => [...new Set(topics.map((topic) => topic.category))],
    [topics],
  );
  const currentCategory = categories[step];
  const currentTopics = topics.filter((topic) => topic.category === currentCategory);
  const isReviewStep = step === categories.length;
  const completed = topics.reduce((count, topic) => {
    const value = scores[topic.id];
    return count + (value && dimensions.every((dimension) => value[dimension.key] > 0) ? 1 : 0);
  }, 0);
  const currentComplete = currentTopics.every((topic) =>
    scores[topic.id] && dimensions.every((dimension) => scores[topic.id][dimension.key] > 0),
  );

  function setScore(topicId: number, dimension: keyof Omit<SurveyScore, "topic_id">, value: number | string) {
    setScores((current) => ({
      ...current,
      [topicId]: { ...current[topicId], [dimension]: value },
    }));
  }

  async function saveDraft() {
    if (!campaign) return;
    const payload = { scores, openAnswer };
    window.localStorage.setItem(`survey-draft-${campaign.id}`, JSON.stringify(payload));
    try {
      await api("/surveys/draft", {
        method: "PUT",
        body: JSON.stringify({ campaign_id: campaign.id, payload }),
      }, token);
    } catch {
      // Local draft is still useful for anonymous/demo mode or offline interruptions.
    }
    setSavedAt(new Date().toLocaleTimeString());
  }

  async function submit() {
    if (!campaign) return;
    setSubmitting(true);
    setError("");
    try {
      await api("/surveys/submit", {
        method: "POST",
        body: JSON.stringify({
          campaign_id: campaign.id,
          scores: topics.map((topic) => ({ topic_id: topic.id, ...scores[topic.id] })),
          open_answer: openAnswer,
        }),
      }, token);
      window.localStorage.removeItem(`survey-draft-${campaign.id}`);
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "送出失敗，請再試一次。");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page-loader">正在載入問卷...</div>;
  if (submitted) return (
    <div className="survey-success">
      <span><CheckCircle2 /></span>
      <h1>問卷已送出</h1>
      <p>謝謝您的填答。正式模式下，資料已保存至資料庫，且同一帳號或邀請碼不可重複填答。</p>
    </div>
  );

  return (
    <div className="content-shell survey-shell">
      <header className="survey-header">
        <div>
          <span className="eyebrow green">STAKEHOLDER SURVEY</span>
          <h1>{campaign?.title || "重大性問卷"}</h1>
          <p>請依 1=極低、2=低、3=中、4=高、5=極高 評估每項議題。</p>
        </div>
        <div className="survey-progress">
          <strong>{completed}<small> / {topics.length}</small></strong>
          <span>已完成議題</span>
        </div>
      </header>

      <div className="survey-guide"><Info size={17} /><span>隱私告知：問卷資料僅供永續報告書重大性分析使用；管理者匯出時可使用去識別化資料，AI 分析僅傳送彙整數據。</span></div>

      <div className="stepper">
        {categories.map((category, index) => (
          <button
            key={category}
            className={step === index ? "active" : step > index ? "done" : ""}
            onClick={() => setStep(index)}
          >
            <i>{step > index ? "✓" : index + 1}</i><span>{category}</span>
          </button>
        ))}
        <button className={isReviewStep ? "active" : ""} onClick={() => setStep(categories.length)}>
          <i>{categories.length + 1}</i><span>確認送出</span>
        </button>
      </div>

      {!isReviewStep ? (
        <section className="survey-content">
          {currentTopics.map((topic) => (
            <article className="question-card" key={topic.id}>
              <div className="topic-heading">
                <span>{topic.code}</span>
                <div><h2>{topic.name_zh}</h2><p>{topic.description}</p></div>
              </div>
              <div className="dimension-list">
                <div className="dimension-row">
                  <div><b>IM</b><span><strong>衝擊型態</strong><small>實際/潛在與正面/負面衝擊。</small></span></div>
                  <div className="language-switch">
                    <button type="button" className={scores[topic.id]?.actual_or_potential === "actual" ? "active" : ""} onClick={() => setScore(topic.id, "actual_or_potential", "actual")}>實際</button>
                    <button type="button" className={scores[topic.id]?.actual_or_potential === "potential" ? "active" : ""} onClick={() => setScore(topic.id, "actual_or_potential", "potential")}>潛在</button>
                    <button type="button" className={scores[topic.id]?.positive_or_negative === "positive" ? "active" : ""} onClick={() => setScore(topic.id, "positive_or_negative", "positive")}>正面</button>
                    <button type="button" className={scores[topic.id]?.positive_or_negative === "negative" ? "active" : ""} onClick={() => setScore(topic.id, "positive_or_negative", "negative")}>負面</button>
                  </div>
                </div>
                <div className="dimension-row">
                  <div><b>FM</b><span><strong>財務型態</strong><small>風險/機會與時間尺度。</small></span></div>
                  <div className="language-switch">
                    <button type="button" className={scores[topic.id]?.risk_or_opportunity === "risk" ? "active" : ""} onClick={() => setScore(topic.id, "risk_or_opportunity", "risk")}>風險</button>
                    <button type="button" className={scores[topic.id]?.risk_or_opportunity === "opportunity" ? "active" : ""} onClick={() => setScore(topic.id, "risk_or_opportunity", "opportunity")}>機會</button>
                    <button type="button" className={scores[topic.id]?.time_horizon === "short" ? "active" : ""} onClick={() => setScore(topic.id, "time_horizon", "short")}>短期</button>
                    <button type="button" className={scores[topic.id]?.time_horizon === "medium" ? "active" : ""} onClick={() => setScore(topic.id, "time_horizon", "medium")}>中期</button>
                    <button type="button" className={scores[topic.id]?.time_horizon === "long" ? "active" : ""} onClick={() => setScore(topic.id, "time_horizon", "long")}>長期</button>
                  </div>
                </div>
                {dimensions.map((dimension, index) => (
                  <div className="dimension-row" key={dimension.key}>
                    <div>
                      <b>{index + 1}</b>
                      <span><strong>{dimension.label}</strong><small>{dimension.hint}</small></span>
                    </div>
                    <div className="rating" role="radiogroup" aria-label={`${topic.name_zh} ${dimension.label}`}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          type="button"
                          key={value}
                          title={`${value} = ${ratingLabels[value - 1]}`}
                          className={scores[topic.id]?.[dimension.key] === value ? "selected" : ""}
                          onClick={() => setScore(topic.id, dimension.key, value)}
                        >{value}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="question-card future-card">
          <span className="eyebrow green">REVIEW</span>
          <h2>送出前確認</h2>
          <p>請確認所有議題皆已填答。送出後同一帳號或邀請碼不得重複送出。</p>
          <textarea
            value={openAnswer}
            onChange={(event) => setOpenAnswer(event.target.value)}
            placeholder="其他建議或補充說明（選填）"
            maxLength={2000}
          />
          <small className="char-count">{openAnswer.length} / 2000</small>
          <div className="topic-table-wrap">
            <table className="topic-table">
              <thead><tr><th>議題</th><th>組織</th><th>衝擊平均</th><th>財務平均</th></tr></thead>
              <tbody>
                {topics.map((topic) => {
                  const row = scores[topic.id];
                  const impact = row ? ((row.scale_score + row.scope_score + row.remediability_score + row.impact_likelihood_score) / 4).toFixed(2) : "-";
                  const financial = row ? ((row.financial_magnitude_score + row.operational_resilience_score + row.financial_likelihood_score) / 3).toFixed(2) : "-";
                  return <tr key={topic.id}><td><strong>{topic.code}</strong> {topic.name_zh}</td><td>{row?.organization_score || "-"}</td><td>{impact}</td><td>{financial}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {error && <div className="form-error">{error}</div>}
      <footer className="survey-footer">
        <button className="button secondary" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>
          <ArrowLeft size={16} /> 上一步
        </button>
        <button className="button secondary" type="button" onClick={saveDraft}>
          <Save size={16} /> 暫存{savedAt ? ` ${savedAt}` : ""}
        </button>
        {!isReviewStep ? (
          <button className="button primary" disabled={!currentComplete} onClick={() => setStep((value) => value + 1)}>
            下一步<ArrowRight size={16} />
          </button>
        ) : (
          <button className="button primary" disabled={completed !== topics.length || submitting} onClick={submit}>
            <Send size={16} /> {submitting ? "送出中..." : "確認送出"}
          </button>
        )}
      </footer>
    </div>
  );
}
