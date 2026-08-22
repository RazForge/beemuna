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

  const religion = user?.religion ?? "christian";

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

  const hour = now.getHours();
  const greeting =
    hour < 6
      ? "Good night"
      : hour < 12
        ? t("good_morning")
        : hour < 17
          ? t("good_afternoon")
          : t("good_evening");
  const firstName = user?.name ? user.name.split(" ")[0] : "";

  const seconds = now.getSeconds();
  const minutes = now.getMinutes();
  const hours = now.getHours();
  const secondAngle = (seconds / 60) * 360;
  const minuteAngle = ((minutes + seconds / 60) / 60) * 360;
  const hourAngle = (((hours % 12) + minutes / 60 + seconds / 3600) / 12) * 360;

  const gregDate = now.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
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
        <p className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </p>

        {/* Compact clock + date */}
        <div className="mt-4 md:mt-6 flex items-center gap-4 md:gap-6">
          <div className="relative h-24 w-24 md:h-40 md:w-40 rounded-full border border-border bg-gradient-to-b from-card to-muted/30">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className="absolute inset-0" style={{ transform: `rotate(${i * 30}deg)` }}>
                <span
                  className={`absolute left-1/2 top-1.5 -translate-x-1/2 rounded-full ${
                    i % 3 === 0 ? "h-2.5 w-[2px] md:h-3 md:w-[3px] bg-foreground/70" : "h-1 w-[1px] md:h-1.5 md:w-[1.5px] bg-foreground/30"
                  }`}
                />
              </span>
            ))}
            <motion.div
              className="absolute left-1/2 top-1/2 h-[2px] md:h-[3px] w-8 md:w-12 rounded-full bg-foreground"
              style={{ transformOrigin: "0% 50%" }}
              animate={{ rotate: hourAngle }}
              transition={{ type: "spring", stiffness: 60, damping: 15 }}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 h-[2px] w-10 md:w-16 rounded-full bg-foreground/70"
              style={{ transformOrigin: "0% 50%" }}
              animate={{ rotate: minuteAngle }}
              transition={{ type: "spring", stiffness: 120, damping: 15 }}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 h-px w-12 md:w-18 rounded-full bg-primary"
              style={{ transformOrigin: "0% 50%" }}
              animate={{ rotate: secondAngle }}
              transition={{ duration: 1, ease: "linear" }}
            />
            <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 md:h-2 md:w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-md" />
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
          <div className="grid grid-cols-2 gap-2 md:gap-3 md:grid-cols-4">
            <Link href="/tasks" className="stat-card group hover:border-primary/30 hover:bg-primary/5 transition-colors">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </div>
                <span className="text-[11px] md:text-xs font-medium text-muted-foreground">{t("tasks")}</span>
              </div>
              <p className="stat-card-value mt-2 md:mt-3 text-xl md:text-3xl text-primary">{analytics.tasks.completed}</p>
              <p className="stat-card-label text-[11px] md:text-sm">of {analytics.tasks.total} completed</p>
            </Link>

            <Link href="/habits" className="stat-card group hover:border-success/30 hover:bg-success/5 transition-colors">
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

            <Link href="/focus" className="stat-card group hover:border-warning/30 hover:bg-warning/5 transition-colors">
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

            <Link href="/goals" className="stat-card group hover:border-accent-foreground/30 hover:bg-accent/50 transition-colors">
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
          <div className="apple-card overflow-hidden">
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
              <div className="mt-4 rounded-xl bg-muted/50 p-4">
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
