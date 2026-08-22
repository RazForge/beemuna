"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, Coffee } from "lucide-react";
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

const TOTAL_SECONDS = 25 * 60;

function playComplete() {
  try {
    const ctx = new AudioContext();
    const playBeep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    playBeep(523, 0, 0.2);
    playBeep(659, 0.22, 0.2);
    playBeep(784, 0.44, 0.2);
    playBeep(1047, 0.66, 0.4);
  } catch {}
}

export default function FocusPage() {
  const queryClient = useQueryClient();
  const { t } = useLang();
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null);
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);
  const [running, setRunning] = useState(false);
  const startRef = useRef<number | null>(null);
  const totalRef = useRef(TOTAL_SECONDS);
  const rafRef = useRef<number>(0);
  const completedRef = useRef(false);

  // Load active session from server
  useQuery({
    queryKey: ["active-focus"],
    queryFn: async () => {
      const list = await apiGet<FocusSession[]>("/focus?status=running&limit=1");
      const s = list[0] || null;
      if (s && (!activeSession || activeSession.id !== s.id)) {
        setActiveSession(s);
        const remaining = s.remaining_seconds ?? TOTAL_SECONDS;
        totalRef.current = s.planned_minutes * 60;
        setTimeLeft(remaining);
        startRef.current = Date.now() - ((s.planned_minutes * 60 - remaining) * 1000);
        setRunning(true);
        completedRef.current = false;
      }
      return list;
    },
  });

  // Background timer using requestAnimationFrame + timestamp
  useEffect(() => {
    if (!running || !startRef.current) return;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startRef.current!) / 1000);
      const remaining = Math.max(0, totalRef.current - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0 && !completedRef.current) {
        completedRef.current = true;
        setRunning(false);
        playComplete();
        toast.success(t("focus_completed"));
        updateSession.mutate({ status: "completed", remaining_seconds: 0 });

        // Send browser notification
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Focus Session Complete", { body: "Great work! Time for a break." });
        }
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running]);

  // Sync when page becomes visible again
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && running && startRef.current) {
        const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
        const remaining = Math.max(0, totalRef.current - elapsed);
        setTimeLeft(remaining);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [running]);

  // Keep page title updated with timer
  useEffect(() => {
    if (running) {
      const m = Math.floor(timeLeft / 60);
      const s = timeLeft % 60;
      document.title = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} — Focus | BE'EMUNA`;
    } else {
      document.title = "Focus — BE'EMUNA";
    }
  }, [running, timeLeft]);

  const startSession = useMutation({
    mutationFn: () => apiPost<FocusSession>("/focus", { kind: "pomodoro", planned_minutes: 25 }),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ["active-focus"] });
      setActiveSession(s);
      totalRef.current = s.planned_minutes * 60;
      setTimeLeft(s.planned_minutes * 60);
      startRef.current = Date.now();
      setRunning(true);
      completedRef.current = false;
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
        startRef.current = null;
      } else {
        setActiveSession(s);
      }
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const progress = ((totalRef.current - timeLeft) / totalRef.current) * 100;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const circumference = 2 * Math.PI * 120;

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
            className="stroke-primary fill-none transition-all duration-300"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress / 100)}
            strokeLinecap="round"
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
              <Button size="lg" variant="outline" className="w-28" onClick={() => {
                setRunning(false);
                const elapsed = startRef.current ? Math.floor((Date.now() - startRef.current) / 1000) : 0;
                const remaining = Math.max(0, totalRef.current - elapsed);
                setTimeLeft(remaining);
                updateSession.mutate({ status: "paused", remaining_seconds: remaining });
              }}>
                <Pause className="h-4 w-4" /> {t("pause")}
              </Button>
            ) : (
              <Button size="lg" className="w-28" onClick={() => {
                startRef.current = Date.now() - ((totalRef.current - timeLeft) * 1000);
                setRunning(true);
                completedRef.current = false;
                updateSession.mutate({ status: "running" });
              }}>
                <Play className="h-4 w-4" /> {t("resume")}
              </Button>
            )}
            <Button size="lg" variant="ghost" className="w-28 text-destructive hover:bg-destructive/10" onClick={() => updateSession.mutate({ status: "cancelled" })}>
              <Square className="h-4 w-4" /> {t("stop")}
            </Button>
          </>
        )}
      </div>

      {running && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Coffee className="h-3 w-3" />
          Timer keeps running even when you navigate away
        </p>
      )}
    </div>
  );
}
