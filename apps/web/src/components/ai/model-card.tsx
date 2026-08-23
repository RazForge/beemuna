"use client";

import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Download, Check, Zap, Brain, Code, Star, Cpu, Cloud } from "lucide-react";
import type { ModelCatalogItem } from "@/lib/types";

const badgeIcons: Record<string, React.ReactNode> = {
  Lightweight: <Zap className="h-3 w-3" />,
  "Very Fast": <Zap className="h-3 w-3" />,
  Recommended: <Star className="h-3 w-3" />,
  Capable: <Brain className="h-3 w-3" />,
  Enhanced: <Brain className="h-3 w-3" />,
  Advanced: <Brain className="h-3 w-3" />,
  Coding: <Code className="h-3 w-3" />,
  Powerful: <Cpu className="h-3 w-3" />,
  Cloud: <Cloud className="h-3 w-3" />,
};

interface Props {
  model: ModelCatalogItem;
  selected?: boolean;
  onSelect?: (model: ModelCatalogItem) => void;
  onInstall?: (model: ModelCatalogItem) => void;
  onUse?: (model: ModelCatalogItem) => void;
  installing?: boolean;
}

export function ModelCard({ model, selected, onSelect, onInstall, onUse, installing }: Props) {
  const { t } = useLang();

  const badgeColor =
    model.category === "cloud"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
      : model.installed
        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
        : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400";

  return (
    <div
      onClick={() => onSelect?.(model)}
      className={cn(
        "relative cursor-pointer rounded-xl border-2 p-4 transition-all",
        selected
          ? "border-amber-500 bg-amber-50 shadow-md dark:border-amber-400 dark:bg-amber-950"
          : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm dark:border-stone-700 dark:bg-stone-800 dark:hover:border-stone-600"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-stone-900 dark:text-stone-100">
            {model.friendly_name}
          </h3>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            {model.description}
          </p>
        </div>
        <div className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", badgeColor)}>
          {badgeIcons[model.badge]}
          {t(`ai_badge_${model.badge.toLowerCase().replace(/ /g, "_")}` as any) || model.badge}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-stone-500 dark:text-stone-400">
          {model.size && <span>{model.size}</span>}
          {model.ram_mb > 0 && <span> · {model.ram_mb}MB RAM</span>}
        </div>

        {model.category === "cloud" ? (
          model.available ? (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> Available
            </span>
          ) : (
            <span className="text-xs text-stone-400">API key needed</span>
          )
        ) : model.installed ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUse?.(model);
            }}
            className="flex items-center gap-1 rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
          >
            <Check className="h-3 w-3" /> Use
          </button>
        ) : installing ? (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <Download className="h-3 w-3 animate-pulse" /> Installing...
          </span>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onInstall?.(model);
            }}
            className="flex items-center gap-1 rounded-full bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
          >
            <Download className="h-3 w-3" /> {t("ai_install")}
          </button>
        )}
      </div>
    </div>
  );
}
