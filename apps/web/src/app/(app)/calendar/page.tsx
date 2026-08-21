"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Reminder } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/lib/i18n";
import { toEthiopian, toGeez, toGregorian, ETHIOPIAN_MONTHS_AM } from "@/lib/ethiopian";
import { ethiopianHolidaysForDate } from "@/lib/holidays";
import { hijriHolidaysForDate, toHijri, hijriToGregorian, HIJRI_MONTHS_EN, toArabicIndic } from "@/lib/hijri";
import {
  CalendarGrid,
  monthLabel,
  type CalendarMode,
  type DayCell,
} from "@/components/calendar/calendar-grid";
import { ReminderList } from "@/components/reminders/reminder-list";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { t, locale, lang } = useLang();
  const queryClient = useQueryClient();
  const religion = user?.religion ?? "christian";

  const today = useMemo(() => new Date(), []);
  const todayEth = toEthiopian(today);
  const todayHijri = useMemo(() => toHijri(today), [today]);

  const isMuslim = religion === "muslim";
  const modes: CalendarMode[] = isMuslim ? ["islamic", "ethiopian"] : ["ethiopian", "gregorian"];

  const [mode, setMode] = useState<CalendarMode>(isMuslim ? "islamic" : "ethiopian");
  const [view, setView] = useState(() =>
    isMuslim
      ? { year: todayHijri.year, month: todayHijri.month }
      : { year: todayEth.year, month: todayEth.month },
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(() =>
    isMuslim
      ? `i-${todayHijri.year}-${todayHijri.month}-${todayHijri.day}`
      : `e-${todayEth.year}-${todayEth.month}-${todayEth.day}`,
  );

  const remindersQuery = useQuery({
    queryKey: ["reminders"],
    queryFn: () => apiGet<Reminder[]>("/reminders"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      apiPatch<Reminder>(`/reminders/${id}`, { status: done ? "completed" : "scheduled" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/reminders/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
  });

  const addMutation = useMutation({
    mutationFn: ({ title, date }: { title: string; date: Date }) =>
      apiPost<Reminder>("/reminders", {
        type: "reminder",
        title,
        scheduled_at: date.toISOString(),
        timezone: user?.timezone || "Africa/Addis_Ababa",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
  });

  const reminders = remindersQuery.data ?? [];
  const reminderCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reminders) {
      if (r.status === "completed") continue;
      const d = new Date(r.scheduled_at);
      const gKey = `g-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      map.set(gKey, (map.get(gKey) ?? 0) + 1);
      const eth = toEthiopian(d);
      const eKey = `e-${eth.year}-${eth.month}-${eth.day}`;
      map.set(eKey, (map.get(eKey) ?? 0) + 1);
      const h = toHijri(d);
      const iKey = `i-${h.year}-${h.month}-${h.day}`;
      map.set(iKey, (map.get(iKey) ?? 0) + 1);
    }
    return map;
  }, [reminders]);

  const selectedDay = useMemo(() => {
    if (!selectedKey) return null;
    const parts = selectedKey.split("-");
    if (parts[0] === "g") {
      const [, y, m, d] = parts.map(Number);
      return new Date(y, m - 1, d);
    }
    if (parts[0] === "e") {
      const [, y, m, d] = parts.map(Number);
      return toGregorian({ year: y, month: m, day: d });
    }
    if (parts[0] === "i") {
      const [, y, m, d] = parts.map(Number);
      return hijriToGregorian(y, m, d);
    }
    return null;
  }, [selectedKey]);

  function selectDay(cell: DayCell) {
    setSelectedKey(cell.key);
  }

  function navigate(dir: 1 | -1) {
    setView((v) => {
      const maxMonth = mode === "ethiopian" ? 13 : 12;
      let month = v.month + dir;
      let year = v.year;
      if (month < 1) {
        month = maxMonth;
        year -= 1;
      } else if (month > maxMonth) {
        month = 1;
        year += 1;
      }
      return { year, month };
    });
  }

  function jumpToday() {
    if (mode === "ethiopian") {
      setView({ year: todayEth.year, month: todayEth.month });
      setSelectedKey(`e-${todayEth.year}-${todayEth.month}-${todayEth.day}`);
    } else if (mode === "islamic") {
      setView({ year: todayHijri.year, month: todayHijri.month });
      setSelectedKey(`i-${todayHijri.year}-${todayHijri.month}-${todayHijri.day}`);
    } else {
      setView({ year: today.getFullYear(), month: today.getMonth() + 1 });
      setSelectedKey(`g-${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`);
    }
  }

  function switchMode(m: CalendarMode) {
    setMode(m);
    if (m === "ethiopian") {
      const eth = toEthiopian(new Date());
      setView({ year: eth.year, month: eth.month });
    } else if (m === "islamic") {
      const h = toHijri(new Date());
      setView({ year: h.year, month: h.month });
    } else {
      const n = new Date();
      setView({ year: n.getFullYear(), month: n.getMonth() + 1 });
    }
  }

  const dayReminders = useMemo(() => {
    if (!selectedDay) return [];
    const d0 = startOfDay(selectedDay);
    return reminders.filter((r) => {
      const d = startOfDay(new Date(r.scheduled_at));
      return d.getTime() === d0.getTime();
    });
  }, [reminders, selectedDay]);

  const selectedEth = selectedDay ? toEthiopian(selectedDay) : null;
  const selectedHolidays = useMemo(() => {
    if (!selectedEth) return [];
    if (mode === "islamic") {
      const parts = selectedKey?.split("-") ?? [];
      if (parts[0] === "i") {
        const [, y, m, d] = parts.map(Number);
        return hijriHolidaysForDate({ year: y, month: m, day: d });
      }
    }
    return ethiopianHolidaysForDate(selectedEth, religion);
  }, [selectedEth, selectedKey, mode, religion]);

  const monthHolidays = useMemo(() => {
    const seen = new Set<string>();
    const out: { nameAm: string; nameEn: string; day: number }[] = [];
    if (mode === "ethiopian") {
      const maxDay = view.month === 13 ? 6 : 30;
      for (let d = 1; d <= maxDay; d++) {
        const eth = { year: view.year, month: view.month, day: d };
        for (const h of ethiopianHolidaysForDate(eth, religion)) {
          const k = `${h.nameAm}-${d}`;
          if (!seen.has(k)) {
            seen.add(k);
            out.push({ ...h, day: d });
          }
        }
      }
    } else if (mode === "islamic") {
      const start = hijriToGregorian(view.year, view.month, 1);
      if (start) {
        for (let d = 1; d <= 30; d++) {
          const h = { year: view.year, month: view.month, day: d };
          const dayHolidays = hijriHolidaysForDate(h);
          for (const hd of dayHolidays) {
            const k = `${hd.nameAm}-${d}`;
            if (!seen.has(k)) {
              seen.add(k);
              out.push({ nameAm: hd.nameAm, nameEn: hd.nameEn, day: d });
            }
          }
        }
      }
    } else {
      const maxDay = new Date(view.year, view.month, 0).getDate();
      for (let d = 1; d <= maxDay; d++) {
        const eth = toEthiopian(new Date(view.year, view.month - 1, d));
        for (const h of ethiopianHolidaysForDate(eth, religion)) {
          const k = `${h.nameAm}-${d}`;
          if (!seen.has(k)) {
            seen.add(k);
            out.push({ ...h, day: d });
          }
        }
      }
    }
    return out.sort((a, b) => a.day - b.day);
  }, [mode, view, religion]);

  const modeLabels: Record<CalendarMode, string> = {
    ethiopian: t("ethiopian"),
    gregorian: "Gregorian",
    islamic: "الهجري",
  };

  const modeCaptions: Record<CalendarMode, string> = {
    ethiopian: t("ethiopian_calendar"),
    gregorian: t("gregorian_calendar"),
    islamic: t("islamic_calendar"),
  };

  const todayKey =
    mode === "ethiopian"
      ? `e-${todayEth.year}-${todayEth.month}-${todayEth.day}`
      : mode === "islamic"
        ? `i-${todayHijri.year}-${todayHijri.month}-${todayHijri.day}`
        : `g-${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Header */}
      <header className="glass rounded-[28px] p-7 flex flex-wrap items-center justify-between gap-4 shadow-xl border-white/20 dark:border-white/5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-br from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
            {t("calendar_title")}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm font-medium">
            {isMuslim ? t("calendar_subtitle_islamic") : t("calendar_subtitle_dual")}
          </p>
        </div>
        <div className="glass inline-flex rounded-full p-1 border-white/30 dark:border-white/10 shadow-sm">
          {modes.map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
                mode === m ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {modeLabels[m]}
            </button>
          ))}
        </div>
      </header>

      {/* Month card */}
      <div className="apple-card p-6">
        <div className="mb-5 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-[19px] font-semibold tracking-[-0.01em]">
              {monthLabel(mode, view.year, view.month)}
            </p>
            <p className="text-[13px] text-muted-foreground">{modeCaptions[mode]}</p>
          </div>
          <button
            onClick={() => navigate(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <CalendarGrid
          mode={mode}
          year={view.year}
          month={view.month}
          selectedKey={selectedKey}
          onSelectDay={selectDay}
          todayKey={todayKey}
          reminderCounts={reminderCounts}
          religion={religion}
          locale={locale}
          lang={lang}
        />

        <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-4 dark:border-white/10">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" /> {t("holiday")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" /> {t("reminder_dot")}
            </span>
          </div>
          <button
            onClick={jumpToday}
            className="rounded-full bg-primary/10 px-3.5 py-1.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            {t("today")}
          </button>
        </div>
      </div>

      {/* Holidays this month */}
      {monthHolidays.length > 0 && (
        <div className="apple-card p-5">
          <h2 className="mb-3 text-[15px] font-semibold">
          {lang === "am" ? "በዓላት የዚህ ወር" : "Holidays this month"}
        </h2>
          <div className="flex flex-col gap-1.5">
            {monthHolidays.map((h, i) => (
              <div key={`${h.nameAm}-${i}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-[13px] font-bold text-warning">
                  {mode === "islamic" ? toArabicIndic(h.day) : toGeez(h.day)}
                </span>
                <span className="text-[14px]">{h.nameAm}</span>
                <span className="ml-auto text-[13px] text-muted-foreground">{h.nameEn}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected day */}
      {selectedDay && selectedEth && (
        <div className="apple-card p-6">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[19px] font-semibold">
              {selectedDay.toLocaleDateString(locale, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h2>
            <span className="text-[15px] text-muted-foreground">
              {mode === "islamic" && selectedKey?.startsWith("i-") ? (
                <>
                  {HIJRI_MONTHS_EN[Number(selectedKey.split("-")[2]) - 1]}{" "}
                  {toArabicIndic(Number(selectedKey.split("-")[3]))}،{" "}
                  {toArabicIndic(Number(selectedKey.split("-")[1]))}
                </>
              ) : (
                <>
                  {ETHIOPIAN_MONTHS_AM[selectedEth.month - 1]} {toGeez(selectedEth.day)}፣{" "}
                  {toGeez(selectedEth.year)}
                </>
              )}
            </span>
          </div>
          {selectedHolidays.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedHolidays.map((h) => (
                <span
                  key={h.nameAm}
                  className="rounded-full bg-warning/15 px-3 py-1 text-[13px] font-semibold text-warning"
                >
                  {h.nameAm} · {h.nameEn}
                </span>
              ))}
            </div>
          )}
          <ReminderList
            reminders={dayReminders}
            onToggle={(id, done) => toggleMutation.mutate({ id, done })}
            onDelete={(id) => deleteMutation.mutate(id)}
            onAdd={(title, date) => addMutation.mutate({ title, date })}
            defaultDate={startOfDay(selectedDay)}
            emptyText={t("nothing_scheduled")}
          />
        </div>
      )}
    </div>
  );
}