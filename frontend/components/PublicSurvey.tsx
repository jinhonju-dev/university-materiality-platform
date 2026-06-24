"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Save, Send } from "lucide-react";

import { api } from "@/lib/api";
import { DEMO_MODE } from "@/lib/demo";
import type { ExpertSurveyScore, PublicSurveyConfig, Topic } from "@/lib/types";

type Mode = "concern" | "expert";
type ConcernScores = Record<number, number>;
type ExpertField = (typeof expertFields)[number];
type ExpertTopicScores = Partial<Record<ExpertField, number | null>>;
type ExpertScores = Record<number, ExpertTopicScores>;

const concernStakeholderOrder = ["學生", "教師", "職員", "校友", "政府機關", "企業／廠商", "社區居民", "NGO／社團", "其他"];

const expertScaleOptions = [
  { label: "極低", value: 1 },
  { label: "低", value: 2 },
  { label: "中等", value: 3 },
  { label: "高", value: 4 },
  { label: "極高／已發生", value: 5 },
  { label: "不清楚", value: null },
] as const;

const concernScaleOptions = [
  { label: "1 極低", value: 1 },
  { label: "2 低", value: 2 },
  { label: "3 中等", value: 3 },
  { label: "4 高", value: 4 },
  { label: "5 極高", value: 5 },
] as const;

const expertFields = [
  "positive_likelihood_score",
  "positive_impact_magnitude_score",
  "negative_likelihood_score",
  "negative_impact_magnitude_score",
  "enrollment_revenue_score",
  "reputation_score",
  "operating_cost_score",
  "funding_score",
  "legal_responsibility_score",
  "financial_likelihood_score",
] as const;

const expertFieldLabels: Record<ExpertField, string> = {
  positive_likelihood_score: "正面情境發生可能性",
  positive_impact_magnitude_score: "正面效益程度",
  negative_likelihood_score: "負面情境發生可能性",
  negative_impact_magnitude_score: "負面損害程度",
  enrollment_revenue_score: "招生數／服務收益",
  reputation_score: "學校校譽",
  operating_cost_score: "營運成本",
  funding_score: "獲得資金／補助",
  legal_responsibility_score: "法律責任",
  financial_likelihood_score: "財務或營運影響可能性",
};

const financialNotes = [
  "招生數／服務收益：學生招生人數、學費收入、推廣教育或產學合作收益。",
  "學校校譽：學校形象、社會信任、國際排名或評鑑結果。",
  "營運成本：能源成本、人事成本、維運支出等。",
  "獲得資金／補助：政府補助、研究經費或企業合作資源的取得。",
  "法律責任：涉及法規遵循、罰則風險或治理責任。",
];

