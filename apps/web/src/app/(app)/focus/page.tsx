"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";

interface FocusSession {
  id: string;
  kind: string;
  status: string;
  planned_minutes: number;
  remaining_seconds: number | null;
  elapsed_minutes: number;
  started_at: string;
}

export default function FocusPage() {
  const queryClient = useQueryClient();
  const { t } = useLang();
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);

  useQuery({
    queryKey: ["active-focus"],
    queryFn: async () => {
      const list = await apiGet<FocusSession[]>("/focus?status=running&limit=1");
      const s = list[0] || null;
      if (s && (!activeSession || activeSession.id !== s.id)) {
        setActiveSession(s);
        setTimeLeft(s.remaining_seconds ?? 25 * 60);
        setRunning(true);
      }
      return list;
    },
  });

  const startSession = useMutation({
    mutationFn: () => apiPost<FocusSession>("/focus", { kind: "pomodoro", planned_minutes: 25 }),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ["active-focus"] });
      setActiveSession(s);
      setTimeLeft(25 * 60);
      setRunning(true);
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const updateSession = useMutation({
    mutationFn: (payload: { status: string; remaining_seconds?: number }) =>
      apiPatch<FocusSession>(`/focus/${activeSession?.id}`, payload),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ["active-focus"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-timeline"] });
      if (s.status === "completed" || s.status === "cancelled") {
        setActiveSession(null);
        setRunning(false);
      } else {
        setActiveSession(s);
      }
    },
    onError: (err) => toast.error(formatError(err)),
  });

  useEffect(() => {
    if (!running || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          updateSession.mutate({ status: "completed" });
          toast.success(t("focus_completed"));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, timeLeft, updateSession]);

  const progress = ((25 * 60 - timeLeft) / (25 * 60)) * 100;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-8 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">{t("focus_title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("focus_subtitle")}</p>
      </div>

      <div className="relative flex h-64 w-64 items-center justify-center rounded-full bg-card shadow-[0_12px_40px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10">
        <svg className="absolute inset-0 h-full w-full -rotate-90">
          <circle
            cx="128"
            cy="128"
            r="120"
            className="stroke-black/5 fill-none dark:stroke-white/10"
            strokeWidth="4"
          />
          <circle
            cx="128"
            cy="128"
            r="120"
            className="stroke-primary fill-none transition-all duration-1000"
            strokeWidth="4"
            strokeDasharray={2 * Math.PI * 120}
            strokeDashoffset={2 * Math.PI * 120 * (1 - progress / 100)}
          />
        </svg>

        <div className="text-center z-10">
          <p className="text-6xl font-bold tracking-tighter tabular-nums">
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2">
            {running ? t("flow_state") : t("paused")}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        {!activeSession ? (
          <Button size="lg" className="w-40" onClick={() => startSession.mutate()}>
            <Play className="h-4 w-4" /> {t("start_focus")}
          </Button>
        ) : (
          <>
            {running ? (
              <Button size="lg" variant="outline" className="w-28" onClick={() => { setRunning(false); updateSession.mutate({ status: "paused", remaining_seconds: timeLeft }); }}>
                <Pause className="h-4 w-4" /> {t("pause")}
              </Button>
            ) : (
              <Button size="lg" className="w-28" onClick={() => { setRunning(true); updateSession.mutate({ status: "running" }); }}>
                <Play className="h-4 w-4" /> {t("resume")}
              </Button>
            )}
            <Button size="lg" variant="ghost" className="w-28 text-destructive hover:bg-destructive/10" onClick={() => updateSession.mutate({ status: "cancelled" })}>
              <Square className="h-4 w-4" /> {t("stop")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}