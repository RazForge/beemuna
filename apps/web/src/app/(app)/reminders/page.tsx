"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Reminder } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/lib/i18n";
import { ReminderList } from "@/components/reminders/reminder-list";
import { motion } from "framer-motion";

export default function RemindersPage() {
  const { user } = useAuth();
  const { t } = useLang();
  const queryClient = useQueryClient();

  const remindersQuery = useQuery({
    queryKey: ["reminders"],
    queryFn: () => apiGet<Reminder[]>("/reminders"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      apiPatch(`/reminders/${id}`, { status: done ? "completed" : "scheduled" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/reminders/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
  });

  const addMutation = useMutation({
    mutationFn: ({ title, date }: { title: string; date: Date }) =>
      apiPost("/reminders", {
        type: "reminder",
        title,
        scheduled_at: date.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
  });

  const reminders = remindersQuery.data ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-1">
          <img 
            src="/images/beemuna-logo.png" 
            alt="Beemuna" 
            className="h-10 w-10 md:h-12 md:w-12 rounded-2xl shadow-lg shadow-primary/20 border border-white/20 object-cover"
          />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
              {t("reminders")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your reminders and stay on track
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}>
        <ReminderList
          reminders={reminders}
          onToggle={(id, done) => toggleMutation.mutate({ id, done })}
          onDelete={(id) => deleteMutation.mutate(id)}
          onAdd={(title, date) => addMutation.mutate({ title, date })}
          emptyText={t("reminders_empty")}
        />
      </motion.div>
    </div>
  );
}
