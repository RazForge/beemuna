"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus, Trash2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import type { Reminder } from "@/lib/types";
import { toast } from "sonner";

interface ReminderListProps {
  reminders: Reminder[];
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onAdd?: (title: string, scheduledAt: Date) => void;
  defaultDate?: Date;
  emptyText?: string;
  className?: string;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function playAlarm() {
  try {
    const ctx = new AudioContext();
    const playBeep = (freq: number, start: number, dur: number, vol = 0.3) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    // 15-second alarm pattern: repeated beeps with pauses
    for (let cycle = 0; cycle < 5; cycle++) {
      const base = cycle * 3;
      playBeep(880, base, 0.12, 0.25);
      playBeep(1100, base + 0.14, 0.12, 0.3);
      playBeep(880, base + 0.28, 0.12, 0.25);
      playBeep(1320, base + 0.42, 0.25, 0.35);
    }
  } catch {}
}

function toInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function AppleTimeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl px-3 py-2 text-sm font-medium transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted text-muted-foreground hover:bg-muted/80",
      )}
    >
      {label}
    </button>
  );
}

export function ReminderList({
  reminders,
  onToggle,
  onDelete,
  onAdd,
  defaultDate,
  emptyText = "No reminders",
  className,
}: ReminderListProps) {
  const { t } = useLang();
  const [text, setText] = useState("");
  const [showSheet, setShowSheet] = useState(false);
  const [pickedDate, setPickedDate] = useState(() => {
    const d = defaultDate ? new Date(defaultDate) : new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });
  const firedRef = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Alarm checker
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      for (const r of reminders) {
        if (r.status === "completed") continue;
        if (firedRef.current.has(r.id)) continue;
        const due = new Date(r.scheduled_at).getTime();
        if (due <= now && due > now - 15000) {
          firedRef.current.add(r.id);
          playAlarm();
          toast(r.title, {
            icon: <Clock className="h-4 w-4" />,
            description: "Reminder due now",
            duration: 10000,
          });
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(r.title, { body: "Reminder due now" });
          }
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [reminders]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (defaultDate) {
      const d = new Date(defaultDate);
      d.setHours(d.getHours() + 1, 0, 0, 0);
      setPickedDate(d);
    }
  }, [defaultDate?.toDateString?.()]);

  const today = startOfDay(new Date());
  const tomorrow = new Date(today.getTime() + 86400000);
  const todayKey = dayKey(today);
  const tomorrowKey = dayKey(tomorrow);

  const groups = reminders.reduce<Record<string, Reminder[]>>(
    (acc, r) => {
      if (r.status === "completed") return acc;
      const d = startOfDay(new Date(r.scheduled_at));
      const key = dayKey(d);
      if (key === todayKey) acc.today.push(r);
      else if (key === tomorrowKey) acc.tomorrow.push(r);
      else acc.upcoming.push(r);
      return acc;
    },
    { today: [], tomorrow: [], upcoming: [] },
  );
  const completed = reminders.filter((r) => r.status === "completed");
  const total = reminders.filter((r) => r.status !== "completed").length;

  function quickTime(hoursFromNow: number) {
    const d = new Date();
    d.setHours(d.getHours() + hoursFromNow, 0, 0, 0);
    return d;
  }

  function submit() {
    const title = text.trim();
    if (!title || !onAdd) return;
    onAdd(title, pickedDate);
    setText("");
    setShowSheet(false);
    const next = new Date();
    next.setHours(next.getHours() + 1, 0, 0, 0);
    setPickedDate(next);
  }

  function openSheet() {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    setPickedDate(d);
    setShowSheet(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {[
        { key: "today", labelKey: "today", items: groups.today },
        { key: "tomorrow", labelKey: "tomorrow", items: groups.tomorrow },
        { key: "upcoming", labelKey: "upcoming", items: groups.upcoming },
      ].map(
        (group) =>
          group.items.length > 0 && (
            <div key={group.key}>
              <div className="px-1 pt-4 pb-2 text-[13px] font-semibold text-muted-foreground">
                {t(group.labelKey)}
              </div>
              <div className="rounded-2xl bg-card/60 ring-1 ring-black/5 dark:ring-white/10">
                {group.items.map((r) => (
                  <ReminderRow
                    key={r.id}
                    reminder={r}
                    onToggle={onToggle}
                    onDelete={onDelete}
                    last={r === group.items[group.items.length - 1]}
                  />
                ))}
              </div>
            </div>
          ),
      )}

      {completed.length > 0 && (
        <div className="px-1 pt-4 pb-2 text-[13px] font-semibold text-muted-foreground">
          {t("completed")}
        </div>
      )}
      {completed.map((r) => (
        <ReminderRow
          key={r.id}
          reminder={r}
          onToggle={onToggle}
          onDelete={onDelete}
          last={r === completed[completed.length - 1]}
        />
      ))}

      {total === 0 && completed.length === 0 && (
        <div className="rounded-2xl bg-card/60 py-10 text-center text-sm text-muted-foreground ring-1 ring-black/5 dark:ring-white/10">
          {emptyText}
        </div>
      )}

      {/* Apple-style add button */}
      {onAdd && !showSheet && (
        <button
          onClick={openSheet}
          className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/30 bg-primary/5 py-3 text-sm font-medium text-primary transition-all hover:bg-primary/10 hover:border-primary/50"
        >
          <Plus className="h-4 w-4" />
          Add Reminder
        </button>
      )}

      {/* Apple-style bottom sheet */}
      {showSheet && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowSheet(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-card p-6 pb-10 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-muted-foreground/30" />

            {/* Title */}
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && text.trim()) submit();
              }}
              placeholder="What's the reminder?"
              className="mb-5 h-12 w-full rounded-2xl bg-muted px-4 text-[17px] font-medium outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/40"
            />

            {/* Date selection */}
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Date</p>
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {[
                { label: "Today", date: () => { const d = new Date(); d.setHours(pickedDate.getHours(), pickedDate.getMinutes(), 0, 0); return d; } },
                { label: "Tomorrow", date: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(pickedDate.getHours(), pickedDate.getMinutes(), 0, 0); return d; } },
                { label: "In 2 days", date: () => { const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(pickedDate.getHours(), pickedDate.getMinutes(), 0, 0); return d; } },
                { label: "Next week", date: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(pickedDate.getHours(), pickedDate.getMinutes(), 0, 0); return d; } },
              ].map((opt) => {
                const optDate = opt.date();
                const active = pickedDate.toDateString() === optDate.toDateString();
                return (
                  <button
                    key={opt.label}
                    onClick={() => setPickedDate(opt.date())}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
              <input
                type="date"
                value={`${pickedDate.getFullYear()}-${String(pickedDate.getMonth() + 1).padStart(2, "0")}-${String(pickedDate.getDate()).padStart(2, "0")}`}
                onChange={(e) => {
                  const [y, m, d] = e.target.value.split("-").map(Number);
                  const newDate = new Date(pickedDate);
                  newDate.setFullYear(y, m - 1, d);
                  setPickedDate(newDate);
                }}
                className="shrink-0 rounded-full bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground outline-none"
              />
            </div>

            {/* Time selection */}
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Time</p>
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {[
                { label: "In 15 min", add: { h: 0, m: 15 } },
                { label: "In 30 min", add: { h: 0, m: 30 } },
                { label: "In 1 hr", add: { h: 1, m: 0 } },
                { label: "In 2 hr", add: { h: 2, m: 0 } },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    const d = new Date();
                    d.setHours(d.getHours() + opt.add.h, d.getMinutes() + opt.add.m, 0, 0);
                    setPickedDate(d);
                  }}
                  className="shrink-0 rounded-full bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted/80 transition-all"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Pendulum clock time picker */}
            <div className="mb-5 flex flex-col items-center gap-2">
              {/* Clock face */}
              <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-[5px] border-foreground/15 bg-card shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)]">
                {/* Hour numbers */}
                {[12,1,2,3,4,5,6,7,8,9,10,11].map((num) => {
                  const angle = (num * 30 - 90) * Math.PI / 180;
                  const r = 46;
                  const x = 50 + r * Math.cos(angle);
                  const y = 50 + r * Math.sin(angle);
                  return (
                    <span key={num} className="absolute text-[11px] font-bold text-foreground/60" style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}>{num}</span>
                  );
                })}
                {/* Hour hand */}
                <div
                  className="absolute left-1/2 top-[22%] h-7 w-[3.5px] -translate-x-1/2 rounded-full bg-foreground/80"
                  style={{ transformOrigin: "bottom center", transform: `translateX(-50%) rotate(${(pickedDate.getHours() % 12) * 30 + pickedDate.getMinutes() * 0.5}deg)` }}
                />
                {/* Minute hand */}
                <div
                  className="absolute left-1/2 top-[18%] h-10 w-[2px] -translate-x-1/2 rounded-full bg-primary"
                  style={{ transformOrigin: "bottom center", transform: `translateX(-50%) rotate(${pickedDate.getMinutes() * 6}deg)` }}
                />
                {/* Second hand */}
                <div
                  className="absolute left-1/2 top-[20%] h-9 w-[1px] -translate-x-1/2 rounded-full bg-destructive/70"
                  style={{ transformOrigin: "bottom center", transform: `translateX(-50%) rotate(${pickedDate.getSeconds() * 6}deg)` }}
                />
                {/* Center cap */}
                <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-sm" />
              </div>

              {/* Pendulum — rod + bob */}
              <div className="flex h-14 w-14 flex-col items-center">
                <div className="pendulum-swing" style={{ transformOrigin: "top center" }}>
                  <div className="mx-auto h-8 w-[2px] rounded-full bg-foreground/25" />
                  <div className="mx-auto h-4 w-4 rounded-full bg-foreground/15 border border-foreground/20" />
                </div>
              </div>

              {/* Time controls */}
              <div className="flex items-center gap-5">
                <div className="flex flex-col items-center gap-1">
                  <button onClick={() => setPickedDate((d) => { const n = new Date(d); n.setHours((n.getHours() + 1) % 24); return n; })} className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-foreground hover:bg-muted transition-colors">▲</button>
                  <span className="h-11 w-14 flex items-center justify-center rounded-2xl bg-muted text-lg font-bold tabular-nums">{String(pickedDate.getHours()).padStart(2, "0")}</span>
                  <button onClick={() => setPickedDate((d) => { const n = new Date(d); n.setHours((n.getHours() + 23) % 24); return n; })} className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-foreground hover:bg-muted transition-colors">▼</button>
                </div>
                <span className="text-xl font-bold text-foreground/30">:</span>
                <div className="flex flex-col items-center gap-1">
                  <button onClick={() => setPickedDate((d) => { const n = new Date(d); n.setMinutes((n.getMinutes() + 5) % 60); return n; })} className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-foreground hover:bg-muted transition-colors">▲</button>
                  <span className="h-11 w-14 flex items-center justify-center rounded-2xl bg-muted text-lg font-bold tabular-nums">{String(pickedDate.getMinutes()).padStart(2, "0")}</span>
                  <button onClick={() => setPickedDate((d) => { const n = new Date(d); n.setMinutes((n.getMinutes() + 55) % 60); return n; })} className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-foreground hover:bg-muted transition-colors">▼</button>
                </div>
              </div>
            </div>

            {/* Summary */}
            <p className="mb-5 text-center text-sm text-muted-foreground">
              {pickedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at{" "}
              {pickedDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowSheet(false)}
                className="h-12 flex-1 rounded-2xl bg-muted text-sm font-semibold text-foreground transition-colors hover:bg-muted/80"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!text.trim()}
                className="h-12 flex-1 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                Add Reminder
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ReminderRow({
  reminder,
  onToggle,
  onDelete,
  last,
}: {
  reminder: Reminder;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  last: boolean;
}) {
  const done = reminder.status === "completed";
  const isPast = !done && new Date(reminder.scheduled_at).getTime() < Date.now();
  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 transition-colors",
        !last && "border-b border-black/5 dark:border-white/5",
      )}
    >
      <button
        onClick={() => onToggle(reminder.id, !done)}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all",
          done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40 hover:border-primary hover:text-primary",
        )}
        aria-label={done ? "Mark as not completed" : "Mark as completed"}
      >
        {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[15px]",
          done ? "text-muted-foreground line-through" : isPast ? "text-amber-600 dark:text-amber-400 font-medium" : "text-foreground",
        )}
      >
        {reminder.title}
      </span>
      <span className={cn("shrink-0 text-xs tabular-nums", isPast ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
        {timeLabel(reminder.scheduled_at)}
      </span>
      <button
        onClick={() => onDelete(reminder.id)}
        className="shrink-0 rounded-full p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
        aria-label="Delete reminder"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
