"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Circle, CheckCircle2, Flame, Clock, AlertTriangle,
  ArrowDown, Zap, Target, X
} from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: "critical" | "high" | "medium" | "low";
  status: string;
  health_status: string | null;
  difficulty: string | null;
  due_at: string | null;
  completed_at: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  accuracy_percent: number | null;
  focus_session_count: number;
  total_focus_minutes: number;
  life_area: string | null;
  depends_on_task_id: string | null;
  ai_breakdown: string[] | null;
  goal_id: string | null;
  project_id: string | null;
}

const LIFE_AREAS: Record<string, string> = {
  career: "Career", learning: "Learning", health: "Health", faith: "Faith",
  relationships: "Relationships", finance: "Finance", personal_growth: "Personal Growth"
};

const HEALTH_COLORS: Record<string, string> = {
  on_track: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  at_risk: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  overdue: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  stalled: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400 border-gray-200",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-emerald-600 dark:text-emerald-400",
  medium: "text-blue-600 dark:text-blue-400",
  hard: "text-orange-600 dark:text-orange-400",
  expert: "text-red-600 dark:text-red-400",
};

export default function TasksPage() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [priority, setPriority] = useState("medium");
  const [difficulty, setDifficulty] = useState("medium");
  const [lifeArea, setLifeArea] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: () => apiGet<Task[]>("/tasks?limit=100"),
  });

  const createTask = useMutation({
    mutationFn: () => apiPost<Task>("/tasks", {
      title: draft,
      priority,
      difficulty,
      status: "todo",
      life_area: lifeArea || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setDraft("");
      toast.success(t("task_added"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const toggleTask = useMutation({
    mutationFn: (task: Task) =>
      apiPatch<Task>(`/tasks/${task.id}`, {
        status: task.status === "done" ? "todo" : "done",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => apiDelete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(t("task_deleted"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const updateHealth = useMutation({
    mutationFn: ({ id, health }: { id: string; health: string }) =>
      apiPatch<Task>(`/tasks/${id}/health`, { health_status: health }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Health updated");
    },
  });

  const recordFocus = useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes: number }) =>
      apiPost(`/tasks/${id}/focus`, { minutes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Focus session recorded");
    },
  });

  const aiBreakdown = useMutation({
    mutationFn: (id: string) => apiPost(`/ai/task-breakdown/${id}`, {}),
    onSuccess: (data: any) => {
      toast.success("AI breakdown generated");
    },
  });

  const tasks = tasksQuery.data ?? [];
  const active = tasks.filter((t) => t.status !== "done");
  const completed = tasks.filter((t) => t.status === "done");

  const grouped = {
    critical: active.filter((t) => t.priority === "critical"),
    high: active.filter((t) => t.priority === "high"),
    medium: active.filter((t) => t.priority === "medium"),
    low: active.filter((t) => t.priority === "low"),
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("tasks")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Organize, prioritize, and execute with intelligence</p>
      </div>

      {/* Create task */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="What needs to be done?"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim()) createTask.mutate();
            }}
            className="flex-1"
          />
          <Button disabled={!draft.trim()} loading={createTask.isPending} onClick={() => createTask.mutate()}>
            <Plus className="h-4 w-4 mr-1" /> Add Task
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-8 rounded-full border border-input bg-background px-3 text-xs font-medium">
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="h-8 rounded-full border border-input bg-background px-3 text-xs font-medium">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="expert">Expert</option>
          </select>
          <select value={lifeArea} onChange={(e) => setLifeArea(e.target.value)} className="h-8 rounded-full border border-input bg-background px-3 text-xs font-medium">
            <option value="">Life Area</option>
            {Object.entries(LIFE_AREAS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Priority Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(["critical", "high", "medium", "low"] as const).map((level) => {
          const items = grouped[level];
          return (
            <div key={level} className="rounded-2xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge className={cn("text-[11px] font-bold", PRIORITY_COLORS[level])}>{level.toUpperCase()}</Badge>
                <span className="text-xs text-muted-foreground">{items.length} tasks</span>
              </div>
              <div className="space-y-1.5">
                {items.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "group rounded-xl border p-2.5 cursor-pointer transition-all hover:border-primary/30",
                      task.health_status ? HEALTH_COLORS[task.health_status] || "border-border" : "border-border bg-background/50"
                    )}
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleTask.mutate(task); }}
                        className="mt-0.5 text-muted-foreground hover:text-primary"
                      >
                        <Circle className="h-4 w-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">{task.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {task.difficulty && (
                            <span className={cn("text-[10px] font-bold uppercase", DIFFICULTY_COLORS[task.difficulty])}>
                              {task.difficulty}
                            </span>
                          )}
                          {task.life_area && (
                            <span className="text-[10px] font-medium text-muted-foreground">
                              {LIFE_AREAS[task.life_area] || task.life_area}
                            </span>
                          )}
                          {task.depends_on_task_id && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                              <ArrowDown className="h-3 w-3" /> Blocked
                            </span>
                          )}
                          {(task.focus_session_count ?? 0) > 0 && (
                            <span className="text-[10px] text-primary flex items-center gap-0.5">
                              <Flame className="h-3 w-3" /> {task.total_focus_minutes}m
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="py-3 text-center text-xs text-muted-foreground">No tasks</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Completed</h2>
          <div className="space-y-1.5 opacity-60">
            {completed.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
                <button onClick={() => toggleTask.mutate(t)} className="text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <p className="flex-1 text-sm font-medium line-through">{t.title}</p>
                <button onClick={() => deleteTask.mutate(t.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setSelectedTask(null)}>
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">{selectedTask.title}</h3>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge className={cn("text-[10px] font-bold", PRIORITY_COLORS[selectedTask.priority])}>
                    {selectedTask.priority.toUpperCase()}
                  </Badge>
                  {selectedTask.health_status && (
                    <Badge className={cn("text-[10px] font-bold", HEALTH_COLORS[selectedTask.health_status])}>
                      {selectedTask.health_status.replace("_", " ").toUpperCase()}
                    </Badge>
                  )}
                  {selectedTask.difficulty && (
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {selectedTask.difficulty.toUpperCase()}
                    </Badge>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedTask(null)} className="rounded-full p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            {selectedTask.description && (
              <p className="text-sm text-muted-foreground mb-4">{selectedTask.description}</p>
            )}

            {/* Health Status */}
            <div className="mb-4 space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider">Health Status</Label>
              <div className="flex flex-wrap gap-1.5">
                {(["on_track", "at_risk", "overdue", "stalled"] as const).map((h) => (
                  <button
                    key={h}
                    onClick={() => updateHealth.mutate({ id: selectedTask.id, health: h })}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[11px] font-bold transition-all",
                      selectedTask.health_status === h
                        ? HEALTH_COLORS[h] + " ring-2 ring-offset-1"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {h.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Time & Focus */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estimated</p>
                <p className="text-lg font-bold">{selectedTask.estimated_minutes ? `${selectedTask.estimated_minutes}m` : "—"}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actual</p>
                <p className="text-lg font-bold">{selectedTask.actual_minutes ? `${selectedTask.actual_minutes}m` : "—"}</p>
                {selectedTask.accuracy_percent !== null && (
                  <p className="text-[11px] text-muted-foreground">{selectedTask.accuracy_percent}% accuracy</p>
                )}
              </div>
            </div>

            {/* Focus Sessions */}
            <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Focus Sessions</p>
                  <p className="text-lg font-bold">{selectedTask.focus_session_count} sessions · {selectedTask.total_focus_minutes}m total</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const mins = prompt("Focus minutes:");
                    if (mins) recordFocus.mutate({ id: selectedTask.id, minutes: parseInt(mins) });
                  }}
                >
                  <Clock className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
            </div>

            {/* AI Breakdown */}
            {selectedTask.ai_breakdown && selectedTask.ai_breakdown.length > 0 ? (
              <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">AI Subtasks</p>
                <div className="space-y-1">
                  {selectedTask.ai_breakdown.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Zap className="h-3 w-3 text-primary" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full mb-4"
                onClick={() => aiBreakdown.mutate(selectedTask.id)}
                loading={aiBreakdown.isPending}
              >
                <Target className="h-4 w-4 mr-2" /> Generate AI Breakdown
              </Button>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { toggleTask.mutate(selectedTask); setSelectedTask(null); }}
              >
                {selectedTask.status === "done" ? "Mark Undone" : "Mark Complete"}
              </Button>
              <Button variant="destructive" onClick={() => { deleteTask.mutate(selectedTask.id); setSelectedTask(null); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
