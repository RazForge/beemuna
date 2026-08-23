"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { Play, Pause, Square, Minus, Plus, Volume2, Bell, Clock } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface FocusSession {
  id: string;
  kind: string;
  status: string;
  planned_minutes: number;
  remaining_seconds: number | null;
  elapsed_minutes: number;
  started_at: string;
}

const PRESETS = [
  { label: "5m", minutes: 5 },
  { label: "15m", minutes: 15 },
  { label: "25m", minutes: 25 },
  { label: "30m", minutes: 30 },
  { label: "45m", minutes: 45 },
  { label: "60m", minutes: 60 },
  { label: "90m", minutes: 90 },
];

const RELIGION_QUOTES: Record<string, string[]> = {
  muslim: [
    "Indeed, Allah is with the patient. — Quran 2:153",
    "Verily, with hardship comes ease. — Quran 94:6",
    "Take regulators of affairs and pray. — Quran 47:33",
    "And whoever fears Allah — He will make for him a way out. — Quran 65:2",
    "Put your trust in Allah. — Quran 3:122",
    "Be patient. Indeed, the promise of Allah is truth. — Quran 30:60",
    "And whoever relies upon Allah — then He is sufficient for him. — Quran 65:3",
    "So remember Me; I will remember you. — Quran 2:152",
    "Allah does not burden a soul beyond that it can bear. — Quran 2:286",
    "Indeed, the patient will be given their reward without account. — Quran 39:10",
  ],
  christian: [
    "I can do all things through Christ who strengthens me. — Philippians 4:13",
    "Be strong and courageous. Do not be afraid. — Joshua 1:9",
    "The Lord is my shepherd; I shall not want. — Psalm 23:1",
    "Trust in the Lord with all your heart. — Proverbs 3:5",
    "For I know the plans I have for you. — Jeremiah 29:11",
    "God is our refuge and strength. — Psalm 46:1",
    "Be still, and know that I am God. — Psalm 46:10",
    "The joy of the Lord is your strength. — Nehemiah 8:10",
    "Do not grow weary in doing good. — Galatians 6:9",
    "He who began a good work in you will carry it on. — Philippians 1:6",
  ],
  jewish: [
    "Be strong and of good courage. — Deuteronomy 31:6",
    "The Lord is my light and my salvation. — Psalm 27:1",
    "Commit your work to the Lord. — Proverbs 16:3",
    "He who began a good work will complete it. — Philippians 1:6",
    "Trust in the Lord forever. — Isaiah 26:4",
    "I will strengthen you and help you. — Isaiah 41:10",
    "The steps of a man are established by the Lord. — Psalm 37:23",
    "Whatever you do, work at it with all your heart. — Colossians 3:23",
  ],
  unspecified: [
    "The only way to do great work is to love what you do. — Steve Jobs",
    "Focus is the art of knowing what to ignore. — James Clear",
    "Deep work is the ability to focus without distraction. — Cal Newport",
    "Your future is created by what you do today. — Robert Kiyosaki",
    "Discipline is choosing between what you want now and what you want most. — Abraham Lincoln",
    "It is during our darkest moments that we must focus to see the light. — Aristotle",
    "Concentrate all your thoughts upon the work at hand. — Alexander Graham Bell",
    "The successful warrior is the average man, with laser-like focus. — Bruce Lee",
    "You will never reach your destination if you stop and throw stones at every dog that barks. — Churchill",
    "Small disciplines repeated with consistency every day lead to great achievements. — John C. Maxwell",
  ],
};

function playComplete() {
  try {
    const ctx = new AudioContext();
    const playBeep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    playBeep(523, 0, 0.15);
    playBeep(659, 0.17, 0.15);
    playBeep(784, 0.34, 0.15);
    playBeep(1047, 0.51, 0.3);
    playBeep(784, 0.9, 0.15);
    playBeep(1047, 1.07, 0.4);
  } catch {}
}

function playTickSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  } catch {}
}

function playWarningSound() {
  try {
    const ctx = new AudioContext();
    const playBeep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    playBeep(440, 0, 0.1);
    playBeep(440, 0.15, 0.1);
    playBeep(440, 0.3, 0.1);
  } catch {}
}

