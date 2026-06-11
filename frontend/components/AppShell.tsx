"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  ClipboardList,
  Database,
  FileOutput,
  Leaf,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";

import type { User } from "@/lib/types";
import { DEMO_MODE } from "@/lib/demo";
import { Dashboard } from "./Dashboard";
import { Survey } from "./Survey";

export function AppShell({
  token,
  user,
  onLogout,
}: {
  token: string;
  user: User;
  onLogout: () => void;
}) {
  const [view, setView] = useState(user.role === "admin" ? "dashboard" : "survey");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setView(user.role === "admin" ? "dashboard" : "survey");
  }, [user]);

  const nav = user.role === "admin" ? [
    { id: "dashboard", label: "分析總覽", icon: BarChart3 },
    { id: "survey", label: "問卷預覽", icon: ClipboardList },
    { id: "stakeholders", label: "利害關係人", icon: Users, disabled: true },
    { id: "topics", label: "議題庫", icon: Database, disabled: true },
    { id: "reports", label: "報告管理", icon: FileOutput, disabled: true },
  ] : [
    { id: "survey", label: "重大性問卷", icon: ClipboardList },
  ];

  return (
    <main className="app-frame">
      <button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu /></button>
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <button className="close-sidebar" onClick={() => setMobileOpen(false)}><X /></button>
        <div className="brand">
          <span className="brand-mark"><Leaf size={20} /></span>
          <span>衡鑑</span>
          <small>Materiality OS</small>
        </div>
        <nav>
          <span className="nav-label">工作區</span>
          {nav.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              disabled={item.disabled}
              title={item.disabled ? "將於下一階段開放" : undefined}
              onClick={() => {
                setView(item.id);
                setMobileOpen(false);
              }}
            >
              <item.icon size={18} /> {item.label}
              {item.disabled && <small>soon</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button disabled><Settings size={18} /> 系統設定</button>
          <div className="profile">
            <span>{user.name.slice(0, 1)}</span>
            <div><strong>{user.name}</strong><small>{user.stakeholder_group.name}・{user.role === "admin" ? "管理者" : "填答者"}</small></div>
            <button aria-label="登出" onClick={onLogout}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>
      <section className="main-area">
        {DEMO_MODE && <div className="public-demo-bar">公開展示版・資料皆為虛構範例</div>}
        {view === "dashboard" ? <Dashboard token={token} /> : <Survey token={token} />}
      </section>
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
    </main>
  );
}
