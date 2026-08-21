"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { apiGet, apiPatch } from "@/lib/api";
import type { AISettings } from "@/lib/types";
import { ProviderStatusCard } from "@/components/ai/provider-status";
import { MemoryPanel } from "@/components/ai/memory-panel";

export default function AISettingsPage() {
  const { t } = useLang();
  const router = useRouter();
  const [settings, setSettings] = useState<AISettings | null>(null);

  useEffect(() => {
    apiGet<AISettings>("/ai/settings").then(setSettings).catch(() => {});
  }, []);

  const update = async (patch: Partial<AISettings>) => {
    if (!settings) return;
    try {
      const updated = await apiPatch<AISettings>("/ai/settings", patch);
      setSettings(updated);
    } catch {}
  };

  if (!settings) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-stone-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{t("ai_settings")}</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">{t("ai_settings_desc")}</p>
      </div>

      {/* Current AI Mode */}
      <section className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-stone-900 dark:text-stone-100">BEMUNNA Cloud</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Cloud AI is always active. No setup required.
            </p>
          </div>
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
            Active
          </span>
        </div>
      </section>

      {/* Toggles */}
      <section className="space-y-3">
        {[
          { key: "ai_memory_enabled" as const, label: t("ai_memory_enabled"), desc: t("ai_memory_enabled_desc") },
          { key: "ai_journal_context" as const, label: t("ai_journal_context"), desc: t("ai_journal_context_desc") },
          { key: "ai_save_new_memories" as const, label: t("ai_save_new_memories"), desc: t("ai_save_new_memories_desc") },
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800">
            <div>
              <p className="font-medium text-stone-900 dark:text-stone-100">{label}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">{desc}</p>
            </div>
            <button
              onClick={() => update({ [key]: !settings[key] })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings[key] ? "bg-amber-600" : "bg-stone-300 dark:bg-stone-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings[key] ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        ))}
      </section>

      <ProviderStatusCard />

      <section className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800">
        <MemoryPanel />
      </section>

      <button
        onClick={() => router.push("/ai")}
        className="w-full rounded-lg border border-stone-200 bg-white py-3 text-sm font-medium text-stone-900 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700"
      >
        ← Back to AI Chat
      </button>
    </div>
  );
}
