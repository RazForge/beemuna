"use client";

import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const modes = ["assistant", "research", "journal", "planner"] as const;

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function ModeIndicator({ value, onChange }: Props) {
  const { t } = useLang();

  return (
    <div className="flex gap-1 rounded-lg bg-stone-100 p-1 dark:bg-stone-800">
      {modes.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === m
              ? "bg-white text-stone-900 shadow dark:bg-stone-700 dark:text-stone-100"
              : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          )}
        >
          {t(`ai_mode_${m}`)}
        </button>
      ))}
    </div>
  );
}
