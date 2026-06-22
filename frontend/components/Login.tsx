"use client";

import Link from "next/link";
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
  const [email, setEmail] = useState(DEMO_MODE ? "admin@nuk.edu.tw" : "");
  const [password, setPassword] = useState(DEMO_MODE ? "admin123" : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onLogin(result.access_token, result.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登入失敗，請確認帳號密碼。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand brand-light">
          <span className="brand-mark"><Leaf size={21} /></span>
          <span>永續重大性評估平台</span>
          <small>Materiality OS</small>
        </div>
        <div className="story-copy">
          <span className="eyebrow">SUSTAINABILITY INTELLIGENCE</span>
          <h1>大學永續報告書利害關係人調查與雙重重大性評估</h1>
          <p>正式版支援關注度調查、專家重大性評估、邀請碼、權限控管、資料庫保存與報告匯出。</p>
          <div className="feature-row">
            <span><CheckCircle2 size={17} /> GRI 2021</span>
            <span><CheckCircle2 size={17} /> 雙重重大性</span>
            <span><CheckCircle2 size={17} /> 正式資料保存</span>
          </div>
        </div>
        <div className="story-stats">
          <div><Building2 /><strong>9</strong><span>利害關係人類別</span></div>
          <div><BarChart3 /><strong>2</strong><span>兩階段問卷</span></div>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="mobile-brand brand">
            <span className="brand-mark"><Leaf size={20} /></span><span>Materiality OS</span>
          </div>
          <span className="eyebrow green">{DEMO_MODE ? "展示模式" : "Production Mode"}</span>
          <h2>管理者登入</h2>
          <p className="muted">
            填答者不需要正式帳號。關注度調查請使用公開連結；專家重大性評估請使用管理者核發的邀請碼。
          </p>
          {DEMO_MODE && <div className="demo-notice">展示模式：使用展示資料與展示帳號，不會永久保存正式問卷。</div>}

          <label>
            Email
            <input aria-label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            密碼
            <input aria-label="密碼" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>

          {error && <div className="form-error">{error}</div>}
          <button className="button primary login-button" disabled={loading}>
            {loading ? "登入中..." : "登入管理後台"} <ArrowRight size={17} />
          </button>

          {DEMO_MODE && (
            <div className="demo-box">
              <span>展示帳號</span>
              <button type="button" onClick={() => { setEmail("admin@nuk.edu.tw"); setPassword("admin123"); }}>帶入展示管理者</button>
            </div>
          )}

          <div className="button-row">
            <Link className="button secondary" href="/survey/concern">填寫關注度調查</Link>
            <Link className="button secondary" href="/survey/expert">專家重大性評估</Link>
          </div>
          <p className="privacy-note">Production Mode 不會產生 demo 帳號，也不使用 admin123 / survey123 作為正式密碼。</p>
        </form>
      </section>
    </main>
  );
}
