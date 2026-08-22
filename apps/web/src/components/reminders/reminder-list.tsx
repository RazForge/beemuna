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
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowSheet(false)}
          />
          {/* Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-card p-6 pb-10 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in slide-in-from-bottom duration-300">
            {/* Handle */}
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-muted-foreground/30" />

            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && text.trim()) submit();
              }}
              placeholder="Reminder title"
              className="mb-4 h-12 w-full rounded-2xl bg-muted px-4 text-[17px] font-medium outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/40"
            />

            {/* Quick time shortcuts */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick</p>
            <div className="mb-4 flex flex-wrap gap-2">
              <AppleTimeButton label="In 30 min" active={pickedDate.getTime() === quickTime(0).getTime() + 30 * 60000} onClick={() => { const d = new Date(); d.setMinutes(d.getMinutes() + 30); setPickedDate(d); }} />
              <AppleTimeButton label="In 1 hr" active={false} onClick={() => setPickedDate(quickTime(1))} />
              <AppleTimeButton label="In 2 hr" active={false} onClick={() => setPickedDate(quickTime(2))} />
              <AppleTimeButton label="Tomorrow 9am" active={false} onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); setPickedDate(d); }} />
            </div>

            {/* Custom datetime */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custom</p>
            <input
              type="datetime-local"
              value={toInputValue(pickedDate)}
              onChange={(e) => setPickedDate(new Date(e.target.value))}
              className="mb-5 h-12 w-full rounded-2xl bg-muted px-4 text-sm outline-none ring-1 ring-black/5 focus:ring-2 focus:ring-primary/40 dark:ring-white/10"
            />

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
