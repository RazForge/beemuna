"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { apiGet, apiPatch } from "@/lib/api";
import type { AISettings } from "@/lib/types";
import { ProviderStatusCard } from "@/components/ai/provider-status";
import { ArrowLeft } from "lucide-react";

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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("ai_settings")}</h1>
        <p className="text-sm text-muted-foreground">{t("ai_settings_desc")}</p>
      </div>

      <ProviderStatusCard />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Preferences</h2>
        {[
          { key: "ai_memory_enabled" as const, label: t("ai_memory_enabled"), desc: t("ai_memory_enabled_desc") },
          { key: "ai_journal_context" as const, label: t("ai_journal_context"), desc: t("ai_journal_context_desc") },
          { key: "ai_save_new_memories" as const, label: t("ai_save_new_memories"), desc: t("ai_save_new_memories_desc") },
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <button
              onClick={() => update({ [key]: !settings[key] })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings[key] ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                  settings[key] ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        ))}
      </section>

      <button
        onClick={() => router.push("/ai")}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to AI Chat
      </button>
    </div>
  );
}
