"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Login } from "@/components/Login";
import type { User } from "@/lib/types";

export default function Home() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem("materiality_token");
    const savedUser = localStorage.getItem("materiality_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setReady(true);
  }, []);

  function login(nextToken: string, nextUser: User) {
    localStorage.setItem("materiality_token", nextToken);
    localStorage.setItem("materiality_user", JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }

  function logout() {
    localStorage.removeItem("materiality_token");
    localStorage.removeItem("materiality_user");
    setToken("");
    setUser(null);
  }

  if (!ready) return null;
  return user && token
    ? <AppShell token={token} user={user} onLogout={logout} />
    : <Login onLogin={login} />;
}

