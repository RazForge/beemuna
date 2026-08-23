"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete, apiPatch } from "@/lib/api";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Plus, Trash2, Flame, TrendingUp, Calendar, Repeat2, Zap,
  Check, X, Clock, Bell, ChevronDown, ChevronUp, CircleCheck, ListChecks,
} from "lucide-react";
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
  relationships: "Relationships", finance: "Finance", personal_growth: "Personal Growth",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HABIT_COLORS = [
  { name: "Default", value: "" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
];

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
  activities: string[];
}

interface HabitCompletion {
  id: string;
  habit_id: string;
  completed_on: string;
  created_at: string;
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localDateStringToday(): string {
  return localDateStr(new Date());
}

export default function HabitsPage() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const today = localDateStringToday();
  const todayDow = new Date().getDay();

  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState("");
  const [desc, setDesc] = useState("");
  const [lifeArea, setLifeArea] = useState("");
  const [identity, setIdentity] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [habitColor, setHabitColor] = useState("");
  const [activities, setActivities] = useState<string[]>([]);
  const [activityInput, setActivityInput] = useState("");
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null);

  // Activity completion tracking for today
  const [activityProgress, setActivityProgress] = useState<Record<string, boolean[]>>({});

  const habitsQuery = useQuery({
    queryKey: ["habits"],
    queryFn: () => apiGet<Habit[]>("/habits"),
  });

  const todayCompletionsQuery = useQuery({
    queryKey: ["habit-completions", today],
    queryFn: async () => {
      const all: HabitCompletion[] = [];
      const habits = habitsQuery.data ?? [];
      for (const h of habits) {
        try {
          const completions = await apiGet<HabitCompletion[]>(
            `/habits/${h.id}/completions?start=${today}&end=${today}`
          );
          all.push(...completions);
        } catch {}
      }
      return all;
    },
    enabled: habitsQuery.data !== undefined && habitsQuery.data.length > 0,
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
      reminder_time: reminderTime || null,
      days_of_week: selectedDays,
      color: habitColor || null,
      activities: activities,
      stage: "new",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      resetForm();
      setShowAdd(false);
      toast.success(t("habit_created") || "Habit created");
      if (reminderTime) {
        toast.info(`Reminder set for ${reminderTime}`);
      }
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const completeHabit = useMutation({
    mutationFn: (habitId: string) =>
      apiPost<HabitCompletion>(`/habits/${habitId}/completions`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habit-completions", today] });
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const uncompleteHabit = useMutation({
    mutationFn: ({ habitId }: { habitId: string }) =>
      apiDelete(`/habits/${habitId}/completions/${today}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habit-completions", today] });
      queryClient.invalidateQueries({ queryKey: ["habits"] });
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
      toast.success(t("habit_deleted") || "Habit deleted");
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const resetForm = () => {
    setDraft("");
    setDesc("");
    setLifeArea("");
    setIdentity("");
    setReminderTime("");
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    setHabitColor("");
    setActivities([]);
    setActivityInput("");
  };

  const habits = habitsQuery.data ?? [];
  const completions = todayCompletionsQuery.data ?? [];
  const completedHabitIds = new Set(completions.map((c) => c.habit_id));

  // Today's habits (that are scheduled for today)
  const todaysHabits = habits.filter(
    (h) => h.active && h.days_of_week.includes(todayDow)
  );
  const completedToday = todaysHabits.filter((h) => completedHabitIds.has(h.id)).length;
  const todayProgress = todaysHabits.length > 0 ? Math.round((completedToday / todaysHabits.length) * 100) : 0;

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const addActivity = () => {
    const val = activityInput.trim();
    if (val && !activities.includes(val)) {
      setActivities((prev) => [...prev, val]);
      setActivityInput("");
    }
  };

  const removeActivity = (idx: number) => {
    setActivities((prev) => prev.filter((_, i) => i !== idx));
  };

  // Habit reminder notifications
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const currentDow = now.getDay();

      for (const h of habits) {
        if (
          h.active &&
          h.reminder_time === timeStr &&
          h.days_of_week.includes(currentDow) &&
          !completedHabitIds.has(h.id)
        ) {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`Time for: ${h.name}`, {
              body: h.description || "Don't break your streak!",
              icon: "/favicon.ico",
            });
          }
          toast.info(`Reminder: ${h.name}`);
        }
      }
    }, 30000); // check every 30s

    return () => clearInterval(interval);
  }, [habits, completedHabitIds]);

  const analytics = analyticsQuery.data;

  const toggleActivityProgress = (habitId: string, actIdx: number) => {
    setActivityProgress((prev) => {
      const current = prev[habitId] ?? [];
      const updated = [...current];
      updated[actIdx] = !updated[actIdx];
      return { ...prev, [habitId]: updated };
    });
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Habits</h1>
          <p className="text-muted-foreground mt-1 text-sm">Build behavior change with structure and AI coaching</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showAdd ? "Cancel" : "New Habit"}
        </Button>
      </div>

      {/* Today's Progress */}
      {todaysHabits.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CircleCheck className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-sm">Today&apos;s Progress</h2>
            </div>
            <span className="text-sm font-bold text-primary">
              {completedToday}/{todaysHabits.length} habits
            </span>
          </div>
          <Progress value={todayProgress} className="h-2 mb-2" />
          <p className="text-xs text-muted-foreground">
            {todayProgress === 100
              ? "All done for today! Great work!"
              : `${todayProgress}% complete — keep going!`}
          </p>
        </div>
      )}

      {/* Create Habit Form */}
      {showAdd && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm">Create New Habit</h3>

          <Input placeholder="Habit name (e.g., Morning Prayer)" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Input placeholder="Identity label (e.g., 'Faithful Disciple')" value={identity} onChange={(e) => setIdentity(e.target.value)} />
          <Input placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />

          {/* Life Area */}
          <select value={lifeArea} onChange={(e) => setLifeArea(e.target.value)} className="h-10 rounded-full border border-input bg-background px-3 text-sm w-full">
            <option value="">Life Area</option>
            {Object.entries(LIFE_AREAS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {/* Reminder Time */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
              <Bell className="h-3.5 w-3.5" />
              Reminder Time (optional)
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-40"
              />
              {reminderTime && (
                <span className="text-xs text-primary font-medium">
                  You&apos;ll be notified at {reminderTime}
                </span>
              )}
            </div>
          </div>

          {/* Days of Week */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
              <Calendar className="h-3.5 w-3.5" />
              Schedule
            </label>
            <div className="flex gap-1.5">
              {DAY_NAMES.map((name, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "h-9 w-9 rounded-full text-xs font-bold transition-all",
                    selectedDays.includes(i)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {selectedDays.length === 7 ? "Every day" : selectedDays.length === 0 ? "No days selected" : `${selectedDays.length} days/week`}
            </p>
          </div>

          {/* Color */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">Color</label>
            <div className="flex gap-2">
              {HABIT_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.name}
                  onClick={() => setHabitColor(c.value)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-all",
                    habitColor === c.value ? "border-primary scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c.value || "#94a3b8" }}
                />
              ))}
            </div>
          </div>

          {/* Activities */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
              <ListChecks className="h-3.5 w-3.5" />
              Activities (optional)
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Add an activity (e.g., 'Read 10 pages')"
                value={activityInput}
                onChange={(e) => setActivityInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addActivity(); } }}
                className="flex-1"
              />
              <Button size="sm" variant="outline" onClick={addActivity} disabled={!activityInput.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {activities.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activities.map((act, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {act}
                    <button onClick={() => removeActivity(i)} className="ml-0.5 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" disabled={!draft.trim()} loading={createHabit.isPending} onClick={() => createHabit.mutate()}>
              Create Habit
            </Button>
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
        {habits.map((h) => {
          const isCompleted = completedHabitIds.has(h.id);
          const isExpanded = expandedHabit === h.id;
          const isScheduledToday = h.days_of_week.includes(todayDow);
          const acts = h.activities || [];
          const actProgress = activityProgress[h.id] ?? [];

          return (
            <div
              key={h.id}
              className={cn(
                "rounded-2xl border bg-card p-4 space-y-3 transition-all",
                isCompleted ? "border-emerald-300 dark:border-emerald-700" : "border-border hover:border-primary/20",
                !isScheduledToday && "opacity-60"
              )}
              style={h.color ? { borderTopColor: h.color, borderTopWidth: 3 } : undefined}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{h.name}</h3>
                    {h.stage && (
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", STAGE_COLORS[h.stage])}>
                        {h.stage.toUpperCase()}
                      </span>
                    )}
                    {!isScheduledToday && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        OFF TODAY
                      </span>
                    )}
                  </div>
                  {h.identity_label && (
                    <p className="text-[11px] text-primary font-medium">{h.identity_label}</p>
                  )}
                  {h.reminder_time && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                      <Bell className="h-3 w-3" />
                      Reminder at {h.reminder_time}
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

              {/* Activities */}
              {acts.length > 0 && (
                <div className="space-y-1.5">
                  <button
                    onClick={() => setExpandedHabit(isExpanded ? null : h.id)}
                    className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <ListChecks className="h-3.5 w-3.5" />
                    Activities ({acts.filter((_, i) => actProgress[i]).length}/{acts.length})
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {isExpanded && (
                    <div className="space-y-1 pl-1">
                      {acts.map((act, i) => (
                        <label key={i} className="flex items-center gap-2 text-xs cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={!!actProgress[i]}
                            onChange={() => toggleActivityProgress(h.id, i)}
                            className="rounded border-gray-300 h-3.5 w-3.5"
                          />
                          <span className={cn("group-hover:text-foreground", actProgress[i] ? "text-muted-foreground line-through" : "text-foreground")}>
                            {act}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Complete / Uncomplete Button */}
              {isScheduledToday && (
                <div className="flex gap-2">
                  {isCompleted ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300"
                      onClick={() => uncompleteHabit.mutate({ habitId: h.id })}
                    >
                      <Check className="h-4 w-4 mr-1.5" /> Completed
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => completeHabit.mutate(h.id)}
                    >
                      <Check className="h-4 w-4 mr-1.5" /> Mark Done
                    </Button>
                  )}
                </div>
              )}

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
          );
        })}
      </div>
    </div>
  );
}
