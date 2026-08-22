"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { apiGet, apiPatch, getToken } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ProviderStatus {
  provider: string;
  model: string;
  ollama_available: boolean;
  nvidia_configured: boolean;
}

const MODELS = [
  { id: "meta/llama-3.1-8b-instruct", name: "BEMUNNA Cloud", desc: "Fast, efficient, great for everyday tasks" },
  { id: "meta/llama-3.1-70b-instruct", name: "BEMUNNA Cloud Pro", desc: "Advanced reasoning, complex analysis" },
  { id: "meta/llama-3.3-70b-instruct", name: "BEMUNNA Cloud Ultra", desc: "Latest model, best performance" },
];

export function ProviderStatusCard() {
  const { t } = useLang();
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [activeModel, setActiveModel] = useState<string>("");

  useEffect(() => {
    if (!getToken()) return;
    apiGet<ProviderStatus>("/ai/providers").then((s) => {
      setStatus(s);
      setActiveModel(s.model);
    }).catch(() => {});
  }, []);

  const handleModelChange = async (modelId: string) => {
    try {
      await apiPatch("/ai/settings", { ai_cloud_model: modelId });
      setActiveModel(modelId);
    } catch {}
  };

  const isConfigured = status?.nvidia_configured;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">{t("ai_provider_status")}</h3>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            isConfigured
              ? "bg-success/10 text-success"
              : "bg-muted text-muted-foreground",
          )}
        >
          {isConfigured ? "Connected" : "Checking..."}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Provider</span>
          <span className="font-medium">BEMUNNA Cloud</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Status</span>
          <span className={cn("font-medium", isConfigured ? "text-success" : "text-muted-foreground")}>
            {isConfigured ? "Active" : "Checking..."}
          </span>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Available Models
        </p>
        <div className="space-y-2">
          {MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => handleModelChange(model.id)}
              className={cn(
                "w-full rounded-xl border p-3 text-left transition-all",
                activeModel === model.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/30 hover:bg-muted/50",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{model.name}</span>
                {activeModel === model.id && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{model.desc}</p>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Cloud AI is always active. No setup required.
        </p>
      </div>
    </div>
  );
}
