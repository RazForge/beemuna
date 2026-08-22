"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Trophy,
  Map,
  TrendingUp,
  Clock,
  Zap,
  Star,
  ChevronRight,
  CheckCircle2,
  Lock,
  Sparkles,
  ArrowLeft,
} from "lucide-react";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  badge_color: string | null;
  category: string;
  tier: string;
  points: number;
  unlocked_at: string;
  seen: boolean;
}

interface Stage {
  name: string;
  desc: string;
  icon: string;
  threshold: number;
  reached: boolean;
}

interface ProgressPath {
  id: string;
  name: string;
  slug: string;
  icon: string;
  category: string;
  current_stage: { name: string; desc: string; icon: string; threshold: number } | null;
  current_stage_index: number;
  total_stages: number;
  progress_pct: number;
  completed: boolean;
  stages: Stage[];
}

interface LifeScore {
  productivity: number;
  knowledge: number;
  health: number;
  faith: number;
  learning: number;
  overall: number;
}

interface TimelineItem {
  id: string;
  type: string;
  title: string;
  occurred_at: string;
  meta: Record<string, unknown>;
}

type Tab = "timeline" | "achievements" | "paths" | "score";

const TABS: { key: Tab; label: string; icon: typeof Trophy }[] = [
  { key: "timeline", label: "Timeline", icon: Clock },
  { key: "achievements", label: "Achievements", icon: Trophy },
  { key: "paths", label: "Paths", icon: Map },
  { key: "score", label: "Life Score", icon: TrendingUp },
];

const TIER_COLORS: Record<string, string> = {
  bronze: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  silver: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
  gold: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
};

const CATEGORY_ICONS: Record<string, string> = {
  productivity: "⚡",
  knowledge: "📚",
  health: "💪",
  faith: "🙏",
  reflection: "🪞",
  intelligence: "🧠",
  learning: "🎓",
  general: "🌟",
};

const SCORE_COLORS: Record<string, string> = {
  productivity: "bg-primary",
  knowledge: "bg-blue-500",
  health: "bg-success",
  faith: "bg-purple-500",
  learning: "bg-warning",
};

const fade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

