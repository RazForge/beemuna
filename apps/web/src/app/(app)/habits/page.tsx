"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";

interface Habit {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

export default function HabitsPage() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [desc, setDesc] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const habitsQuery = useQuery({
    queryKey: ["habits"],
    queryFn: () => apiGet<Habit[]>("/habits"),
  });

  const createHabit = useMutation({
    mutationFn: () => apiPost<Habit>("/habits", { name: draft, description: desc || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      setDraft("");
      setDesc("");
      setShowAdd(false);
      toast.success(t("habit_created"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const deleteHabit = useMutation({
    mutationFn: (id: string) => apiDelete(`/habits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      toast.success(t("habit_deleted"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">{t("habits_title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("habits_subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4" /> {t("new_habit")}
        </Button>
      </div>

      {showAdd && (
        <div className="apple-card flex flex-col gap-3">
          <Input placeholder={t("habit_name_placeholder")} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Input placeholder={t("description_optional")} value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" disabled={!draft.trim()} loading={createHabit.isPending} onClick={() => createHabit.mutate()}>
              {t("create_habit")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>{t("cancel")}</Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {habitsQuery.data?.map((h) => (
          <div key={h.id} className="apple-card flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{h.name}</h3>
              {h.description && <p className="text-sm text-muted-foreground">{h.description}</p>}
            </div>
            <button onClick={() => deleteHabit.mutate(h.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4.5 w-4.5" />
            </button>
          </div>
        ))}
        {habitsQuery.data?.length === 0 && (
          <div className="apple-card text-center py-12 text-muted-foreground">
            <p className="text-sm">{t("no_habits")}</p>
          </div>
        )}
      </div>
    </div>
  );
}