export function PublicSurvey({ mode }: { mode: Mode }) {
  const [config, setConfig] = useState<PublicSurveyConfig | null>(null);
  const [stakeholderGroupId, setStakeholderGroupId] = useState("");
  const [invitationCode, setInvitationCode] = useState(DEMO_MODE && mode === "expert" ? "DEMO-EXPERT" : "");
  const [concernScores, setConcernScores] = useState<ConcernScores>({});
  const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({});
  const [expertScores, setExpertScores] = useState<ExpertScores>({});
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [openAnswer, setOpenAnswer] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const path = mode === "concern" ? "/surveys/concern/current" : "/surveys/expert/current";
    api<PublicSurveyConfig>(path)
      .then((data) => {
        setConfig(data);
        const orderedGroups = orderedStakeholderGroups(data);
        setStakeholderGroupId(String(orderedGroups[0]?.id || ""));
        setConcernScores(Object.fromEntries(data.topics.map((topic) => [topic.id, 0])));
        setExpertScores(Object.fromEntries(data.topics.map((topic) => [topic.id, {}])));
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "無法載入問卷資料"))
      .finally(() => setLoading(false));
  }, [mode]);

  const concernMissingTopics = useMemo(() => {
    if (!config) return [];
    return config.topics.filter((topic) => !concernScores[topic.id]);
  }, [config, concernScores]);

  const expertReview = useMemo(() => {
    if (!config) return { completeCount: 0, missing: [] as { topic: Topic; fields: ExpertField[] }[], unknownCount: 0, totalFields: 0 };
    let unknownCount = 0;
    let totalFields = 0;
    const missing = config.topics.map((topic) => {
      const scores = expertScores[topic.id] || {};
      expertFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(scores, field)) {
          totalFields += 1;
          if (scores[field] === null) unknownCount += 1;
        }
      });
      return {
        topic,
        fields: expertFields.filter((field) => !Object.prototype.hasOwnProperty.call(scores, field)),
      };
    }).filter((item) => item.fields.length > 0);
    return {
      completeCount: config.topics.length - missing.length,
      missing,
      unknownCount,
      totalFields,
    };
  }, [config, expertScores]);

  const progress = mode === "expert"
    ? { done: expertReview.completeCount, total: config?.topics.length || 0 }
    : { done: config ? config.topics.length - concernMissingTopics.length : 0, total: config?.topics.length || 0 };

  function setExpertScore(topicId: number, key: ExpertField, value: number | null) {
    setDraftMessage("");
    setExpertScores((current) => ({
      ...current,
      [topicId]: { ...current[topicId], [key]: value },
    }));
  }

  function buildExpertPayload(): ExpertSurveyScore[] {
    if (!config) return [];
    return config.topics.map((topic) => ({
      topic_id: topic.id,
      ...expertScores[topic.id],
    }));
  }

  function checkBeforeSubmit() {
    setError("");
    setReviewing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveDraft() {
    if (!config || mode !== "expert") return;
    setDrafting(true);
    setError("");
    setDraftMessage("");
    try {
      await api("/surveys/expert/draft", {
        method: "POST",
        body: JSON.stringify({
          campaign_id: config.campaign.id,
          invitation_code: invitationCode,
          payload: {
            scores: buildExpertPayload(),
            open_answer: openAnswer,
            saved_at: new Date().toISOString(),
          },
        }),
      });
      setDraftMessage("已暫存本次填答進度。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "暫存失敗，請稍後再試");
    } finally {
      setDrafting(false);
    }
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!config) return;
    setSubmitting(true);
    setError("");
    setDraftMessage("");
    try {
      if (mode === "concern") {
        if (concernMissingTopics.length) {
          setReviewing(true);
          throw new Error("尚有議題未完成評分，請回到問卷補齊後再送出。");
        }
        await api("/surveys/concern/submit", {
          method: "POST",
          body: JSON.stringify({
            campaign_id: config.campaign.id,
            stakeholder_group_id: Number(stakeholderGroupId),
            scores: config.topics.map((topic) => ({ topic_id: topic.id, concern_score: concernScores[topic.id] })),
            open_answer: openAnswer,
          }),
        });
      } else {
        if (expertReview.missing.length) {
          setReviewing(true);
          throw new Error("尚有專家評估題目未完成。若無法判斷，請選擇「不清楚」。");
        }
        await api("/surveys/expert/submit", {
          method: "POST",
          body: JSON.stringify({
            campaign_id: config.campaign.id,
            invitation_code: invitationCode,
            scores: buildExpertPayload(),
            open_answer: openAnswer,
          }),
        });
      }
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "送出失敗，請確認資料後再試");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page-loader">載入問卷中...</div>;
  if (!config) return <div className="error-state">{error}</div>;
  if (submitted) return <SurveyThanks mode={mode} />;

  const currentTopic = config.topics[currentTopicIndex];
  const unknownRatio = expertReview.totalFields ? Math.round((expertReview.unknownCount / expertReview.totalFields) * 1000) / 10 : 0;

  return (
    <main className={`content-shell survey-shell public-survey ${mode === "expert" ? "expert-card-survey" : "concern-survey"}`}>
      {DEMO_MODE && <div className="public-demo-bar">展示模式：資料僅供功能預覽，不代表正式填答紀錄。</div>}
      <SurveyHeader mode={mode} config={config} progress={progress} />

      {reviewing ? (
        <ReviewPanel
          mode={mode}
          config={config}
          stakeholderGroupId={stakeholderGroupId}
          concernScores={concernScores}
          concernMissingTopics={concernMissingTopics}
          expertReview={expertReview}
          unknownRatio={unknownRatio}
          submitting={submitting}
          error={error}
          onBack={() => setReviewing(false)}
          onSubmit={() => void submit()}
        />
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); checkBeforeSubmit(); }}>
          <SurveyIntro mode={mode} config={config} />

          {mode === "concern" ? (
            <>
              <section className="question-card">
                <label>
                  請選擇您的利害關係人類別 <span className="required">*</span>
                  <select value={stakeholderGroupId} onChange={(event) => setStakeholderGroupId(event.target.value)} required>
                    {orderedStakeholderGroups(config).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </label>
              </section>
              <section className="concern-topic-list">
                {config.topics.map((topic) => (
                  <ConcernTopicCard
                    key={topic.id}
                    topic={topic}
                    score={concernScores[topic.id]}
                    expanded={!!expandedTopics[topic.id]}
                    onToggle={() => setExpandedTopics((current) => ({ ...current, [topic.id]: !current[topic.id] }))}
                    onScore={(score) => setConcernScores((current) => ({ ...current, [topic.id]: score }))}
                  />
                ))}
              </section>
            </>
          ) : (
            <>
              <section className="question-card">
                <label>
                  專家評估邀請碼 <span className="required">*</span>
                  <input value={invitationCode} onChange={(event) => setInvitationCode(event.target.value)} required />
                </label>
              </section>
              <ExpertTopicCard
                topic={currentTopic}
                index={currentTopicIndex}
                total={config.topics.length}
                scores={expertScores[currentTopic.id] || {}}
                onScore={(key, value) => setExpertScore(currentTopic.id, key, value)}
              />
              <div className="topic-nav">
                <button className="button secondary" type="button" disabled={currentTopicIndex === 0} onClick={() => setCurrentTopicIndex((value) => Math.max(0, value - 1))}>
                  <ArrowLeft size={16} />上一題
                </button>
                <button className="button secondary" type="button" disabled={currentTopicIndex >= config.topics.length - 1} onClick={() => setCurrentTopicIndex((value) => Math.min(config.topics.length - 1, value + 1))}>
                  下一題<ArrowRight size={16} />
                </button>
              </div>
            </>
          )}

          <section className="question-card">
            <label>
              開放意見
              <textarea
                value={openAnswer}
                onChange={(event) => setOpenAnswer(event.target.value)}
                maxLength={2000}
                placeholder="請勿填寫姓名、email、電話或其他可識別個人身分的資料。"
              />
            </label>
          </section>
          {draftMessage && <div className="success-state">{draftMessage}</div>}
          {error && <div className="form-error">{error}</div>}
          <footer className="survey-footer sticky-actions">
            {mode === "expert" && (
              <button className="button secondary" type="button" onClick={saveDraft} disabled={drafting || submitting || !invitationCode}>
                <Save size={16} /> {drafting ? "暫存中..." : "儲存草稿"}
              </button>
            )}
            <button className="button primary" type="submit">
              <AlertCircle size={16} />送出前檢查
            </button>
          </footer>
        </form>
      )}
    </main>
  );
}

