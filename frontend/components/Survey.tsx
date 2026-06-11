"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Info, Send } from "lucide-react";

import { api } from "@/lib/api";
import type { Campaign, Topic } from "@/lib/types";

type Scores = Record<number, {
  organization_score: number;
  impact_score: number;
  financial_score: number;
}>;

const dimensions = [
  { key: "organization_score" as const, label: "對高雄大學的影響程度", hint: "議題對學校策略、聲譽與整體發展的影響" },
  { key: "impact_score" as const, label: "對環境與社會的影響程度", hint: "學校活動對人群與環境造成的實際或潛在衝擊" },
  { key: "financial_score" as const, label: "對財務及營運風險的影響程度", hint: "議題對財務、營運、資源與韌性的風險或機會" },
];

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

  useEffect(() => {
    Promise.all([
      api<Topic[]>("/topics", {}, token),
      api<Campaign>("/campaigns/active", {}, token),
    ]).then(([topicData, campaignData]) => {
      setTopics(topicData);
      setCampaign(campaignData);
      setScores(Object.fromEntries(topicData.map((topic) => [
        topic.id,
        { organization_score: 0, impact_score: 0, financial_score: 0 },
      ])));
      setLoading(false);
    }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : "問卷載入失敗");
      setLoading(false);
    });
  }, []);

  const categories = useMemo(
    () => [...new Set(topics.map((topic) => topic.category))],
    [topics],
  );
  const currentCategory = categories[step];
  const currentTopics = topics.filter((topic) => topic.category === currentCategory);
  const isFinalStep = step === categories.length;
  const completed = topics.reduce((count, topic) => {
    const value = scores[topic.id];
    return count + (value && Object.values(value).every(Boolean) ? 1 : 0);
  }, 0);
  const currentComplete = currentTopics.every((topic) =>
    scores[topic.id] && Object.values(scores[topic.id]).every(Boolean),
  );

  function setScore(topicId: number, dimension: keyof Scores[number], value: number) {
    setScores((current) => ({
      ...current,
      [topicId]: { ...current[topicId], [dimension]: value },
    }));
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
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "送出失敗");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page-loader">正在準備問卷...</div>;
  if (submitted) return (
    <div className="survey-success">
      <span><CheckCircle2 /></span>
      <h1>感謝您的參與</h1>
      <p>您的評估已安全送出，並納入本期雙重重大性分析。</p>
      <button className="button primary" onClick={() => setSubmitted(false)}>檢視填答內容</button>
    </div>
  );

  return (
    <div className="content-shell survey-shell">
      <header className="survey-header">
        <div>
          <span className="eyebrow green">STAKEHOLDER SURVEY</span>
          <h1>{campaign?.title || "雙重重大性問卷"}</h1>
          <p>請依您的觀察與經驗評估各項永續議題</p>
        </div>
        <div className="survey-progress">
          <strong>{completed}<small> / {topics.length}</small></strong>
          <span>已完成議題</span>
        </div>
      </header>

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
        <button className={isFinalStep ? "active" : ""} onClick={() => setStep(categories.length)}>
          <i>{categories.length + 1}</i><span>未來展望</span>
        </button>
      </div>

      {!isFinalStep ? (
        <section className="survey-content">
          <div className="survey-guide"><Info size={17} /><span>評分說明：1 分代表影響極低，5 分代表影響極高。請完成每個議題的三個維度。</span></div>
          {currentTopics.map((topic, topicIndex) => (
            <article className="question-card" key={topic.id}>
              <div className="topic-heading">
                <span>{topic.code}</span>
                <div><h2>{topic.name_zh}</h2><p>{topic.description}</p></div>
              </div>
              <div className="dimension-list">
                {dimensions.map((dimension, dimensionIndex) => (
                  <div className="dimension-row" key={dimension.key}>
                    <div>
                      <b>{topicIndex * 3 + dimensionIndex + 1}</b>
                      <span><strong>{dimension.label}</strong><small>{dimension.hint}</small></span>
                    </div>
                    <div className="rating" role="radiogroup" aria-label={`${topic.name_zh} ${dimension.label}`}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          type="button"
                          key={value}
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
          <span className="eyebrow green">OPEN RESPONSE</span>
          <h2>您認為未來三年最重要的永續議題為何？</h2>
          <p>可說明您關注的議題、原因或對學校的具體建議。系統將進行去識別化文字分類與頻率分析。</p>
          <textarea
            value={openAnswer}
            onChange={(event) => setOpenAnswer(event.target.value)}
            placeholder="例如：建議學校優先推動能源轉型、強化學生永續素養，並提升資訊安全韌性..."
            maxLength={2000}
          />
          <small className="char-count">{openAnswer.length} / 2000</small>
        </section>
      )}

      {error && <div className="form-error">{error}</div>}
      <footer className="survey-footer">
        <button className="button secondary" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>
          <ArrowLeft size={16} /> 上一步
        </button>
        {!isFinalStep ? (
          <button
            className="button primary"
            disabled={!currentComplete}
            onClick={() => setStep((value) => value + 1)}
          >
            下一步 <ArrowRight size={16} />
          </button>
        ) : (
          <button className="button primary" disabled={completed !== topics.length || submitting} onClick={submit}>
            <Send size={16} /> {submitting ? "送出中..." : "送出問卷"}
          </button>
        )}
      </footer>
    </div>
  );
}

