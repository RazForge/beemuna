"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { apiGet, getToken } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ProviderStatus {
  active_provider: string;
  primary_model: string;
  reasoning_model: string;
  fallback_model: string;
  multimodal_model: string;
  gemini_configured: boolean;
  nvidia_configured: boolean;
  ollama_configured: boolean;
  ollama_available: boolean;
  fallback_chain: string;
}

export function ProviderStatusCard() {
  const { t } = useLang();
  const [status, setStatus] = useState<ProviderStatus | null>(null);

  useEffect(() => {
    if (!getToken()) return;
    apiGet<ProviderStatus>("/ai/providers").then(setStatus).catch(() => {});
  }, []);

  const isActive = status?.gemini_configured || status?.nvidia_configured;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Beemuna AI</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {status?.fallback_chain || "Initializing..."}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            isActive
              ? "bg-success/10 text-success"
              : "bg-muted text-muted-foreground",
          )}
        >
          {isActive ? "Active" : "Offline"}
        </span>
      </div>
    </div>
  );
}
