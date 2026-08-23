"use client";

import { useLang } from "@/lib/i18n";
import { Cloud } from "lucide-react";

interface Props {
  onSelect: (mode: "cloud") => void;
}

export function AIModeSelector({ onSelect }: Props) {
  const { t } = useLang();

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
          {t("ai_choose_title")}
        </h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          BEMUNNA uses cloud AI for the best experience.
        </p>
      </div>

      <button
        onClick={() => onSelect("cloud")}
        className="w-full rounded-2xl border-2 border-blue-400 bg-blue-50 p-6 text-left transition-all hover:border-blue-500 hover:shadow-lg dark:bg-blue-950"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900">
            <Cloud className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              BEMUNNA Cloud
            </h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
              Powerful AI that works through the internet. No installation needed.
            </p>
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                <span className="text-green-500">✓</span>
                <span>No installation required</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                <span className="text-green-500">✓</span>
                <span>Works on all devices</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                <span className="text-green-500">✓</span>
                <span>Best quality responses</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <span className="rounded-full bg-blue-600 px-6 py-2 text-sm font-medium text-white">
            {t("ai_cloud_start")}
          </span>
        </div>
      </button>
    </div>
  );
}
