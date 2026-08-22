"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Target, Trash2, Zap } from "lucide-react";
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
  expected_completion: string | null;
  last_reviewed_at: string | null;
  review_frequency: string | null;
  ai_summary: string | null;
  life_area: string | null;
  milestones: { id: string; title: string; threshold: number; achieved: boolean }[];
}

export default function GoalsPage() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [desc, setDesc] = useState("");
  const [lifeArea, setLifeArea] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const goalsQuery = useQuery({
    queryKey: ["goals"],
    queryFn: () => apiGet<Goal[]>("/goals"),
  });

  const createGoal = useMutation({
    mutationFn: () => apiPost<Goal>("/goals", { title: draft, description: desc || null, status: "active", goal_type: "personal", life_area: lifeArea || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-timeline"] });
      setDraft("");
      setDesc("");
      setShowAdd(false);
      toast.success(t("goal_created"));
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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <header className="glass rounded-[28px] p-7 flex flex-wrap items-center justify-between gap-4 shadow-xl border-white/20 dark:border-white/5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-br from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
            {t("nav_goals")}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm font-medium">{t("goals_subtitle")}</p>
        </div>
        <Button size="sm" className="h-10 rounded-full px-5 shadow-md" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4 mr-1.5" /> {t("new_goal")}
        </Button>
      </header>

      {showAdd && (
        <div className="rounded-3xl border border-border bg-card p-6 shadow-lg space-y-5">
          <div>
            <h3 className="text-lg font-bold">Create New Goal</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Define what you want to achieve</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Goal Title</Label>
              <Input
                placeholder="e.g., Complete MSc Thesis"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-11 rounded-xl text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</Label>
              <textarea
                placeholder="Why does this goal matter to you?"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-ring resize-none"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</Label>
                <select className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="personal">Personal</option>
                  <option value="career">Career</option>
                  <option value="learning">Learning</option>
                  <option value="health">Health</option>
                  <option value="financial">Financial</option>
                  <option value="faith">Faith</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Life Area</Label>
                <select value={lifeArea} onChange={(e) => setLifeArea(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="">None</option>
                  <option value="career">Career</option>
                  <option value="learning">Learning</option>
                  <option value="health">Health</option>
                  <option value="faith">Faith</option>
                  <option value="relationships">Relationships</option>
                  <option value="finance">Finance</option>
                  <option value="personal_growth">Personal Growth</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start Date</Label>
                <input type="date" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Date</Label>
                <input type="date" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button size="sm" disabled={!draft.trim()} loading={createGoal.isPending} onClick={() => createGoal.mutate()} className="flex-1">
              <Plus className="h-4 w-4 mr-1.5" /> Create Goal
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setDraft(""); setDesc(""); setLifeArea(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {goalsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : goalsQuery.data?.length === 0 ? (
          <div className="apple-card flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Target className="h-10 w-10 opacity-30" />
            <p className="text-sm">{t("goals_empty")}</p>
          </div>
        ) : (
          goalsQuery.data?.map((g) => {
            const achieved = g.milestones.filter((m) => m.achieved).length;
            const pct = g.milestones.length ? Math.round((achieved / g.milestones.length) * 100) : g.progress_percent || 0;

            return (
              <div key={g.id} className="apple-card flex flex-col justify-between gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{g.title}</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {g.goal_type}
                      </span>
                      {g.life_area && (
                        <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {g.life_area.replace("_", " ")}
                        </span>
                      )}
                    </div>
                    {g.description && <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>}
                  </div>
                  <button onClick={() => deleteGoal.mutate(g.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-bold">{pct}%</span>
                    <span className="text-xs text-muted-foreground">progress</span>
                  </div>
                  {g.confidence_score !== null && (
                    <div className="flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-sm font-bold">{Math.round(g.confidence_score)}%</span>
                      <span className="text-xs text-muted-foreground">confidence</span>
                    </div>
                  )}
                  {g.risk_status && (
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                      g.risk_status === "low" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" :
                      g.risk_status === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" :
                      g.risk_status === "high" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" :
                      "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                    )}>
                      {g.risk_status.toUpperCase()} RISK
                    </span>
                  )}
                </div>

                {g.milestones.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span>Milestones</span>
                      <span>{achieved}/{g.milestones.length}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("no_milestones")}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}