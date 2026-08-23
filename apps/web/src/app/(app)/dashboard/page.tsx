"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Reminder } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/lib/i18n";
import { toEthiopian, formatEthiopian } from "@/lib/ethiopian";
import { gregorianHolidaysForDate } from "@/lib/holidays";
import { toHijri, toArabicIndic, HIJRI_MONTHS_EN } from "@/lib/hijri";
import { faithMessage } from "@/lib/faith";
import { ReminderList } from "@/components/reminders/reminder-list";
import { motion } from "framer-motion";
import {
  BookHeart,
  Quote,
  CheckCircle2,
  Target,
  Flame,
  Clock,
  BookOpen,
} from "lucide-react";
import Link from "next/link";

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
};

interface DashboardAnalytics {
  tasks: { total: number; completed: number; pending: number; overdue: number; completion_rate: number };
  habits: { active: number; today_completed: number; streaks: Record<string, number> };
  focus: { total_minutes: number; sessions: number };
  projects: { active: number };
  goals: { active: number };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t, locale } = useLang();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const religion = user?.religion ?? "unspecified";

  const analyticsQuery = useQuery({
    queryKey: ["dashboard-analytics"],
    queryFn: () => apiGet<DashboardAnalytics>("/analytics/dashboard?days=30"),
  });

  const remindersQuery = useQuery({
    queryKey: ["reminders"],
    queryFn: () => apiGet<Reminder[]>("/reminders"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      apiPatch<Reminder>(`/reminders/${id}`, { status: done ? "completed" : "scheduled" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-timeline"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/reminders/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
  });

  const eth = toEthiopian(now);
  const hijri = useMemo(() => toHijri(now), [now]);
  const faith = useMemo(() => faithMessage(now, religion), [now, religion]);
  const holidaysToday = useMemo(() => gregorianHolidaysForDate(now, religion), [now, religion]);

  const reminders = remindersQuery.data ?? [];
  const analytics = analyticsQuery.data;

  const knowledgeQuery = useQuery({
    queryKey: ["dash-knowledge"],
    queryFn: () => apiGet<{ id: string }[]>("/knowledge/spaces"),
  });

  const firstName = user?.name ? user.name.split(" ")[0] : "";

  const userTimezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzNow = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
  const hour = tzNow.getHours();
  const minute = tzNow.getMinutes();
  const second = tzNow.getSeconds();
  const greeting =
    hour < 6
      ? "Good night"
      : hour < 12
        ? t("good_morning")
        : hour < 17
          ? t("good_afternoon")
          : t("good_evening");

  const seconds = second;
  const minutes = minute;
  const hours = hour;

  const tzOptions = userTimezone ? { timeZone: userTimezone } : undefined;
  const gregDate = now.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...tzOptions,
  });

  const timeString = tzNow.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const secondaryDates = useMemo(() => {
    const ethLine = formatEthiopian(eth, "both", "geez").split("\n")[1] || "";
    if (religion === "muslim") {
      return [
        `${HIJRI_MONTHS_EN[hijri.month - 1]} ${toArabicIndic(hijri.day)}، ${toArabicIndic(hijri.year)}`,
      ];
    }
    return [ethLine];
  }, [religion, eth, hijri]);

  const nextHoliday = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 0; i < 90; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const h = gregorianHolidaysForDate(d, religion);
      if (h.length > 0) return { date: d, holidays: h };
    }
    return null;
  }, [now, religion]);

  const pendingCount = reminders.filter((r) => r.status !== "completed").length;
  const topStreak = analytics?.habits.streaks
    ? Object.entries(analytics.habits.streaks).sort(([, a], [, b]) => b - a)[0]
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 md:space-y-8">
      {/* Hero header */}
      <motion.header {...fade} className="flex flex-col items-center pt-2 md:pt-4 text-center">
        <div className="flex items-center gap-3 mb-2">
          <img 
            src="/images/beemuna-logo.png"
            alt="Beemuna" 
            className="h-10 w-10 md:h-14 md:w-14 rounded-2xl shadow-lg shadow-primary/20 border border-white/20"
          />
          <p className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </p>
        </div>

        {/* Pendulum clock + date */}
        <div className="mt-4 md:mt-6 flex items-center gap-4 md:gap-6">
          <div className="glass rounded-2xl p-4 md:p-5">
            {/* SVG Clock Face */}
            <svg viewBox="0 0 200 200" className="h-20 w-20 md:h-36 md:w-36">
              {/* Clock face */}
              <circle cx="100" cy="100" r="95" fill="#f8f8f8" stroke="#e0e0e0" strokeWidth="2" />
              <circle cx="100" cy="100" r="90" fill="none" stroke="#e8e8e8" strokeWidth="0.5" />
              
              {/* Hour markers */}
              {Array.from({ length: 12 }, (_, i) => {
                const angle = (i * 30 - 90) * (Math.PI / 180);
                const isMain = i % 3 === 0;
                const r1 = isMain ? 76 : 80;
                const r2 = 86;
                return (
                  <line
                    key={i}
                    x1={100 + r1 * Math.cos(angle)}
                    y1={100 + r1 * Math.sin(angle)}
                    x2={100 + r2 * Math.cos(angle)}
                    y2={100 + r2 * Math.sin(angle)}
                    stroke={isMain ? "#333" : "#999"}
                    strokeWidth={isMain ? 3 : 1.5}
                    strokeLinecap="round"
                  />
                );
              })}
              
              {/* Hour hand */}
              <line
                x1="100" y1="100"
                x2={100 + 50 * Math.cos(((hours % 12) * 30 + minutes * 0.5 - 90) * Math.PI / 180)}
                y2={100 + 50 * Math.sin(((hours % 12) * 30 + minutes * 0.5 - 90) * Math.PI / 180)}
                stroke="#333" strokeWidth="4" strokeLinecap="round"
              />
              
              {/* Minute hand */}
              <line
                x1="100" y1="100"
                x2={100 + 68 * Math.cos((minutes * 6 + seconds * 0.1 - 90) * Math.PI / 180)}
                y2={100 + 68 * Math.sin((minutes * 6 + seconds * 0.1 - 90) * Math.PI / 180)}
                stroke="#555" strokeWidth="2.5" strokeLinecap="round"
              />
              
              {/* Second hand */}
              <line
                x1="100" y1="100"
                x2={100 + 75 * Math.cos((seconds * 6 - 90) * Math.PI / 180)}
                y2={100 + 75 * Math.sin((seconds * 6 - 90) * Math.PI / 180)}
                stroke="#8B7355" strokeWidth="1.5" strokeLinecap="round"
              />
              
              {/* Center dot */}
              <circle cx="100" cy="100" r="5" fill="#8B7355" />
              <circle cx="100" cy="100" r="2.5" fill="#f8f8f8" />
            </svg>
            
            {/* Pendulum */}
            <div className="pendulum-swing mt-1 flex flex-col items-center">
              <div className="bg-foreground/40" style={{ width: 2, height: "2rem" }} />
              <div className="h-4 w-4 md:h-5 md:w-5 rounded-full bg-primary shadow-sm" />
            </div>
          </div>

          <div className="text-left">
            <p className="text-sm md:text-lg font-semibold text-foreground">{gregDate}</p>
            {secondaryDates.map(
              (line, i) =>
                line && (
                  <p key={i} className="mt-0.5 text-sm text-muted-foreground">
                    {line}
                  </p>
                ),
            )}
            {holidaysToday.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {holidaysToday.map((h) => (
                  <span
                    key={h.nameAm}
                    className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning"
                  >
                    <Quote className="h-3 w-3" />
                    {h.nameAm}
                  </span>
                ))}
              </div>
            )}
            {!holidaysToday.length && nextHoliday && (
              <p className="mt-2 text-xs text-muted-foreground">
                Next: {nextHoliday.holidays[0].nameAm} ·{" "}
                {nextHoliday.date.toLocaleDateString(locale, { month: "short", day: "numeric" })}
              </p>
            )}
          </div>
        </div>
      </motion.header>

      {/* Stats grid */}
      {analytics && (
        <motion.section {...fade} transition={{ duration: 0.4, delay: 0.05 }}>
          <div className="grid grid-cols-2 gap-2 md:gap-3 md:grid-cols-5">
            <Link href="/knowledge" className="glass-card group rounded-2xl p-3 md:p-4 transition-all duration-300 hover:shadow-xl"
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.opacity = ""; }}>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(139,115,85,0.1)", color: "#8B7355" }}>
                  <BookOpen className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </div>
                <span className="text-[11px] md:text-xs font-medium text-muted-foreground">Knowledge</span>
              </div>
              <p className="stat-card-value mt-2 md:mt-3 text-xl md:text-3xl" style={{ color: "#8B7355" }}>{knowledgeQuery.data?.length ?? 0}</p>
              <p className="stat-card-label text-[11px] md:text-sm">notebooks</p>
            </Link>

            <Link href="/tasks" className="glass-card group rounded-2xl p-3 md:p-4 transition-all duration-300 hover:shadow-xl">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </div>
                <span className="text-[11px] md:text-xs font-medium text-muted-foreground">{t("tasks")}</span>
              </div>
              <p className="stat-card-value mt-2 md:mt-3 text-xl md:text-3xl text-primary">{analytics.tasks.completed}</p>
              <p className="stat-card-label text-[11px] md:text-sm">of {analytics.tasks.total} completed</p>
            </Link>

            <Link href="/habits" className="glass-card group rounded-2xl p-3 md:p-4 transition-all duration-300 hover:shadow-xl">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-xl bg-success/10 text-success">
                  <Flame className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </div>
                <span className="text-[11px] md:text-xs font-medium text-muted-foreground">{t("habits")}</span>
              </div>
              <p className="stat-card-value mt-2 md:mt-3 text-xl md:text-3xl text-success">
                {topStreak ? topStreak[1] : 0}
              </p>
              <p className="stat-card-label text-[11px] md:text-sm">day streak{topStreak && topStreak[1] !== 1 ? "s" : ""}</p>
            </Link>

            <Link href="/focus" className="glass-card group rounded-2xl p-3 md:p-4 transition-all duration-300 hover:shadow-xl">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-xl bg-warning/10 text-warning">
                  <Clock className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </div>
                <span className="text-[11px] md:text-xs font-medium text-muted-foreground">{t("focus")}</span>
              </div>
              <p className="stat-card-value mt-2 md:mt-3 text-xl md:text-3xl text-warning">
                {Math.floor(analytics.focus.total_minutes / 60)}h
              </p>
              <p className="stat-card-label text-[11px] md:text-sm">{analytics.focus.total_minutes % 60}m focused</p>
            </Link>

            <Link href="/goals" className="glass-card group rounded-2xl p-3 md:p-4 transition-all duration-300 hover:shadow-xl">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Target className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </div>
                <span className="text-[11px] md:text-xs font-medium text-muted-foreground">{t("goals")}</span>
              </div>
              <p className="stat-card-value mt-2 md:mt-3 text-xl md:text-3xl text-accent-foreground">{analytics.goals.active}</p>
              <p className="stat-card-label">active goals</p>
            </Link>
          </div>
        </motion.section>
      )}

      {/* Faith widget */}
      {faith && (
        <motion.section {...fade} transition={{ duration: 0.4, delay: 0.1 }}>
          <div className="glass rounded-2xl overflow-hidden">
            <div className="relative p-6">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/8 blur-3xl" />
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <BookHeart className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    {religion === "christian"
                      ? t("verse_of_the_day")
                      : religion === "muslim"
                        ? t("ayah_of_the_day")
                        : t("quote_of_the_day")}
                  </p>
                  <blockquote className="mt-3 text-base font-medium leading-relaxed">
                    &ldquo;{faith.verse}&rdquo;
                  </blockquote>
                  <p className="mt-2 text-sm font-semibold text-primary">{faith.reference}</p>
                </div>
              </div>
              <div className="glass-subtle mt-4 rounded-xl p-4">
                <p className="text-xs font-semibold text-foreground">
                  {religion === "christian"
                    ? t("todays_prayer")
                    : religion === "muslim"
                      ? t("todays_dua")
                      : t("todays_advice")}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {faith.message}
                </p>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* Reminders */}
      <motion.section {...fade} transition={{ duration: 0.4, delay: 0.2 }}>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">{t("reminders")}</h2>
          {pendingCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {pendingCount}
            </span>
          )}
        </div>
        <ReminderList
          reminders={reminders}
          onToggle={(id, done) => toggleMutation.mutate({ id, done })}
          onDelete={(id) => deleteMutation.mutate(id)}
          emptyText={t("reminders_empty")}
        />
      </motion.section>
    </div>
  );
}
