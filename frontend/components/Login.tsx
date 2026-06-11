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
  const [email, setEmail] = useState("admin@nuk.edu.tw");
  const [password, setPassword] = useState("admin123");
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
      setError(caught instanceof Error ? caught.message : "登入失敗");
    } finally {
      setLoading(false);
    }
  }

  function useDemo(role: "admin" | "respondent") {
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
          <span>衡鑑</span>
          <small>Materiality OS</small>
        </div>
        <div className="story-copy">
          <span className="eyebrow">SUSTAINABILITY INTELLIGENCE</span>
          <h1>讓每一份聲音，<br />成為永續決策的依據。</h1>
          <p>
            從利害關係人參與到雙重重大性矩陣，將分散的問卷資料轉化為可追溯、可揭露的治理成果。
          </p>
          <div className="feature-row">
            <span><CheckCircle2 size={17} /> ESRS 雙重重大性</span>
            <span><CheckCircle2 size={17} /> GRI 2021</span>
            <span><CheckCircle2 size={17} /> AI 分析</span>
          </div>
        </div>
        <div className="story-stats">
          <div><Building2 /><strong>9</strong><span>利害關係人類別</span></div>
          <div><BarChart3 /><strong>3</strong><span>重大性評估維度</span></div>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="mobile-brand brand">
            <span className="brand-mark"><Leaf size={20} /></span><span>衡鑑</span>
          </div>
          <span className="eyebrow green">WELCOME BACK</span>
          <h2>登入評估平台</h2>
          <p className="muted">使用您的校務帳號或受邀帳號繼續</p>
          {DEMO_MODE && <div className="demo-notice">公開展示模式：所有資料皆為虛構範例，不會上傳或永久保存。</div>}

          <label>
            電子郵件
            <input
              aria-label="電子郵件"
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
          {error && <div className="form-error">{error}</div>}
          <button className="button primary login-button" disabled={loading}>
            {loading ? "登入中..." : "登入平台"} <ArrowRight size={17} />
          </button>

          <div className="demo-box">
            <span>展示帳號</span>
            <button type="button" onClick={() => useDemo("admin")}>管理者</button>
            <button type="button" onClick={() => useDemo("respondent")}>學生填答者</button>
          </div>
          <p className="privacy-note">您的填答資料將依個資保護規範妥善保存</p>
        </form>
      </section>
    </main>
  );
}