export default function JourneyPage() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("timeline");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const achievementsQuery = useQuery({
    queryKey: ["journey-achievements"],
    queryFn: () => apiGet<{ achievements: Achievement[]; total_points: number; total_unlocked: number }>("/journey/achievements"),
  });

  const pathsQuery = useQuery({
    queryKey: ["journey-paths"],
    queryFn: () => apiGet<ProgressPath[]>("/journey/paths"),
  });

  const lifeScoreQuery = useQuery({
    queryKey: ["journey-life-score"],
    queryFn: () => apiGet<LifeScore>("/journey/life-score"),
  });

  const timelineQuery = useQuery({
    queryKey: ["journey-timeline"],
    queryFn: () => apiGet<{ timeline: TimelineItem[]; recent_achievements: Achievement[] }>("/journey/timeline?limit=50"),
  });

  const checkMutation = useMutation({
    mutationFn: () => apiPost<{ newly_unlocked: Achievement[]; count: number }>("/journey/achievements/check"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["journey-achievements"] });
      queryClient.invalidateQueries({ queryKey: ["journey-timeline"] });
      if (data.count > 0) {
        queryClient.invalidateQueries({ queryKey: ["journey-paths"] });
        queryClient.invalidateQueries({ queryKey: ["journey-life-score"] });
      }
    },
  });

  const achievements = achievementsQuery.data?.achievements ?? [];
  const totalPoints = achievementsQuery.data?.total_points ?? 0;
  const paths = pathsQuery.data ?? [];
  const lifeScore = lifeScoreQuery.data;
  const timeline = timelineQuery.data?.timeline ?? [];
  const recentAchievements = timelineQuery.data?.recent_achievements ?? [];

  const activePath = paths.find((p) => p.slug === selectedPath);

  const groupedAchievements = achievements.reduce(
    (acc, a) => {
      (acc[a.category] = acc[a.category] || []).push(a);
      return acc;
    },
    {} as Record<string, Achievement[]>,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <motion.header {...fade}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Journey</h1>
            <p className="text-sm text-muted-foreground">
              Your growth, achievements, and progress
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
              {totalPoints} pts
            </div>
            <button
              onClick={() => checkMutation.mutate()}
              disabled={checkMutation.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {checkMutation.isPending ? "Checking..." : "Check"}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Tab bar */}
      <motion.div {...fade} transition={{ duration: 0.3, delay: 0.05 }}>
        <div className="flex gap-1 rounded-2xl bg-muted p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setSelectedPath(null); }}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all",
                tab === key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* Timeline tab */}
        {tab === "timeline" && (
          <motion.div key="timeline" {...fade} className="space-y-4">
            {/* Recent achievements banner */}
            {recentAchievements.length > 0 && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                  <Trophy className="h-4 w-4" />
                  Recent Achievements
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentAchievements.map((a, i) => (
                    <span
                      key={i}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                        TIER_COLORS[a.tier] || TIER_COLORS.bronze,
                      )}
                    >
                      {a.icon} {a.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline items */}
            <div className="relative space-y-1 pl-6">
              <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border" />
              {timeline.map((item) => (
                <div key={item.id} className="relative py-3">
                  <div className="absolute -left-6 top-4 h-3 w-3 rounded-full border-2 border-border bg-card" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.occurred_at
                          ? new Date(item.occurred_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : ""}
                      </p>
                    </div>
                    {item.type === "achievement" && (
                      <span className="text-lg">{(item.meta.badge as string) || "🏆"}</span>
                    )}
                  </div>
                </div>
              ))}
              {timeline.length === 0 && (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Your journey timeline will appear here as you use the app.
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Achievements tab */}
        {tab === "achievements" && (
          <motion.div key="achievements" {...fade} className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-primary">{achievements.length}</p>
                <p className="text-xs text-muted-foreground">Unlocked</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-primary">{totalPoints}</p>
                <p className="text-xs text-muted-foreground">Total Points</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-primary">
                  {achievements.filter((a) => a.tier === "gold").length}
                </p>
                <p className="text-xs text-muted-foreground">Gold Badges</p>
              </div>
            </div>

            {/* By category */}
            {Object.entries(groupedAchievements).map(([category, items]) => (
              <div key={category}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg">{CATEGORY_ICONS[category] || "🌟"}</span>
                  <h3 className="text-sm font-semibold capitalize">{category}</h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map((a) => (
                    <div
                      key={a.id}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-4 transition-all",
                        TIER_COLORS[a.tier] || "border-border bg-card",
                      )}
                    >
                      <span className="text-2xl">{a.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{a.name}</p>
                        <p className="text-xs opacity-75">{a.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold">+{a.points}</p>
                        <p className="text-[10px] opacity-60">{a.tier}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {achievements.length === 0 && (
              <div className="py-12 text-center">
                <Trophy className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No achievements yet. Keep using the app to unlock badges!
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Paths tab */}
        {tab === "paths" && (
          <motion.div key="paths" {...fade} className="space-y-4">
            {activePath ? (
              <div>
                <button
                  onClick={() => setSelectedPath(null)}
                  className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  All Paths
                </button>

                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="mb-6 flex items-center gap-3">
                    <span className="text-3xl">{activePath.icon}</span>
                    <div>
                      <h2 className="text-lg font-bold">{activePath.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        Stage {activePath.current_stage_index + 1} of {activePath.total_stages}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{activePath.current_stage?.name || "Start"}</span>
                      <span>{activePath.progress_pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${activePath.progress_pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  {/* Stages */}
                  <div className="space-y-2">
                    {activePath.stages.map((stage, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex items-center gap-3 rounded-xl p-3 transition-all",
                          stage.reached
                            ? "bg-primary/5 text-foreground"
                            : "bg-muted/30 text-muted-foreground",
                        )}
                      >
                        {stage.reached ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                        ) : (
                          <Lock className="h-5 w-5 shrink-0 opacity-40" />
                        )}
                        <span className="text-lg">{stage.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{stage.name}</p>
                          <p className="text-xs opacity-75">{stage.desc}</p>
                        </div>
                        {i === activePath.current_stage_index && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            CURRENT
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {activePath.completed && (
                    <div className="mt-4 rounded-xl bg-success/10 p-3 text-center text-sm font-semibold text-success">
                      Journey Complete! You&apos;ve reached the final stage.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {paths.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPath(p.slug)}
                    className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:bg-primary/5"
                  >
                    <span className="text-3xl">{p.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{p.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {p.current_stage?.name || "Not started"} · Stage{" "}
                        {p.current_stage_index + 1}/{p.total_stages}
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${p.progress_pct}%` }}
                        />
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Life Score tab */}
        {tab === "score" && lifeScore && (
          <motion.div key="score" {...fade} className="space-y-6">
            {/* Overall score */}
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Overall Growth
              </p>
              <div className="relative mx-auto mt-4 h-32 w-32">
                <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    className="text-muted"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${lifeScore.overall * 3.14} ${314 - lifeScore.overall * 3.14}`}
                    className="text-primary transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-3xl font-bold">{Math.round(lifeScore.overall)}%</p>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-4 text-sm font-semibold">Breakdown</h3>
              <div className="space-y-4">
                {(["productivity", "knowledge", "health", "faith", "learning"] as const).map(
                  (key) => (
                    <div key={key}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize font-medium">{key}</span>
                        <span className="font-bold">{Math.round(lifeScore[key])}%</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className={cn("h-full rounded-full", SCORE_COLORS[key])}
                          initial={{ width: 0 }}
                          animate={{ width: `${lifeScore[key]}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* Tips */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-3 text-sm font-semibold">Growth Tips</h3>
              <div className="space-y-2">
                {lifeScore.productivity < 50 && (
                  <p className="text-xs text-muted-foreground">
                    ⚡ Complete more tasks to boost your productivity score.
                  </p>
                )}
                {lifeScore.knowledge < 50 && (
                  <p className="text-xs text-muted-foreground">
                    📚 Create notes and upload documents to grow your knowledge.
                  </p>
                )}
                {lifeScore.health < 50 && (
                  <p className="text-xs text-muted-foreground">
                    💪 Build habit streaks and focus sessions for better health.
                  </p>
                )}
                {lifeScore.faith < 50 && (
                  <p className="text-xs text-muted-foreground">
                    🙏 Journal regularly to strengthen your reflection score.
                  </p>
                )}
                {lifeScore.overall >= 80 && (
                  <p className="text-xs text-success">
                    ✨ You&apos;re doing great! Keep up the momentum.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
