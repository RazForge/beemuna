"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Reminder } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/lib/i18n";
import { toEthiopian, formatEthiopian } from "@/lib/ethiopian";
import { gregorianHolidaysForDate } from "@/lib/holidays";
import { toHijri, toArabicIndic, HIJRI_MONTHS_EN } from "@/lib/hijri";
import { faithMessage } from "@/lib/faith";
import { ReminderList } from "@/components/reminders/reminder-list";
import { motion } from "framer-motion";
import { BookHeart, Quote } from "lucide-react";

const fade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { t, locale } = useLang();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const religion = user?.religion ?? "christian";

  const remindersQuery = useQuery({
    queryKey: ["reminders"],
    queryFn: () => apiGet<Reminder[]>("/reminders"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      apiPatch<Reminder>(`/reminders/${id}`, { status: done ? "completed" : "scheduled" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-timeline"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/reminders/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
  });

  const eth = toEthiopian(now);
  const hijri = useMemo(() => toHijri(now), [now]);
  const faith = useMemo(() => faithMessage(now, religion), [now, religion]);
  const holidaysToday = useMemo(() => gregorianHolidaysForDate(now, religion), [now, religion]);

  const reminders = remindersQuery.data ?? [];

  const hour = now.getHours();
  const greeting =
    hour < 12 ? t("good_morning") : hour < 17 ? t("good_afternoon") : t("good_evening");
  const firstName = user?.name ? user.name.split(" ")[0] : "";

  const seconds = now.getSeconds();
  const minutes = now.getMinutes();
  const hours = now.getHours();
  const secondAngle = (seconds / 60) * 360;
  const minuteAngle = (minutes + seconds / 60) / 60 * 360;
  const hourAngle = ((hours % 12) + minutes / 60 + seconds / 3600) / 12 * 360;
  const clock = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const gregDate = now.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const secondaryDates = useMemo(() => {
    const ethLine = formatEthiopian(eth, "both", "geez").split("\n")[1] || "";
    if (religion === "muslim") {
      return [
        `${HIJRI_MONTHS_EN[hijri.month - 1]} ${toArabicIndic(hijri.day)}، ${toArabicIndic(hijri.year)}`,
      ];
    }
    if (religion === "other") {
      return [ethLine];
    }
    return [ethLine];
  }, [religion, eth, hijri]);

  const nextHoliday = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 0; i < 90; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const h = gregorianHolidaysForDate(d, religion);
      if (h.length > 0) return { date: d, holidays: h };
    }
    return null;
  }, [now, religion]);

  const pendingCount = reminders.filter((r) => r.status !== "completed").length;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      {/* Header — live time + dual dates */}
      <motion.header {...fade} className="flex flex-col items-center pt-6 text-center">
        <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </p>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="mt-4 flex items-center justify-center"
        >
          <div className="relative h-52 w-52 rounded-full border border-black/10 bg-[radial-gradient(circle,#ffffff,transparent_70%)] dark:border-white/10">
            {/* 12 hour ticks */}
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className="absolute inset-0" style={{ transform: `rotate(${i * 30}deg)` }}>
                <span className="absolute left-1/2 top-1 h-2.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground/60" />
              </span>
            ))}
            {/* Hour hand — pivot at center, points right at 0° */}
            <motion.div
              className="absolute left-1/2 top-1/2 h-0.5 w-14 rounded-full bg-foreground"
              style={{ transformOrigin: "0% 50%" }}
              animate={{ rotate: hourAngle }}
              transition={{ type: "spring", stiffness: 60, damping: 15 }}
            />
            {/* Minute hand */}
            <motion.div
              className="absolute left-1/2 top-1/2 h-0.5 w-20 rounded-full bg-foreground/80"
              style={{ transformOrigin: "0% 50%" }}
              animate={{ rotate: minuteAngle }}
              transition={{ type: "spring", stiffness: 120, damping: 15 }}
            />
            {/* Second hand */}
            <motion.div
              className="absolute left-1/2 top-1/2 h-px w-24 rounded-full bg-primary"
              style={{ transformOrigin: "0% 50%" }}
              animate={{ rotate: secondAngle }}
              transition={{ duration: 1, ease: "linear" }}
            />
            <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow" />
          </div>
        </motion.div>
        <p className="mt-5 text-[17px] font-medium text-muted-foreground">{gregDate}</p>
        {secondaryDates.map((line, i) =>
          line ? (
            <p key={i} className="mt-1 text-[15px] text-muted-foreground">
              {line}
            </p>
          ) : null,
        )}

        {holidaysToday.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {holidaysToday.map((h) => (
              <span
                key={h.nameAm}
                className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1.5 text-[13px] font-semibold text-warning"
              >
                <Quote className="h-3.5 w-3.5" />
                {h.nameAm} · {h.nameEn}
              </span>
            ))}
          </div>
        )}
        {!holidaysToday.length && nextHoliday && (
          <p className="mt-3 text-[13px] text-muted-foreground">
            {t("next")}: {nextHoliday.holidays[0].nameAm} ·{" "}
            {nextHoliday.date.toLocaleDateString(locale, { month: "long", day: "numeric" })}
          </p>
        )}
      </motion.header>

      {/* Faith widget — different verse + prayer/dua every day */}
      {faith && (
        <motion.section {...fade} transition={{ duration: 0.5, delay: 0.08 }}>
          <div className="apple-card relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <BookHeart className="h-4.5 w-4.5" />
                </div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-primary">
                  {religion === "christian"
                    ? t("verse_of_the_day")
                    : religion === "muslim"
                      ? t("ayah_of_the_day")
                      : t("quote_of_the_day")}
                </p>
              </div>
              <blockquote className="text-[19px] font-medium leading-relaxed tracking-[-0.01em]">
                &ldquo;{faith.verse}&rdquo;
              </blockquote>
              <p className="mt-3 text-[14px] font-semibold text-primary">{faith.reference}</p>
              <div className="mt-5 border-t border-black/5 pt-4 dark:border-white/10">
                <p className="text-[15px] font-bold text-foreground">
                  {religion === "christian"
                    ? t("todays_prayer")
                    : religion === "muslim"
                      ? t("todays_dua")
                      : t("todays_advice")}
                </p>
                <p className="mt-2 text-[15px] italic leading-relaxed text-muted-foreground">
                  {faith.message}
                </p>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* Main board — Apple Reminders */}
      <motion.section {...fade} transition={{ duration: 0.5, delay: 0.14 }}>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{t("reminders")}</h2>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[13px] font-semibold text-primary">
            {pendingCount}
          </span>
        </div>
        <ReminderList
          reminders={reminders}
          onToggle={(id, done) => toggleMutation.mutate({ id, done })}
          onDelete={(id) => deleteMutation.mutate(id)}
          emptyText={t("reminders_empty")}
        />
      </motion.section>
    </div>
  );
}