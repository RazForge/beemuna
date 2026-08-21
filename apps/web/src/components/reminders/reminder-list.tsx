"use client";

import { useState } from "react";
import { Check, Plus, Trash2, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import type { Reminder } from "@/lib/types";

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
  const [showDate, setShowDate] = useState(false);
  const [dateValue, setDateValue] = useState("");

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
    let date = defaultDate ?? today;
    if (showDate && dateValue) {
      date = new Date(dateValue);
    } else if (!showDate) {
      date = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0);
    }
    onAdd(title, date);
    setText("");
    setDateValue("");
    setShowDate(false);
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
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-card/60 px-3 ring-1 ring-black/5 transition-colors focus-within:ring-2 focus-within:ring-primary/60 dark:ring-white/10">
          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={t("add_reminder")}
            className="h-11 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
          />
          <button
            onClick={() => setShowDate(!showDate)}
            className={cn(
              "rounded-full p-1.5 transition-colors",
              showDate ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
            title={t("reminder_placeholder")}
          >
            <CalendarClock className="h-4 w-4" />
          </button>
        </div>
      )}

      {onAdd && showDate && (
        <div className="mt-2 flex items-center gap-2 px-1">
          <input
            type="datetime-local"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="h-10 flex-1 rounded-xl bg-card/60 px-3 text-sm outline-none ring-1 ring-black/5 focus:ring-2 focus:ring-primary/60 dark:ring-white/10"
          />
          <button
            onClick={submit}
            className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            {t("add")}
          </button>
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
          done ? "text-muted-foreground line-through" : "text-foreground",
        )}
      >
        {reminder.title}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
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
