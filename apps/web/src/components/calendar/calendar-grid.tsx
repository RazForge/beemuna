"use client";

import { useMemo } from "react";
import {
  type EthiopianDate,
  ETHIOPIAN_MONTHS_AM,
  isEthiopianLeap,
  toEthiopian,
  toGeez,
  toGregorian,
} from "@/lib/ethiopian";
import { ethiopianHolidaysForDate, type Religion } from "@/lib/holidays";
import {
  type HijriDate,
  HIJRI_MONTHS_EN,
  toArabicIndic,
  toHijri,
  hijriToGregorian,
  hijriMonthLength,
  hijriHolidaysForDate,
} from "@/lib/hijri";
import { cn } from "@/lib/utils";

export type CalendarMode = "ethiopian" | "gregorian" | "islamic";

export const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
export const WEEKDAY_LABELS_AM = ["እ", "ሰ", "ማ", "ረ", "ሐ", "ዓ", "ቅ"];

export interface DayCell {
  key: string;
  day: number;
  date: Date;
  eth: EthiopianDate;
  hijri: HijriDate | null;
  holidays: { nameAm: string; nameEn: string }[];
  reminders: number;
  isToday: boolean;
}

interface CalendarGridProps {
  mode: CalendarMode;
  year: number;
  month: number; // 1..12 Gregorian, 1..13 Ethiopian (13 = Pagumen), 1..12 Islamic
  selectedKey: string | null;
  onSelectDay: (cell: DayCell) => void;
  todayKey: string;
  reminderCounts?: Map<string, number>;
  religion?: Religion;
  compact?: boolean;
  locale?: string;
  lang?: string;
}

function dayKey(mode: CalendarMode, year: number, month: number, day: number): string {
  return `${mode[0]}-${year}-${month}-${day}`;
}

function pad(day: number): DayCell {
  return {
    key: `pad-${day}`,
    day: 0,
    date: new Date(0),
    eth: { year: 0, month: 0, day: 0 },
    hijri: null,
    holidays: [],
    reminders: 0,
    isToday: false,
  };
}

export function buildMonthCells(
  mode: CalendarMode,
  year: number,
  month: number,
  reminderCounts: Map<string, number>,
  todayKey: string,
  religion: Religion = "christian",
): DayCell[] {
  const cells: DayCell[] = [];
  if (mode === "ethiopian") {
    const isPagumen = month === 13;
    const maxDay = isPagumen ? 5 + (isEthiopianLeap(year) ? 1 : 0) : 30;
    const firstOffset = toGregorian({ year, month, day: 1 }).getDay();
    for (let i = 0; i < firstOffset; i++) cells.push(pad(i));
    for (let day = 1; day <= maxDay; day++) {
      const eth = { year, month, day };
      const date = toGregorian(eth);
      const key = dayKey("ethiopian", year, month, day);
      cells.push({
        key,
        day,
        date,
        eth,
        hijri: toHijri(date),
        holidays: ethiopianHolidaysForDate(eth, religion),
        reminders: reminderCounts.get(key) ?? 0,
        isToday: key === todayKey,
      });
    }
  } else if (mode === "gregorian") {
    const maxDay = new Date(year, month, 0).getDate();
    const firstOffset = new Date(year, month - 1, 1).getDay();
    for (let i = 0; i < firstOffset; i++) cells.push(pad(i));
    for (let day = 1; day <= maxDay; day++) {
      const date = new Date(year, month - 1, day);
      const eth = toEthiopian(date);
      const key = dayKey("gregorian", year, month, day);
      cells.push({
        key,
        day,
        date,
        eth,
        hijri: toHijri(date),
        holidays: ethiopianHolidaysForDate(eth, religion),
        reminders: reminderCounts.get(key) ?? 0,
        isToday: key === todayKey,
      });
    }
  } else {
    const start = hijriToGregorian(year, month, 1);
    if (!start) return cells;
    const maxDay = hijriMonthLength(year, month);
    const firstOffset = start.getDay();
    for (let i = 0; i < firstOffset; i++) cells.push(pad(i));
    for (let day = 1; day <= maxDay; day++) {
      const date = new Date(start.getTime() + (day - 1) * 86400000);
      const eth = toEthiopian(date);
      const key = dayKey("islamic", year, month, day);
      cells.push({
        key,
        day,
        date,
        eth,
        hijri: { year, month, day },
        holidays: hijriHolidaysForDate({ year, month, day }),
        reminders: reminderCounts.get(`g-${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`) ?? 0,
        isToday: key === todayKey,
      });
    }
  }
  return cells;
}

