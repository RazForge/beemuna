"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete, apiPatch } from "@/lib/api";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Flame, TrendingUp, Link2, User, Calendar, Repeat2, Zap, X } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const HABIT_STAGES = ["new", "building", "established", "strong", "automatic", "mastered"];
const STAGE_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  building: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  established: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  strong: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  automatic: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  mastered: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
};

const LIFE_AREAS: Record<string, string> = {
  career: "Career", learning: "Learning", health: "Health", faith: "Faith",
  relationships: "Relationships", finance: "Finance", personal_growth: "Personal Growth"
};

interface Habit {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  days_of_week: number[];
  reminder_time: string | null;
  color: string | null;
  active: boolean;
  stage: string | null;
  strength_score: number | null;
  current_streak: number;
  longest_streak: number;
  identity_label: string | null;
  chain_id: string | null;
  life_area: string | null;
}

export default function HabitsPage() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [desc, setDesc] = useState("");
  const [lifeArea, setLifeArea] = useState("");
  const [identity, setIdentity] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const habitsQuery = useQuery({
    queryKey: ["habits"],
    queryFn: () => apiGet<Habit[]>("/habits"),
  });

  const analyticsQuery = useQuery({
    queryKey: ["habits-analytics"],
    queryFn: () => apiGet<any>("/habits/analytics"),
  });

  const createHabit = useMutation({
    mutationFn: () => apiPost<Habit>("/habits", {
      name: draft,
      description: desc || null,
      identity_label: identity || undefined,
      life_area: lifeArea || undefined,
      stage: "new"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      setDraft("");
      setDesc("");
      setLifeArea("");
      setIdentity("");
      setShowAdd(false);
      toast.success(t("habit_created"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const updateStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      apiPatch(`/habits/${id}/stage`, { stage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["habits"] }),
  });

  const deleteHabit = useMutation({
    mutationFn: (id: string) => apiDelete(`/habits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      toast.success(t("habit_deleted"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const habits = habitsQuery.data ?? [];
  const analytics = analyticsQuery.data;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Habits</h1>
          <p className="text-muted-foreground mt-1 text-sm">Build behavior change with structure and AI coaching</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Habit
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <Input placeholder="Habit name" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Input placeholder="Identity label (e.g., 'Faithful Disciple')" value={identity} onChange={(e) => setIdentity(e.target.value)} />
          <Input placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <select value={lifeArea} onChange={(e) => setLifeArea(e.target.value)} className="h-10 rounded-full border border-input bg-background px-3 text-sm">
            <option value="">Life Area</option>
            {Object.entries(LIFE_AREAS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button size="sm" disabled={!draft.trim()} loading={createHabit.isPending} onClick={() => createHabit.mutate()}>
              Create
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-border bg-card p-3 text-center">
            <Flame className="h-5 w-5 mx-auto text-orange-500 mb-1" />
            <p className="text-xl font-bold">{analytics.avg_streak || 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Streak</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
            <p className="text-xl font-bold">{analytics.completion_rate || 0}%</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Completion</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3 text-center">
            <Repeat2 className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold">{analytics.total_completions || 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Completions</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3 text-center">
            <Zap className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <p className="text-xl font-bold">{analytics.habits_tracked || 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active</p>
          </div>
        </div>
      )}

      {/* Habits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {habits.map((h) => (
          <div key={h.id} className="rounded-2xl border border-border bg-card p-4 space-y-3 hover:border-primary/20 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold truncate">{h.name}</h3>
                  {h.stage && (
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", STAGE_COLORS[h.stage])}>
                      {h.stage.toUpperCase()}
                    </span>
                  )}
                </div>
                {h.identity_label && (
                  <div className="flex items-center gap-1 text-[11px] text-primary font-medium">
                    <User className="h-3 w-3" />
                    {h.identity_label}
                  </div>
                )}
              </div>
              <button onClick={() => deleteHabit.mutate(h.id)} className="text-muted-foreground hover:text-destructive ml-2">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Strength Score */}
            {h.strength_score !== null && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Strength</span>
                  <span className="font-bold">{Math.round(h.strength_score)}%</span>
                </div>
                <Progress value={h.strength_score} className="h-1.5" />
              </div>
            )}

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {h.current_streak > 0 && (
                <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                  <Flame className="h-3.5 w-3.5" />
                  <span className="font-bold">{h.current_streak}</span>
                  <span className="text-muted-foreground">day streak</span>
                </div>
              )}
              {h.longest_streak > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Best: {h.longest_streak}</span>
                </div>
              )}
              {h.life_area && (
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {LIFE_AREAS[h.life_area] || h.life_area}
                </span>
              )}
            </div>

            {/* Stage selector */}
            <div className="flex flex-wrap gap-1">
              {HABIT_STAGES.map((stage) => (
                <button
                  key={stage}
                  onClick={() => updateStage.mutate({ id: h.id, stage })}
                  className={cn(
                    "text-[10px] font-bold px-2 py-1 rounded-full transition-all",
                    h.stage === stage
                      ? STAGE_COLORS[stage] + " ring-2 ring-offset-1"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {stage}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
