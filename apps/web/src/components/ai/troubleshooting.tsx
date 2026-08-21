"use client";

import { useLang } from "@/lib/i18n";

export function Troubleshooting() {
  const { t } = useLang();

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800">
      <h3 className="mb-3 font-medium text-stone-900 dark:text-stone-100">
        {t("ai_troubleshooting")}
      </h3>
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <span className="text-green-600">✓</span>
          <div>
            <p className="font-medium text-stone-800 dark:text-stone-200">BEMUNNA Cloud</p>
            <p className="text-stone-500 dark:text-stone-400">Connected and ready</p>
          </div>
        </div>
      </div>
    </div>
  );
}
