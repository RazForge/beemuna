"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus, Trash2, CalendarClock, Bell, BellOff } from "lucide-react";
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
    playBeep(880, 0, 0.15);
    playBeep(1100, 0.18, 0.15);
    playBeep(880, 0.36, 0.15);
    playBeep(1320, 0.54, 0.3);
  } catch {}
}

function formatAddDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
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
  const [datetime, setDatetime] = useState(() => {
    const d = defaultDate ? new Date(defaultDate) : new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return formatAddDate(d);
  });
  const firedRef = useRef<Set<string>>(new Set());

  // Alarm checker — polls every 10s, plays sound when reminder is due
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
            icon: <Bell className="h-4 w-4" />,
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

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Update datetime when defaultDate changes
  useEffect(() => {
    if (defaultDate) {
      const d = new Date(defaultDate);
      d.setHours(d.getHours() + 1, 0, 0, 0);
      setDatetime(formatAddDate(d));
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
    const date = datetime ? new Date(datetime) : new Date();
    onAdd(title, date);
    setText("");
    // Reset datetime to next hour
    const next = new Date();
    next.setHours(next.getHours() + 1, 0, 0, 0);
    setDatetime(formatAddDate(next));
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

      {onAdd && (
        <div className="mt-3 rounded-2xl bg-card/60 p-3 ring-1 ring-black/5 transition-colors focus-within:ring-2 focus-within:ring-primary/60 dark:ring-white/10">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder={t("add_reminder")}
              className="h-10 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              className="h-9 flex-1 rounded-xl bg-transparent px-2 text-sm outline-none ring-1 ring-black/5 focus:ring-2 focus:ring-primary/60 dark:ring-white/10"
            />
            <button
              onClick={submit}
              disabled={!text.trim()}
              className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {t("add")}
            </button>
          </div>
        </div>
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