export default function FocusPage() {
  const queryClient = useQueryClient();
  const { t } = useLang();
  const { user } = useAuth();
  const religion = user?.religion ?? "unspecified";
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(25);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifyOnTabSwitch, setNotifyOnTabSwitch] = useState(true);
  const [quoteIndex, setQuoteIndex] = useState(0);

  const startRef = useRef<number | null>(null);
  const totalRef = useRef(25 * 60);
  const completedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMinuteRef = useRef<number>(-1);
  const warnedRef = useRef(false);

  const quotes = RELIGION_QUOTES[religion] || RELIGION_QUOTES.unspecified;

  // Cycle quote every 60 seconds
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 60000);
    return () => clearInterval(timer);
  }, [running, quotes.length]);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const sessionsQuery = useQuery({
    queryKey: ["focus-sessions"],
    queryFn: () => apiGet<FocusSession[]>("/focus?limit=20"),
  });

  useQuery({
    queryKey: ["active-focus"],
    queryFn: async () => {
      const list = await apiGet<FocusSession[]>("/focus?status=running&limit=1");
      const s = list[0] || null;
      if (s && (!activeSession || activeSession.id !== s.id)) {
        const startedAt = new Date(s.started_at).getTime();
        const staleMs = 10 * 60 * 1000;
        if (Date.now() - startedAt > staleMs) {
          await apiPatch(`/focus/${s.id}`, { status: "cancelled" });
          queryClient.invalidateQueries({ queryKey: ["active-focus"] });
          queryClient.invalidateQueries({ queryKey: ["focus-sessions"] });
          toast.info("Old focus session was auto-cancelled");
          return list;
        }
        setActiveSession(s);
        const remaining = s.remaining_seconds ?? s.planned_minutes * 60;
        totalRef.current = s.planned_minutes * 60;
        setTimeLeft(remaining);
        setCustomMinutes(s.planned_minutes);
        startRef.current = Date.now() - ((s.planned_minutes * 60 - remaining) * 1000);
        setRunning(true);
        completedRef.current = false;
        lastMinuteRef.current = Math.floor(remaining / 60);
        warnedRef.current = false;
      }
      return list;
    },
  });

  // Tab-switch detection
  useEffect(() => {
    if (!running || !notifyOnTabSwitch) return;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && activeSession) {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Focus session active", {
            body: `${Math.floor(timeLeft / 60)}m ${timeLeft % 60}s remaining — stay focused!`,
            icon: "/favicon.ico",
            tag: "focus-switch",
          });
        }
        if (soundEnabled) playTickSound();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [running, notifyOnTabSwitch, activeSession, timeLeft, soundEnabled]);

  // Background timer
  useEffect(() => {
    if (!running || !startRef.current) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current!) / 1000);
      const remaining = Math.max(0, totalRef.current - elapsed);
      setTimeLeft(remaining);
      const currentMinute = Math.floor(remaining / 60);
      if (soundEnabled && currentMinute !== lastMinuteRef.current && remaining > 0) {
        lastMinuteRef.current = currentMinute;
      }
      if (remaining === 300 && !warnedRef.current) {
        warnedRef.current = true;
        if (soundEnabled) playWarningSound();
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Focus: 5 minutes left", { body: "Almost there — keep going!", icon: "/favicon.ico", tag: "focus-warning" });
        }
        toast.info("5 minutes remaining!");
      }
      if (remaining <= 0 && !completedRef.current) {
        completedRef.current = true;
        setRunning(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (soundEnabled) playComplete();
        toast.success(t("focus_completed") || "Focus session complete!");
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Focus Session Complete!", { body: "Great work! Time for a break.", icon: "/favicon.ico", tag: "focus-complete" });
        }
        updateSession.mutate({ status: "completed", remaining_seconds: 0 });
        return;
      }
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, soundEnabled]);

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
    mutationFn: () => apiPost<FocusSession>("/focus", { kind: "custom", planned_minutes: customMinutes }),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ["active-focus"] });
      setActiveSession(s);
      totalRef.current = s.planned_minutes * 60;
      setTimeLeft(s.planned_minutes * 60);
      startRef.current = Date.now();
      setRunning(true);
      completedRef.current = false;
      lastMinuteRef.current = s.planned_minutes;
      warnedRef.current = false;
      setQuoteIndex(0);
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
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        setActiveSession(s);
      }
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const progress = ((totalRef.current - timeLeft) / totalRef.current) * 100;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  const adjustMinutes = (delta: number) => {
    setCustomMinutes((prev) => {
      const next = Math.max(1, Math.min(480, prev + delta));
      setTimeLeft(next * 60);
      totalRef.current = next * 60;
      return next;
    });
  };

  const presetTime = (minutes: number) => {
    setCustomMinutes(minutes);
    setTimeLeft(minutes * 60);
    totalRef.current = minutes * 60;
  };

  // Calculate pendulum angle based on time progress
  const pendulumAngle = running ? Math.sin((Date.now() / 1200) * Math.PI) * 12 : 0;
  const [pendulumTick, setPendulumTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const anim = setInterval(() => setPendulumTick(Date.now()), 50);
    return () => clearInterval(anim);
  }, [running]);
  const currentPendulumAngle = running ? Math.sin((pendulumTick / 1200) * Math.PI) * 15 : 0;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">{t("focus_title") || "Focus"}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("focus_subtitle") || "Deep work sessions with background protection"}</p>
      </div>

      {/* Pendulum Clock */}
      <div className="relative flex flex-col items-center">
        {/* Clock case */}
        <div className="glass rounded-3xl p-6 pb-4 w-64">
          {/* Top ornament */}
          <div className="mx-auto mb-3 h-3 w-3 rounded-full border-2 border-primary/30" />
          
          {/* Clock face */}
          <div className="relative mx-auto flex h-44 w-44 items-center justify-center rounded-full border-[3px] border-primary/20 bg-gradient-to-b from-background to-background/80 shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)]">
            {/* Hour markers */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 - 90) * Math.PI / 180;
              const isMain = i % 3 === 0;
              const r = 60;
              const x = 50 + r * Math.cos(angle);
              const y = 50 + r * Math.sin(angle);
              return (
                <div
                  key={i}
                  className={cn(
                    "absolute rounded-full",
                    isMain ? "h-2 w-2 bg-primary/60" : "h-1 w-1 bg-muted-foreground/30"
                  )}
                  style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
                />
              );
            })}

            {/* Hour hand */}
            <div
              className="absolute left-1/2 top-[25%] h-12 w-[3px] -translate-x-1/2 rounded-full bg-foreground/70 origin-bottom"
              style={{ transform: `translateX(-50%) rotate(${(mins / 60) * 360 + (secs / 3600) * 360}deg)` }}
            />
            
            {/* Minute hand */}
            <div
              className="absolute left-1/2 top-[15%] h-16 w-[2px] -translate-x-1/2 rounded-full bg-foreground origin-bottom"
              style={{ transform: `translateX(-50%) rotate(${(secs / 60) * 360}deg)` }}
            />
            
            {/* Second hand */}
            {running && (
              <div
                className="absolute left-1/2 top-[18%] h-14 w-[1px] -translate-x-1/2 rounded-full bg-primary origin-bottom"
                style={{ transform: `translateX(-50%) rotate(${((Date.now() / 1000) % 60) * 6}deg)` }}
              />
            )}
            
            {/* Center dot */}
            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-md" />
            
            {/* Digital time overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-bold tabular-nums tracking-tighter text-foreground drop-shadow-sm">
                {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                {running ? "In Flow" : activeSession ? "Paused" : "Ready"}
              </p>
            </div>
          </div>
        </div>

        {/* Pendulum */}
        <div className="relative -mt-2 flex h-20 w-20 flex-col items-center overflow-visible">
          <div
            className="flex flex-col items-center"
            style={{
              transformOrigin: "top center",
              transform: `rotate(${currentPendulumAngle}deg)`,
              transition: running ? "none" : "transform 0.5s ease-out",
            }}
          >
            <div className="mx-auto h-10 w-[2px] rounded-full bg-primary/30" />
            <div className="mx-auto h-5 w-5 rounded-full border-2 border-primary/40 bg-primary/10 shadow-lg" />
          </div>
        </div>
      </div>

      {/* AI Religion-based Quote */}
      {running && (
        <div className="glass rounded-2xl p-4 text-center max-w-sm">
          <p className="text-sm italic text-muted-foreground leading-relaxed">
            &ldquo;{quotes[quoteIndex]}&rdquo;
          </p>
        </div>
      )}

      {/* Controls — only shown when there's an active session */}
      {activeSession && (
        <div className="flex gap-3">
          {running ? (
            <Button size="lg" variant="outline" className="w-28 glass" onClick={() => {
              setRunning(false);
              if (intervalRef.current) clearInterval(intervalRef.current);
              const elapsed = startRef.current ? Math.floor((Date.now() - startRef.current) / 1000) : 0;
              const remaining = Math.max(0, totalRef.current - elapsed);
              setTimeLeft(remaining);
              updateSession.mutate({ status: "paused", remaining_seconds: remaining });
            }}>
              <Pause className="h-4 w-4" /> {t("pause") || "Pause"}
            </Button>
          ) : (
            <Button size="lg" className="w-28" onClick={() => {
              startRef.current = Date.now() - ((totalRef.current - timeLeft) * 1000);
              setRunning(true);
              completedRef.current = false;
              lastMinuteRef.current = Math.floor(timeLeft / 60);
              warnedRef.current = timeLeft > 300;
              updateSession.mutate({ status: "running" });
            }}>
              <Play className="h-4 w-4" /> {t("resume") || "Resume"}
            </Button>
          )}
          <Button size="lg" variant="ghost" className="w-28 text-destructive hover:bg-destructive/10" onClick={() => updateSession.mutate({ status: "cancelled" })}>
            <Square className="h-4 w-4" /> {t("stop") || "Stop"}
          </Button>
        </div>
      )}

      {/* Time Picker — always visible when no active session */}
      {!activeSession && (
        <div className="glass w-full rounded-2xl p-5 space-y-5">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Set Focus Time
          </h3>

          {/* Manual adjust */}
          <div className="flex items-center justify-center gap-6">
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full glass" onClick={() => adjustMinutes(-5)}>
              <Minus className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <p className="text-6xl font-bold tabular-nums">{customMinutes}</p>
              <p className="text-xs text-muted-foreground">minutes</p>
            </div>
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full glass" onClick={() => adjustMinutes(5)}>
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          {/* Presets */}
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.minutes}
                onClick={() => presetTime(p.minutes)}
                className={cn(
                  "rounded-xl border py-2.5 text-xs font-bold transition-all",
                  customMinutes === p.minutes
                    ? "border-primary bg-primary text-primary-foreground shadow-md"
                    : "border-border hover:border-primary/40 hover:bg-primary/5"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <Button className="w-full h-12 rounded-xl text-sm font-semibold" size="lg" onClick={() => startSession.mutate()} loading={startSession.isPending}>
            <Play className="h-4 w-4" /> Start {customMinutes}min Focus
          </Button>
        </div>
      )}

      {/* Stuck session */}
      {activeSession && !running && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={async () => {
            try {
              await apiPatch(`/focus/${activeSession.id}`, { status: "cancelled" });
              setActiveSession(null);
              setRunning(false);
              startRef.current = null;
              if (intervalRef.current) clearInterval(intervalRef.current);
              queryClient.invalidateQueries({ queryKey: ["active-focus"] });
              queryClient.invalidateQueries({ queryKey: ["focus-sessions"] });
              toast.success("Session reset");
            } catch {
              toast.error("Failed to reset session");
            }
          }}
        >
          Session stuck? Click to reset
        </Button>
      )}

      {/* Settings */}
      {!activeSession && (
        <div className="w-full space-y-3">
          <div className="glass flex items-center justify-between rounded-2xl p-3">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Notification Sound</span>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                soundEnabled ? "bg-primary" : "bg-muted"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                soundEnabled ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
          </div>

          <div className="glass flex items-center justify-between rounded-2xl p-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Alert When Switching Tabs</span>
            </div>
            <button
              onClick={() => setNotifyOnTabSwitch(!notifyOnTabSwitch)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                notifyOnTabSwitch ? "bg-primary" : "bg-muted"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                notifyOnTabSwitch ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {!activeSession && sessionsQuery.data && (() => {
        const sessions = sessionsQuery.data ?? [];
        const completed = sessions.filter((s) => s.status === "completed");
        const totalMinutes = completed.reduce((acc, s) => acc + s.elapsed_minutes, 0);
        const totalHours = Math.floor(totalMinutes / 60);
        const todayStr = new Date().toISOString().slice(0, 10);
        const todaySessions = completed.filter((s) => s.started_at?.slice(0, 10) === todayStr);
        const todayMinutes = todaySessions.reduce((acc, s) => acc + s.elapsed_minutes, 0);

        return (
          <div className="glass w-full rounded-2xl p-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold">{completed.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sessions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{totalHours}h</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{todayMinutes}m</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Today</p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
