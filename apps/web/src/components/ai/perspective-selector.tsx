"use client";

import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const perspectives = [
  { value: "christian", icon: "✝️", label: "ai_perspective_christian" },
  { value: "muslim", icon: "☪️", label: "ai_perspective_muslim" },
  { value: "jewish", icon: "✡️", label: "ai_perspective_jewish" },
  { value: "hindu", icon: "🕉️", label: "ai_perspective_hindu" },
  { value: "buddhist", icon: "☸️", label: "ai_perspective_buddhist" },
  { value: "secular", icon: "🔬", label: "ai_perspective_secular" },
  { value: "neutral", icon: "⚖️", label: "ai_perspective_neutral" },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function PerspectiveSelector({ value, onChange }: Props) {
  const { t } = useLang();

  return (
    <div className="grid grid-cols-4 gap-2">
      {perspectives.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-colors",
            value === p.value
              ? "border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100"
              : "border-stone-200 bg-white hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-stone-600"
          )}
        >
          <span className="text-xl">{p.icon}</span>
          <span className="font-medium">{t(p.label)}</span>
        </button>
      ))}
    </div>
  );
}
