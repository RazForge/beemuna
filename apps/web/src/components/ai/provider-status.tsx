"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/lib/i18n";
import { apiGet, getToken } from "@/lib/api";
import type { ProviderStatus } from "@/lib/types";

export function ProviderStatusCard() {
  const { t } = useLang();
  const [status, setStatus] = useState<ProviderStatus | null>(null);

  useEffect(() => {
    if (!getToken()) return;
    apiGet<ProviderStatus>("/ai/providers").then(setStatus).catch(() => {});
  }, []);

  if (!status) return null;

  const getModelDisplayName = (model: string): string => {
    const modelMap: Record<string, string> = {
      "meta/llama-3.1-8b-instruct": "BEMUNNA Cloud",
      "meta/llama-3.1-70b-instruct": "BEMUNNA Cloud Pro",
    };
    return modelMap[model] || "BEMUNNA Cloud";
  };

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800">
      <h3 className="mb-3 font-medium text-stone-900 dark:text-stone-100">
        {t("ai_provider_status")}
      </h3>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-stone-600 dark:text-stone-400">Provider</span>
          <span className="font-medium text-stone-900 dark:text-stone-100">
            BEMUNNA Cloud
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-600 dark:text-stone-400">Model</span>
          <span className="font-medium text-stone-900 dark:text-stone-100">
            {getModelDisplayName(status.model)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-600 dark:text-stone-400">Status</span>
          <span className="text-green-600">
            {status.ollama_available || status.nvidia_configured ? "Connected" : "Checking..."}
          </span>
        </div>
      </div>
    </div>
  );
}
