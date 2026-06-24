"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
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

import { DEMO_MODE } from "@/lib/demo";
import type { User } from "@/lib/types";
import { CampaignAdmin } from "./CampaignAdmin";
import { Dashboard } from "./Dashboard";
import { ReportAdmin } from "./ReportAdmin";
import { StakeholderAdmin } from "./StakeholderAdmin";
import { Survey } from "./Survey";
import { TopicAdmin } from "./TopicAdmin";

type NavItem = {
  id: string;
  label: string;
  icon: typeof BarChart3;
};

export function AppShell({
  token,
  user,
  onLogout,
}: {
  token: string;
  user: User;
  onLogout: () => void;
}) {
  const [view, setView] = useState(user.role !== "respondent" ? "dashboard" : "survey");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setView(user.role !== "respondent" ? "dashboard" : "survey");
  }, [user]);

  const canEdit = user.role === "super_admin" || user.role === "admin";
  const nav: NavItem[] = user.role !== "respondent" ? [
    { id: "dashboard", label: "儀表板", icon: BarChart3 },
    ...(canEdit ? [
      { id: "stakeholders", label: "利害關係人", icon: Users },
      { id: "topics", label: "議題庫", icon: Database },
      { id: "campaigns", label: "問卷活動", icon: CalendarDays },
    ] : []),
    { id: "reports", label: "報告管理", icon: FileOutput },
  ] : [
    { id: "survey", label: "問卷填答", icon: ClipboardList },
  ];

  return (
    <main className="app-frame">
      <button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu /></button>
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <button className="close-sidebar" onClick={() => setMobileOpen(false)}><X /></button>
        <div className="brand">
          <span className="brand-mark"><Leaf size={20} /></span>
          <span>永續重大性平台</span>
          <small>Materiality OS</small>
        </div>
        <nav>
          <span className="nav-label">功能</span>
          {nav.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => {
                setView(item.id);
                setMobileOpen(false);
              }}
            >
              <item.icon size={18} /> {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button disabled><Settings size={18} /> 系統設定</button>
          <div className="profile">
            <span>{user.name.slice(0, 1)}</span>
            <div><strong>{user.name}</strong><small>{user.stakeholder_group.name} / {user.role}</small></div>
            <button aria-label="登出" onClick={onLogout}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>
      <section className="main-area">
        {DEMO_MODE && <div className="public-demo-bar">展示模式：使用前端示範資料，不會永久保存填答或管理資料。</div>}
        {view === "survey" && <Survey token={token} />}
        {view === "dashboard" && <Dashboard token={token} />}
        {view === "stakeholders" && <StakeholderAdmin token={token} />}
        {view === "topics" && <TopicAdmin token={token} />}
        {view === "campaigns" && <CampaignAdmin token={token} />}
        {view === "reports" && <ReportAdmin token={token} />}
      </section>
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
    </main>
  );
}