export function monthLabel(
  mode: CalendarMode,
  year: number,
  month: number,
  locale = "en-US",
): string {
  if (mode === "ethiopian") {
    const am = ETHIOPIAN_MONTHS_AM[month - 1];
    const yearGeez = toGeez(year) || "፩";
    return `${am} ${yearGeez}`;
  }
  if (mode === "islamic") {
    return `${HIJRI_MONTHS_EN[month - 1]} ${toArabicIndic(year)}`;
  }
  return `${new Date(year, month - 1, 1).toLocaleDateString(locale, { month: "long" })} ${year}`;
}

export function CalendarGrid({
  mode,
  year,
  month,
  selectedKey,
  onSelectDay,
  todayKey,
  reminderCounts = new Map(),
  religion = "christian",
  compact = false,
  locale = "en-US",
  lang = "en",
}: CalendarGridProps) {
  const cells = useMemo(
    () => buildMonthCells(mode, year, month, reminderCounts, todayKey, religion),
    [mode, year, month, reminderCounts, todayKey, religion],
  );
  const weekdays = lang === "am" ? WEEKDAY_LABELS_AM : WEEKDAY_LABELS;

  return (
    <div>
      <div className={cn("grid grid-cols-7", compact ? "gap-0.5" : "gap-1")}>
        {weekdays.map((w, i) => (
          <div
            key={i}
            className={cn(
              "text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
              compact ? "py-1" : "py-2",
            )}
          >
            {w}
          </div>
        ))}
        {cells.map((cell) => {
          if (cell.day === 0) return <div key={cell.key} className={compact ? "h-9" : "h-12"} />;
          const selected = cell.key === selectedKey;
          const hasHoliday = cell.holidays.length > 0;
          const label =
            mode === "ethiopian"
              ? toGeez(cell.day) || "፩"
              : mode === "islamic"
                ? toArabicIndic(cell.day)
                : cell.day;
          return (
            <button
              key={cell.key}
              onClick={() => onSelectDay(cell)}
              title={
                hasHoliday
                  ? cell.holidays.map((h) => h.nameAm).join(", ")
                  : cell.date.toDateString()
              }
              className={cn(
                "relative flex items-center justify-center rounded-full transition-all",
                compact ? "h-9 text-[13px]" : "h-12 text-[15px]",
                selected
                  ? "bg-primary font-semibold text-primary-foreground shadow-[0_4px_14px_rgba(0,0,0,0.25)]"
                  : cell.isToday
                    ? "bg-primary/15 font-semibold text-primary"
                    : "hover:bg-black/5 dark:hover:bg-white/10",
              )}
            >
              {label}
              {hasHoliday && (
                <span
                  className={cn(
                    "absolute rounded-full bg-warning",
                    compact ? "bottom-1 h-1 w-1" : "bottom-1.5 h-1.5 w-1.5",
                    selected && "bg-primary-foreground",
                  )}
                />
              )}
              {!hasHoliday && cell.reminders > 0 && (
                <span
                  className={cn(
                    "absolute rounded-full bg-primary/60",
                    compact ? "bottom-1 h-1 w-1" : "bottom-1.5 h-1.5 w-1.5",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}