"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Circle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_at: string | null;
  completed_at: string | null;
}

export default function TasksPage() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [priority, setDraftPriority] = useState("medium");

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: () => apiGet<Task[]>("/tasks?limit=100"),
  });

  const createTask = useMutation({
    mutationFn: () => apiPost<Task>("/tasks", { title: draft, priority, status: "todo" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-timeline"] });
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
      queryClient.invalidateQueries({ queryKey: ["dashboard-timeline"] });
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

  const active = tasksQuery.data?.filter((t) => t.status !== "done") ?? [];
  const completed = tasksQuery.data?.filter((t) => t.status === "done") ?? [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">{t("reminders")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("tasks_subtitle")}</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder={t("new_reminder_placeholder")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) createTask.mutate();
          }}
        />
        <select
          value={priority}
          onChange={(e) => setDraftPriority(e.target.value)}
          className="h-11 rounded-full border border-input bg-card px-4 text-sm"
        >
          <option value="low">{t("priority_low")}</option>
          <option value="medium">{t("priority_medium")}</option>
          <option value="high">{t("priority_high")}</option>
          <option value="urgent">{t("priority_urgent")}</option>
        </select>
        <Button disabled={!draft.trim()} loading={createTask.isPending} onClick={() => createTask.mutate()}>
          <Plus className="h-4 w-4" /> {t("add")}
        </Button>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("to_do")}</h2>
          <div className="apple-card divide-y divide-black/5 dark:divide-white/5 space-y-0 !p-2">
            {active.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => toggleTask.mutate(t)} className="text-muted-foreground hover:text-primary">
                  <Circle className="h-5 w-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.title}</p>
                </div>
                <span className="text-xs text-muted-foreground capitalize">{t.priority}</span>
                <button onClick={() => deleteTask.mutate(t.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {active.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">{t("no_reminders")}</p>
            )}
          </div>
        </div>

        {completed.length > 0 && (
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("completed")}</h2>
            <div className="apple-card divide-y divide-black/5 dark:divide-white/5 space-y-0 !p-2 opacity-60">
              {completed.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => toggleTask.mutate(t)} className="text-primary">
                    <CheckCircle2 className="h-5 w-5" />
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
      </div>
    </div>
  );
}