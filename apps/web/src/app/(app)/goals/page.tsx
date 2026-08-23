"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, Trash2, Zap, ChevronDown, ChevronUp, Check, BarChart3, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  status: string;
  goal_type: string;
  progress_percent: number;
  confidence_score: number | null;
  risk_status: string | null;
  target_date: string | null;
  start_date: string | null;
  expected_completion: string | null;
  last_reviewed_at: string | null;
  review_frequency: string | null;
  ai_summary: string | null;
  life_area: string | null;
  milestones: { id: string; title: string; threshold: number; achieved: boolean }[];
}

interface GoalNote {
  id: string;
  goal_id: string;
  content: string;
  progress_at_time: number;
  created_at: string;
}

const GOAL_TYPES = [
  { value: "personal", label: "Personal" },
  { value: "career", label: "Career" },
  { value: "learning", label: "Learning" },
  { value: "health", label: "Health" },
  { value: "financial", label: "Financial" },
  { value: "faith", label: "Faith" },
];

const LIFE_AREAS = [
  { value: "career", label: "Career" },
  { value: "learning", label: "Learning" },
  { value: "health", label: "Health" },
  { value: "faith", label: "Faith" },
  { value: "relationships", label: "Relationships" },
  { value: "finance", label: "Finance" },
  { value: "personal_growth", label: "Personal Growth" },
];

const TYPE_COLORS: Record<string, string> = {
  personal: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  career: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  learning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  health: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  financial: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  faith: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};

