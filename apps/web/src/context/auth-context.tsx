"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiGet, apiPost, setToken, getToken } from "@/lib/api";
import type { User, AuthResponse } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string, religion?: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await apiGet<User>("/auth/me");
      setUser(me);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const me = await apiGet<User>("/auth/me");
        if (!cancelled) setUser(me);
      } catch {
        setToken(null);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiPost<AuthResponse>("/auth/login", { email, password });
    setToken(data.access_token);
    setUser(data.user);
  }, []);

  const googleLogin = useCallback(async (idToken: string) => {
    const data = await apiPost<AuthResponse>("/auth/google", { id_token: idToken });
    setToken(data.access_token);
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, name?: string, religion?: string) => {
      const data = await apiPost<AuthResponse>("/auth/register", {
        email,
        password,
        name,
        religion: religion || "christian",
      });
      setToken(data.access_token);
      setUser(data.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiPost("/auth/logout");
    } catch {
      // best-effort
    }
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, login, register, googleLogin, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
