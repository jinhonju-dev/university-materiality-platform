"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, BarChart3, Building2, CheckCircle2, Leaf } from "lucide-react";

import { api } from "@/lib/api";
import { DEMO_MODE } from "@/lib/demo";
import type { User } from "@/lib/types";

type LoginResponse = {
  access_token: string;
  user: User;
};

export function Login({
  onLogin,
}: {
  onLogin: (token: string, user: User) => void;
}) {
  const [mode, setMode] = useState<"account" | "invite">("account");
  const [email, setEmail] = useState(DEMO_MODE ? "admin@nuk.edu.tw" : "");
  const [password, setPassword] = useState(DEMO_MODE ? "admin123" : "");
  const [campaignId, setCampaignId] = useState("1");
  const [invitationCode, setInvitationCode] = useState(DEMO_MODE ? "DEMO-STUDENT" : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = mode === "account"
        ? await api<LoginResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        })
        : await api<LoginResponse>("/auth/invite", {
          method: "POST",
          body: JSON.stringify({ campaign_id: Number(campaignId), invitation_code: invitationCode }),
        });
      onLogin(result.access_token, result.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登入失敗，請再試一次。");
    } finally {
      setLoading(false);
    }
  }

  function applyDemo(role: "admin" | "respondent") {
    setMode("account");
    if (role === "admin") {
      setEmail("admin@nuk.edu.tw");
      setPassword("admin123");
    } else {
      setEmail("student@nuk.edu.tw");
      setPassword("survey123");
    }
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand brand-light">
          <span className="brand-mark"><Leaf size={21} /></span>
          <span>大學永續重大性平台</span>
          <small>Materiality OS</small>
        </div>
        <div className="story-copy">
          <span className="eyebrow">SUSTAINABILITY INTELLIGENCE</span>
          <h1>正式收集利害關係人問卷，建立可稽核的雙重重大性結果</h1>
          <p>
            平台支援登入填答、匿名邀請碼、資料庫永久保存、加權分析與 Excel/CSV 匯出。
          </p>
          <div className="feature-row">
            <span><CheckCircle2 size={17} /> GRI 2021</span>
            <span><CheckCircle2 size={17} /> 雙重重大性</span>
            <span><CheckCircle2 size={17} /> 去識別化匯出</span>
          </div>
        </div>
        <div className="story-stats">
          <div><Building2 /><strong>9</strong><span>利害關係人類別</span></div>
          <div><BarChart3 /><strong>3</strong><span>E / S / G 議題面向</span></div>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="mobile-brand brand">
            <span className="brand-mark"><Leaf size={20} /></span><span>Materiality OS</span>
          </div>
          <span className="eyebrow green">WELCOME</span>
          <h2>進入問卷與管理平台</h2>
          <p className="muted">正式版不顯示預設帳密；帳號由管理者建立，匿名填答使用一次性邀請碼。</p>
          {DEMO_MODE && <div className="demo-notice">Demo mode 使用示範資料，不會永久保存問卷資料。</div>}

          <div className="language-switch">
            <button type="button" className={mode === "account" ? "active" : ""} onClick={() => setMode("account")}>帳號登入</button>
            <button type="button" className={mode === "invite" ? "active" : ""} onClick={() => setMode("invite")}>邀請碼填答</button>
          </div>

          {mode === "account" ? (
            <>
              <label>
                Email
                <input
                  aria-label="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <label>
                密碼
                <input
                  aria-label="密碼"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
            </>
          ) : (
            <>
              <label>
                問卷活動 ID
                <input
                  aria-label="問卷活動 ID"
                  inputMode="numeric"
                  value={campaignId}
                  onChange={(event) => setCampaignId(event.target.value)}
                  required
                />
              </label>
              <label>
                匿名邀請碼
                <input
                  aria-label="匿名邀請碼"
                  value={invitationCode}
                  onChange={(event) => setInvitationCode(event.target.value)}
                  required
                />
              </label>
            </>
          )}

          {error && <div className="form-error">{error}</div>}
          <button className="button primary login-button" disabled={loading}>
            {loading ? "處理中..." : "進入平台"} <ArrowRight size={17} />
          </button>

          {DEMO_MODE && (
            <div className="demo-box">
              <span>示範帳號</span>
              <button type="button" onClick={() => applyDemo("admin")}>管理者</button>
              <button type="button" onClick={() => applyDemo("respondent")}>填答者</button>
            </div>
          )}
          <p className="privacy-note">問卷資料僅供永續報告書重大性分析使用；匯出時提供去識別化版本。</p>
        </form>
      </section>
    </main>
  );
}