function ProgressSlider({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">Progress</span>
        <span className="text-sm font-bold tabular-nums">{value}%</span>
      </div>
      <div className="relative h-2 rounded-full bg-black/5 dark:bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
          style={{ width: `${value}%` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="absolute inset-0 w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProgress, setEditProgress] = useState(0);

  const [form, setForm] = useState({
    title: "",
    description: "",
    goal_type: "personal",
    life_area: "",
    target_date: "",
    start_date: "",
  });

  const goalsQuery = useQuery({
    queryKey: ["goals"],
    queryFn: () => apiGet<Goal[]>("/goals"),
  });

  const createGoal = useMutation({
    mutationFn: () => apiPost<Goal>("/goals", {
      title: form.title,
      description: form.description || null,
      status: "active",
      goal_type: form.goal_type,
      life_area: form.life_area || null,
      start_date: form.start_date || null,
      target_date: form.target_date || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setForm({ title: "", description: "", goal_type: "personal", life_area: "", target_date: "", start_date: "" });
      setShowAdd(false);
      toast.success(t("goal_created"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const updateProgress = useMutation({
    mutationFn: ({ id, progress_percent }: { id: string; progress_percent: number }) =>
      apiPatch<Goal>(`/goals/${id}`, { progress_percent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setEditingId(null);
      toast.success("Progress updated");
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const completeGoal = useMutation({
    mutationFn: (id: string) => apiPatch<Goal>(`/goals/${id}`, { status: "completed", progress_percent: 100 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Goal completed!");
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const deleteGoal = useMutation({
    mutationFn: (id: string) => apiDelete(`/goals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success(t("goal_deleted"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const notesQuery = useQuery({
    queryKey: ["goal-notes", expandedId],
    queryFn: () => apiGet<GoalNote[]>(`/goals/${expandedId}/notes`),
    enabled: !!expandedId,
  });

  const [noteText, setNoteText] = useState("");

  const addNote = useMutation({
    mutationFn: ({ goalId, content, progress }: { goalId: string; content: string; progress: number }) =>
      apiPost<GoalNote>(`/goals/${goalId}/notes`, { content, progress_at_time: progress }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goal-notes"] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setNoteText("");
      toast.success("Note added");
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const deleteNote = useMutation({
    mutationFn: ({ goalId, noteId }: { goalId: string; noteId: string }) =>
      apiDelete(`/goals/${goalId}/notes/${noteId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goal-notes"] }),
  });

  const goals = goalsQuery.data ?? [];
  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-28 md:pb-40">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t("nav_goals")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("goals_subtitle")}</p>
        </div>
        <Button size="sm" className="h-9 rounded-full px-4" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4 mr-1" /> {t("new_goal")}
        </Button>
      </header>

      {showAdd && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-base font-bold">New Goal</h3>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">What do you want to achieve?</Label>
              <Input
                placeholder="e.g., Complete MSc Thesis"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="h-10 rounded-xl text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Why does this matter?</Label>
              <textarea
                placeholder="Your motivation..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-ring resize-none"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Type</Label>
                <select
                  value={form.goal_type}
                  onChange={(e) => setForm({ ...form, goal_type: e.target.value })}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {GOAL_TYPES.map((gt) => (
                    <option key={gt.value} value={gt.value}>{gt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Life Area</Label>
                <select
                  value={form.life_area}
                  onChange={(e) => setForm({ ...form, life_area: e.target.value })}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="">None</option>
                  {LIFE_AREAS.map((la) => (
                    <option key={la.value} value={la.value}>{la.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Start Date</Label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Target Date</Label>
                <input
                  type="date"
                  value={form.target_date}
                  onChange={(e) => setForm({ ...form, target_date: e.target.value })}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              disabled={!form.title.trim()}
              loading={createGoal.isPending}
              onClick={() => createGoal.mutate()}
              className="flex-1 rounded-xl"
            >
              Create Goal
            </Button>
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => { setShowAdd(false); setForm({ title: "", description: "", goal_type: "personal", life_area: "", target_date: "", start_date: "" }); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {goalsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : activeGoals.length === 0 && completedGoals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Target className="h-10 w-10 opacity-30" />
          <p className="text-sm">{t("goals_empty")}</p>
          <p className="text-xs">Set a goal and track your progress over time</p>
        </div>
      ) : (
        <>
          {activeGoals.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Active Goals ({activeGoals.length})</h2>
              {activeGoals.map((g) => {
                const pct = g.progress_percent || 0;
                const isExpanded = expandedId === g.id;
                const isEditing = editingId === g.id;
                const dueLabel = g.target_date
                  ? new Date(g.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : null;

                return (
                  <div key={g.id} className="rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">{g.title}</h3>
                          <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full", TYPE_COLORS[g.goal_type] || "bg-muted text-muted-foreground")}>
                            {g.goal_type}
                          </span>
                          {g.life_area && (
                            <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                              {g.life_area.replace("_", " ")}
                            </span>
                          )}
                        </div>
                        {g.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{g.description}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditingId(isEditing ? null : g.id); setEditProgress(pct); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Update progress">
                          <BarChart3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setExpandedId(isExpanded ? null : g.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-16 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-bold tabular-nums text-foreground">{pct}%</span>
                      </div>
                      {dueLabel && <span>Due {dueLabel}</span>}
                      {g.risk_status && g.risk_status !== "low" && (
                        <span className={cn("font-semibold uppercase",
                          g.risk_status === "medium" ? "text-amber-600" : "text-orange-600"
                        )}>{g.risk_status} risk</span>
                      )}
                    </div>

                    {isEditing && (
                      <div className="mt-3 pt-3 border-t border-border space-y-3">
                        <ProgressSlider value={editProgress} onChange={setEditProgress} />
                        <div className="flex gap-2">
                          <Button size="sm" className="h-8 rounded-lg text-xs" onClick={() => updateProgress.mutate({ id: g.id, progress_percent: editProgress })} loading={updateProgress.isPending}>
                            <Check className="h-3 w-3 mr-1" /> Save
                          </Button>
                          {pct < 100 && (
                            <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => completeGoal.mutate(g.id)}>
                              Mark Complete
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border space-y-3">
                        {g.confidence_score !== null && (
                          <div className="flex items-center gap-2 text-xs">
                            <Zap className="h-3.5 w-3.5 text-amber-500" />
                            <span className="font-semibold">{Math.round(g.confidence_score * 100)}%</span>
                            <span className="text-muted-foreground">AI confidence</span>
                          </div>
                        )}
                        {g.milestones.length > 0 && (
                          <div className="space-y-1.5">
                            {g.milestones.map((m) => (
                              <div key={m.id} className="flex items-center gap-2 text-xs">
                                <div className={cn("h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center",
                                  m.achieved ? "border-primary bg-primary text-white" : "border-muted-foreground/30"
                                )}>
                                  {m.achieved && <Check className="h-2 w-2" />}
                                </div>
                                <span className={cn(m.achieved && "line-through text-muted-foreground")}>{m.title}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <StickyNote className="h-3.5 w-3.5" />
                            <span>Progress Notes</span>
                          </div>

                          <div className="flex gap-2">
                            <input
                              placeholder="What did you reach or achieve?"
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && noteText.trim()) {
                                  addNote.mutate({ goalId: g.id, content: noteText.trim(), progress: g.progress_percent });
                                }
                              }}
                              className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-ring"
                            />
                            <Button
                              size="sm"
                              className="h-8 rounded-xl text-xs shrink-0"
                              disabled={!noteText.trim()}
                              loading={addNote.isPending}
                              onClick={() => addNote.mutate({ goalId: g.id, content: noteText.trim(), progress: g.progress_percent })}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Add
                            </Button>
                          </div>

                          {notesQuery.data && notesQuery.data.length > 0 ? (
                            <div className="space-y-2">
                              {notesQuery.data.map((n) => (
                                <div key={n.id} className="group rounded-xl bg-muted/50 px-3 py-2.5 text-xs space-y-1">
                                  <p className="text-foreground leading-relaxed">{n.content}</p>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <span className="font-semibold text-primary">{n.progress_at_time}%</span>
                                      <span>at time of note</span>
                                      <span>·</span>
                                      <span>{new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                    </div>
                                    <button
                                      onClick={() => deleteNote.mutate({ goalId: g.id, noteId: n.id })}
                                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground italic">No notes yet. Log what you reached.</p>
                          )}
                        </div>

                        <div className="flex justify-end pt-1">
                          <button onClick={() => deleteGoal.mutate(g.id)} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                            Delete goal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {completedGoals.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Completed ({completedGoals.length})</h2>
              {completedGoals.map((g) => (
                <div key={g.id} className="rounded-2xl border border-border bg-card/60 p-4 opacity-70">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm font-medium line-through text-muted-foreground">{g.title}</span>
                    </div>
                    <button onClick={() => deleteGoal.mutate(g.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