function orderedStakeholderGroups(config: PublicSurveyConfig) {
  return [...config.stakeholder_groups].sort((a, b) => {
    const aIndex = concernStakeholderOrder.indexOf(a.name);
    const bIndex = concernStakeholderOrder.indexOf(b.name);
    if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
}

function SurveyHeader({ mode, config, progress }: { mode: Mode; config: PublicSurveyConfig; progress: { done: number; total: number } }) {
  return (
    <header className="survey-header">
      <div>
        <span className="eyebrow green">{mode === "concern" ? "CONCERN SURVEY" : "EXPERT ASSESSMENT"}</span>
        <h1>{mode === "concern" ? "利害關係人關注度調查" : "專家重大性評估"}</h1>
        <p>{config.campaign.name || config.campaign.title}</p>
      </div>
      <strong className="survey-progress">{progress.done}/{progress.total} 議題已完成</strong>
    </header>
  );
}

function SurveyIntro({ mode, config }: { mode: Mode; config: PublicSurveyConfig }) {
  return (
    <section className="survey-intro-grid">
      <article className="question-card">
        <span className="eyebrow green">調查說明</span>
        <h2>{mode === "concern" ? "請評估您對各永續議題的關注程度" : "請依專業判斷評估衝擊與財務重大性"}</h2>
        <p>
          {mode === "concern"
            ? "本調查對象為所有利害關係人，不需登入或邀請碼。評分結果將作為永續報告書重大主題排序與佐證。"
            : "本評估對象為學校主管、學術單位主管與永續專責人員，需輸入邀請碼。系統會依後端正式公式計算雙重重大性分數。"}
        </p>
      </article>
      <article className="question-card">
        <span className="eyebrow green">隱私告知</span>
        <h2>填答資料將以彙整方式分析</h2>
        <p>{config.campaign.privacy_notice || "請勿於開放意見填寫姓名、email、電話、地址或其他可識別個人身分之資料。分析與報告將以彙整資料呈現。"}</p>
      </article>
    </section>
  );
}

function ConcernTopicCard({
  topic,
  score,
  expanded,
  onToggle,
  onScore,
}: {
  topic: Topic;
  score: number;
  expanded: boolean;
  onToggle: () => void;
  onScore: (score: number) => void;
}) {
  return (
    <article className={`concern-topic-card ${score ? "complete" : ""}`}>
      <div className="concern-topic-main">
        <span className={`category ${topic.category}`}>{topic.category}</span>
        <div>
          <h2>{topic.topic_code || topic.code} {topic.name_zh}</h2>
          <button type="button" className="text-button" onClick={onToggle}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? "收合議題說明" : "查看議題說明"}
          </button>
        </div>
        <strong>{score ? "已完成" : "未填"}</strong>
      </div>
      {expanded && <p className="concern-topic-description">{topic.scenario_description || topic.description || "此議題可能影響學校永續治理與利害關係人關注，請依您的感受評估關注程度。"}</p>}
      <div className="concern-rating-row" role="radiogroup" aria-label={`${topic.name_zh} 關注程度`}>
        {concernScaleOptions.map((option) => (
          <label key={option.value} className={score === option.value ? "selected" : ""}>
            <input type="radio" name={`concern-${topic.id}`} checked={score === option.value} onChange={() => onScore(option.value)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </article>
  );
}

function ExpertTopicCard({
  topic,
  index,
  total,
  scores,
  onScore,
}: {
  topic: Topic;
  index: number;
  total: number;
  scores: ExpertTopicScores;
  onScore: (key: ExpertField, value: number | null) => void;
}) {
  const complete = expertFields.every((key) => Object.prototype.hasOwnProperty.call(scores, key));
  const preview = calculateExpertPreview(scores);
  return (
    <article className="expert-topic-card">
      <div className="expert-topic-title">
        <h2>{index + 1}. {topic.name_zh}</h2>
        <div className="expert-title-tags">
          <span>{topic.topic_code || topic.code}</span>
          <span>{topic.category}</span>
          <span>{index + 1}/{total}</span>
        </div>
      </div>
      <div className="expert-topic-description">
        <strong>議題範疇／情境描述</strong>
        <p>{topic.scenario_description || topic.description || "此議題可能影響學校治理、營運、聲譽、資源取得或風險管理，請依您的專業判斷進行評估。"}</p>
      </div>

      <ExpertSection title="（1）正面情境：若此議題發展良好，將提升學校管理效能與永續績效。">
        <ScoreRow name={`${topic.id}-positive-likelihood`} label="未來3～5年內，本校發生此正面情境的可能性？" value={scores.positive_likelihood_score} onChange={(value) => onScore("positive_likelihood_score", value)} required />
        <ScoreRow name={`${topic.id}-positive-magnitude`} label="帶來的效益程度為何？" value={scores.positive_impact_magnitude_score} onChange={(value) => onScore("positive_impact_magnitude_score", value)} required />
      </ExpertSection>

      <ExpertSection title="（2）負面情境：若此議題管理不善，將影響學校營運與內部治理。">
        <ScoreRow name={`${topic.id}-negative-likelihood`} label="未來3～5年內，本校發生此負面情境的可能性？" value={scores.negative_likelihood_score} onChange={(value) => onScore("negative_likelihood_score", value)} required />
        <ScoreRow name={`${topic.id}-negative-magnitude`} label="帶來的損害程度為何？" value={scores.negative_impact_magnitude_score} onChange={(value) => onScore("negative_impact_magnitude_score", value)} required />
      </ExpertSection>

      <ExpertSection title="（3）財務重大性評估">
        <div className="financial-notes">
          {financialNotes.map((note) => <p key={note}>{note}</p>)}
        </div>
        <ScoreRow name={`${topic.id}-enrollment-revenue`} label="對招生數／服務收益的影響？" value={scores.enrollment_revenue_score} onChange={(value) => onScore("enrollment_revenue_score", value)} required />
        <ScoreRow name={`${topic.id}-reputation`} label="對學校校譽的影響？" value={scores.reputation_score} onChange={(value) => onScore("reputation_score", value)} required />
        <ScoreRow name={`${topic.id}-operating-cost`} label="對營運成本的影響？" value={scores.operating_cost_score} onChange={(value) => onScore("operating_cost_score", value)} required />
        <ScoreRow name={`${topic.id}-funding`} label="對獲得資金／補助的影響？" value={scores.funding_score} onChange={(value) => onScore("funding_score", value)} required />
        <ScoreRow name={`${topic.id}-legal-responsibility`} label="對法律責任的影響？" value={scores.legal_responsibility_score} onChange={(value) => onScore("legal_responsibility_score", value)} required />
        <ScoreRow name={`${topic.id}-financial-likelihood`} label="未來3～5年內，對本校財務或營運造成影響的可能性？" value={scores.financial_likelihood_score} onChange={(value) => onScore("financial_likelihood_score", value)} required />
      </ExpertSection>

      <div className={complete ? "card-status complete" : "card-status"}>
        {complete ? "已完成" : "尚有未填項目"}
        <small>
          前端提示：衝擊重大性 {preview.impact ?? "待完成"}；財務重大性 {preview.financial ?? "待完成"}。正式分數仍以後端計算為準。
        </small>
      </div>
    </article>
  );
}

function calculateExpertPreview(scores: ExpertTopicScores) {
  const positive = scores.positive_likelihood_score && scores.positive_impact_magnitude_score
    ? scores.positive_likelihood_score * scores.positive_impact_magnitude_score / 5
    : null;
  const negative = scores.negative_likelihood_score && scores.negative_impact_magnitude_score
    ? scores.negative_likelihood_score * scores.negative_impact_magnitude_score / 5
    : null;
  const financialValues = [
    scores.enrollment_revenue_score,
    scores.reputation_score,
    scores.operating_cost_score,
    scores.funding_score,
    scores.legal_responsibility_score,
  ].filter((value): value is number => typeof value === "number");
  const financialMagnitude = financialValues.length ? financialValues.reduce((sum, value) => sum + value, 0) / financialValues.length : null;
  return {
    impact: positive !== null || negative !== null ? Math.max(positive || 0, negative || 0).toFixed(2) : null,
    financial: financialMagnitude !== null && scores.financial_likelihood_score ? (scores.financial_likelihood_score * financialMagnitude / 5).toFixed(2) : null,
  };
}

function ExpertSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="expert-section">
      <h3>{title}</h3>
      <div className="score-table-wrap">
        <div className="score-table">{children}</div>
      </div>
    </section>
  );
}

function ScoreRow({
  name,
  label,
  value,
  onChange,
  required,
}: {
  name: string;
  label: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  required?: boolean;
}) {
  return (
    <div className="score-row">
      <div className="score-question">{label} {required && <span className="required">*</span>}</div>
      <div className="score-scale" role="radiogroup" aria-label={label}>
        {expertScaleOptions.map((option) => (
          <label key={option.label} className={value === option.value ? "selected" : ""}>
            <input type="radio" name={name} checked={value === option.value} onChange={() => onChange(option.value)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ReviewPanel({
  mode,
  config,
  stakeholderGroupId,
  concernScores,
  concernMissingTopics,
  expertReview,
  unknownRatio,
  submitting,
  error,
  onBack,
  onSubmit,
}: {
  mode: Mode;
  config: PublicSurveyConfig;
  stakeholderGroupId: string;
  concernScores: ConcernScores;
  concernMissingTopics: Topic[];
  expertReview: { completeCount: number; missing: { topic: Topic; fields: ExpertField[] }[]; unknownCount: number; totalFields: number };
  unknownRatio: number;
  submitting: boolean;
  error: string;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const selectedGroup = config.stakeholder_groups.find((group) => String(group.id) === stakeholderGroupId);
  const hasMissing = mode === "concern" ? concernMissingTopics.length > 0 : expertReview.missing.length > 0;
  return (
    <section className="review-panel">
      <div className="question-card">
        <span className="eyebrow green">送出前確認</span>
        <h2>{hasMissing ? "尚有未完成項目" : "填答內容已可送出"}</h2>
        <p>{mode === "concern" ? `身分類別：${selectedGroup?.name || "未選擇"}` : `專家評估完成 ${expertReview.completeCount} / ${config.topics.length} 項議題，不清楚比例 ${unknownRatio.toFixed(1)}%。`}</p>
      </div>

      {mode === "concern" ? (
        <article className="question-card">
          <h3>關注度調查檢查</h3>
          {concernMissingTopics.length ? (
            <ul className="review-list warning-list">
              {concernMissingTopics.map((topic) => <li key={topic.id}>{topic.topic_code || topic.code} {topic.name_zh} 尚未評分</li>)}
            </ul>
          ) : (
            <div className="review-score-grid">
              {config.topics.map((topic) => <span key={topic.id}>{topic.topic_code || topic.code}：{concernScores[topic.id]} 分</span>)}
            </div>
          )}
        </article>
      ) : (
        <article className="question-card">
          <h3>專家重大性評估檢查</h3>
          {expertReview.missing.length ? (
            <ul className="review-list warning-list">
              {expertReview.missing.map((item) => (
                <li key={item.topic.id}>
                  {item.topic.topic_code || item.topic.code} {item.topic.name_zh}：缺 {item.fields.map((field) => expertFieldLabels[field]).join("、")}
                </li>
              ))}
            </ul>
          ) : (
            <p className="success-state">所有議題已完成。選擇「不清楚」的題目會以 null 送出，且不納入平均。</p>
          )}
        </article>
      )}

      {error && <div className="form-error">{error}</div>}
      <footer className="survey-footer">
        <button className="button secondary" type="button" onClick={onBack}><ArrowLeft size={16} />回到問卷修改</button>
        <button className="button primary" type="button" disabled={submitting || hasMissing} onClick={onSubmit}>
          <Send size={16} />{submitting ? "送出中..." : "確認送出"}
        </button>
      </footer>
    </section>
  );
}

function SurveyThanks({ mode }: { mode: Mode }) {
  return (
    <main className="survey-success">
      <span><CheckCircle2 /></span>
      <h1>{mode === "concern" ? "感謝您完成關注度調查" : "感謝您完成專家重大性評估"}</h1>
      <p>問卷已完成送出，本次資料將作為大學永續報告書重大主題鑑別與利害關係人溝通之參考。</p>
    </main>
  );
}
