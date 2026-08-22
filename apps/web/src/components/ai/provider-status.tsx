"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { apiGet, apiPatch, getToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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

const GATEWAY_MODELS = [
  {
    id: "gemini-3.1-flash-lite",
    name: "BEEMUNA Core",
    model: "Gemini 3.1 Flash-Lite",
    role: "PRIMARY",
    desc: "Daily coaching, tasks, goals, achievements, high-volume requests",
    color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  {
    id: "gemini-2.5-flash",
    name: "BEEMUNA Reasoning",
    model: "Gemini 2.5 Flash",
    role: "REASONING",
    desc: "Deep goal analysis, habit patterns, complex planning, 1M context",
    color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-300",
    dot: "bg-indigo-500",
  },
  {
    id: "glm-5.2",
    name: "BEEMUNA Fallback",
    model: "GLM-5.2",
    role: "FALLBACK",
    desc: "NVIDIA fallback when Gemini unavailable, coding, agentic tasks",
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  {
    id: "nemotron-3-nano-omni-30b-a3b-reasoning",
    name: "BEEMUNA Multimodal",
    model: "Nemotron 3 Nano Omni",
    role: "MULTIMODAL",
    desc: "Image, audio, video, document understanding, transcription",
    color: "text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-300",
    dot: "bg-purple-500",
  },
];

export function ProviderStatusCard() {
  const { t } = useLang();
  const [status, setStatus] = useState<ProviderStatus | null>(null);

  useEffect(() => {
    if (!getToken()) return;
    apiGet<ProviderStatus>("/ai/providers").then(setStatus).catch(() => {});
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{t("ai_provider_status")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {status?.fallback_chain || "Initializing gateway..."}
          </p>
        </div>
        <div className="flex gap-1.5">
          <span className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            status?.gemini_configured
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              : "bg-muted text-muted-foreground"
          )}>
            {status?.gemini_configured ? "Gemini Active" : "Gemini Offline"}
          </span>
          {status?.nvidia_configured && (
            <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              NVIDIA Ready
            </span>
          )}
        </div>
      </div>

      {/* Gateway Models */}
      <div className="space-y-2 mb-4">
        {GATEWAY_MODELS.map((g) => (
          <div
            key={g.id}
            className="rounded-xl border border-border p-3 hover:border-primary/20 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full", g.dot)} />
                <div>
                  <span className="text-sm font-semibold">{g.name}</span>
                  <p className="text-[11px] text-muted-foreground">{g.model}</p>
                </div>
              </div>
              <Badge className={cn("text-[10px] font-bold border-0", g.color)}>
                {g.role}
              </Badge>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">{g.desc}</p>
          </div>
        ))}
      </div>

      {/* Model assignments from backend */}
      {(status?.primary_model || status?.fallback_model) && (
        <div className="grid grid-cols-2 gap-2 text-xs border-t border-border pt-3">
          <div>
            <p className="text-muted-foreground">Primary</p>
            <p className="font-medium truncate">{status?.primary_model}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Reasoning</p>
            <p className="font-medium truncate">{status?.reasoning_model}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fallback</p>
            <p className="font-medium truncate">{status?.fallback_model}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Multimodal</p>
            <p className="font-medium truncate">{status?.multimodal_model}</p>
          </div>
        </div>
      )}
    </div>
  );
}
