"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  status: string;
  target_date: string | null;
  milestones: { id: string; title: string; threshold: number; achieved: boolean }[];
}

export default function GoalsPage() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [desc, setDesc] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const goalsQuery = useQuery({
    queryKey: ["goals"],
    queryFn: () => apiGet<Goal[]>("/goals"),
  });

  const createGoal = useMutation({
    mutationFn: () => apiPost<Goal>("/goals", { title: draft, description: desc || null, status: "active" }),
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
        <div className="apple-card flex flex-col gap-3">
          <Input placeholder={t("goal_title_placeholder")} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Input placeholder={t("goal_desc_placeholder")} value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" disabled={!draft.trim()} loading={createGoal.isPending} onClick={() => createGoal.mutate()}>
              {t("create_goal")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>{t("cancel")}</Button>
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
            const pct = g.milestones.length ? Math.round((achieved / g.milestones.length) * 100) : 0;

            return (
              <div key={g.id} className="apple-card flex flex-col justify-between gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">{g.title}</h3>
                    {g.description && <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>}
                  </div>
                  <button onClick={() => deleteGoal.mutate(g.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {g.milestones.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span>{t("milestones")}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
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