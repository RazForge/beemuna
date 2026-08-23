"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus, Trash2, Clock, Calendar, Bell, ChevronDown, Sparkles } from "lucide-react";
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

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = then - now;
  const absDiff = Math.abs(diff);
  const mins = Math.floor(absDiff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (diff > 0) {
    if (mins < 60) return `in ${mins}m`;
    if (hours < 24) return `in ${hours}h`;
    return `in ${days}d`;
  }
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
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
    for (let cycle = 0; cycle < 5; cycle++) {
      const base = cycle * 3;
      playBeep(880, base, 0.12, 0.25);
      playBeep(1100, base + 0.14, 0.12, 0.3);
      playBeep(880, base + 0.28, 0.12, 0.25);
      playBeep(1320, base + 0.42, 0.25, 0.35);
    }
  } catch {}
}

export function ReminderList({
  reminders,
  onToggle,
  onDelete,
  onAdd,
  defaultDate,
  emptyText = "No reminders yet",
  className,
}: ReminderListProps) {
  const { t } = useLang();
  const [showAdd, setShowAdd] = useState(false);
  const [text, setText] = useState("");
  const [pickedDate, setPickedDate] = useState(() => {
    const d = defaultDate ? new Date(defaultDate) : new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });
  const firedRef = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

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

  function submit() {
    const title = text.trim();
    if (!title || !onAdd) return;
    onAdd(title, pickedDate);
    setText("");
    setShowAdd(false);
    const next = new Date();
    next.setHours(next.getHours() + 1, 0, 0, 0);
    setPickedDate(next);
  }

  function openAdd() {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    setPickedDate(d);
    setShowAdd(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  const quickTimes = [
    { label: "15m", add: { h: 0, m: 15 } },
    { label: "30m", add: { h: 0, m: 30 } },
    { label: "1h", add: { h: 1, m: 0 } },
    { label: "2h", add: { h: 2, m: 0 } },
    { label: "Tomorrow", add: { h: 24, m: 0 } },
  ];

  const quickDates = [
    { label: "Today", date: () => { const d = new Date(); d.setHours(pickedDate.getHours(), pickedDate.getMinutes(), 0, 0); return d; } },
    { label: "Tomorrow", date: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(pickedDate.getHours(), pickedDate.getMinutes(), 0, 0); return d; } },
    { label: "In 3 days", date: () => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(pickedDate.getHours(), pickedDate.getMinutes(), 0, 0); return d; } },
    { label: "Next week", date: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(pickedDate.getHours(), pickedDate.getMinutes(), 0, 0); return d; } },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Empty state */}
      {total === 0 && completed.length === 0 && !showAdd && (
        <div className="glass rounded-3xl p-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Bell className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">{emptyText}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create your first reminder to stay on track</p>
          {onAdd && (
            <button
              onClick={openAdd}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4" />
              Create Reminder
            </button>
          )}
        </div>
      )}

      {/* Reminder groups */}
      {[
        { key: "today", label: "Today", icon: <Clock className="h-3.5 w-3.5" />, items: groups.today, color: "text-primary" },
        { key: "tomorrow", label: "Tomorrow", icon: <Calendar className="h-3.5 w-3.5" />, items: groups.tomorrow, color: "text-blue-500" },
        { key: "upcoming", label: "Upcoming", icon: <ChevronDown className="h-3.5 w-3.5" />, items: groups.upcoming, color: "text-muted-foreground" },
      ].map(
        (group) =>
          group.items.length > 0 && (
            <div key={group.key}>
              <div className={cn("mb-2 flex items-center gap-2 px-1", group.color)}>
                {group.icon}
                <span className="text-xs font-bold uppercase tracking-wider">{group.label}</span>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {group.items.length}
                </span>
              </div>
              <div className="space-y-2">
                {group.items.map((r) => (
                  <ReminderRow
                    key={r.id}
                    reminder={r}
                    onToggle={onToggle}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </div>
          ),
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 px-1 text-success">
            <Check className="h-3.5 w-3.5" />
            <span className="text-xs font-bold uppercase tracking-wider">Completed</span>
            <span className="ml-auto rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
              {completed.length}
            </span>
          </div>
          <div className="space-y-2">
            {completed.map((r) => (
              <ReminderRow
                key={r.id}
                reminder={r}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && onAdd && (
        <div className="glass rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">New Reminder</h3>
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) submit();
            }}
            placeholder="What do you need to remember?"
            className="h-12 w-full rounded-2xl bg-background/50 px-4 text-[15px] font-medium outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/30"
          />

          {/* Quick time buttons */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">When</p>
            <div className="flex flex-wrap gap-2">
              {quickTimes.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    const d = new Date();
                    d.setHours(d.getHours() + opt.add.h, d.getMinutes() + opt.add.m, 0, 0);
                    setPickedDate(d);
                  }}
                  className="rounded-full bg-muted/80 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date quick picks */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Date</p>
            <div className="flex flex-wrap gap-2">
              {quickDates.map((opt) => {
                const optDate = opt.date();
                const active = pickedDate.toDateString() === optDate.toDateString();
                return (
                  <button
                    key={opt.label}
                    onClick={() => setPickedDate(opt.date())}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                      active
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "bg-muted/80 text-muted-foreground hover:bg-primary/10 hover:text-primary",
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
                className="rounded-full bg-muted/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground outline-none"
              />
            </div>
          </div>

          {/* Time stepper */}
          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => setPickedDate((d) => { const n = new Date(d); n.setHours((n.getHours() + 1) % 24); return n; })}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/80 text-sm font-bold text-foreground hover:bg-primary/10 transition-colors"
              >
                +
              </button>
              <span className="h-10 w-12 flex items-center justify-center rounded-xl bg-background/50 text-lg font-bold tabular-nums">
                {String(pickedDate.getHours()).padStart(2, "0")}
              </span>
              <button
                onClick={() => setPickedDate((d) => { const n = new Date(d); n.setHours((n.getHours() + 23) % 24); return n; })}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/80 text-sm font-bold text-foreground hover:bg-primary/10 transition-colors"
              >
                −
              </button>
            </div>
            <span className="text-2xl font-bold text-primary/30">:</span>
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => setPickedDate((d) => { const n = new Date(d); n.setMinutes((n.getMinutes() + 5) % 60); return n; })}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/80 text-sm font-bold text-foreground hover:bg-primary/10 transition-colors"
              >
                +
              </button>
              <span className="h-10 w-12 flex items-center justify-center rounded-xl bg-background/50 text-lg font-bold tabular-nums">
                {String(pickedDate.getMinutes()).padStart(2, "0")}
              </span>
              <button
                onClick={() => setPickedDate((d) => { const n = new Date(d); n.setMinutes((n.getMinutes() + 55) % 60); return n; })}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/80 text-sm font-bold text-foreground hover:bg-primary/10 transition-colors"
              >
                −
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-2xl bg-primary/5 px-4 py-3 text-center">
            <p className="text-sm font-medium text-primary">
              {pickedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at{" "}
              {pickedDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowAdd(false)}
              className="h-11 flex-1 rounded-2xl bg-muted/80 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!text.trim()}
              className="h-11 flex-1 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl disabled:opacity-40 disabled:shadow-none"
            >
              Add Reminder
            </button>
          </div>
        </div>
      )}

      {/* Add button */}
      {onAdd && !showAdd && total > 0 && (
        <button
          onClick={openAdd}
          className="glass flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-primary transition-all hover:bg-primary/5"
        >
          <Plus className="h-4 w-4" />
          Add Reminder
        </button>
      )}
    </div>
  );
}

function ReminderRow({
  reminder,
  onToggle,
  onDelete,
}: {
  reminder: Reminder;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const done = reminder.status === "completed";
  const isPast = !done && new Date(reminder.scheduled_at).getTime() < Date.now();
  const isDueNow = !done && Math.abs(Date.now() - new Date(reminder.scheduled_at).getTime()) < 60000;

  return (
    <div
      className={cn(
        "glass group flex items-center gap-3 rounded-2xl px-4 py-3 transition-all",
        done && "opacity-50",
        isPast && !done && "border-l-2 border-l-amber-500",
        isDueNow && "border-l-2 border-l-primary animate-pulse",
      )}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(reminder.id, !done)}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
          done
            ? "border-primary bg-primary text-primary-foreground scale-110"
            : "border-muted-foreground/30 hover:border-primary hover:scale-110",
        )}
        aria-label={done ? "Mark as not completed" : "Mark as completed"}
      >
        {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[15px] font-medium leading-tight",
            done ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {reminder.title}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
              done
                ? "bg-muted text-muted-foreground"
                : isPast
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-primary/10 text-primary",
            )}
          >
            <Clock className="h-2.5 w-2.5" />
            {timeLabel(reminder.scheduled_at)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatRelativeTime(reminder.scheduled_at)}
          </span>
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(reminder.id)}
        className="shrink-0 rounded-full p-2 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
        aria-label="Delete reminder"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
