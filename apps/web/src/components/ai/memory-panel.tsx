"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/lib/i18n";
import { apiGet, apiPost, apiDelete, getToken } from "@/lib/api";
import type { AIMemory } from "@/lib/types";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function MemoryPanel() {
  const { t } = useLang();
  const [memories, setMemories] = useState<AIMemory[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("fact");
  const [importance, setImportance] = useState(0.5);

  useEffect(() => {
    if (!getToken()) return;
    apiGet<AIMemory[]>("/ai/memories").then(setMemories).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!content.trim()) return;
    try {
      const m = await apiPost<AIMemory>("/ai/memories", { content, category, importance, tags: [] });
      setMemories((prev) => [m, ...prev]);
      setContent("");
      setShowForm(false);
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(`/ai/memories/${id}`);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch {}
  };

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <h3 className="font-medium">{t("ai_memory_panel")}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{memories.length} memories</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              {showForm ? t("ai_memory_cancel") : t("ai_memory_create")}
            </button>
          </div>

          {showForm && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t("ai_memory_content")}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-ring"
                rows={3}
              />
              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-xl border border-input bg-background px-3 py-1.5 text-sm"
                >
                  <option value="fact">{t("ai_memory_category_fact")}</option>
                  <option value="preference">{t("ai_memory_category_preference")}</option>
                  <option value="goal">{t("ai_memory_category_goal")}</option>
                  <option value="context">{t("ai_memory_category_context")}</option>
                </select>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={importance}
                  onChange={(e) => setImportance(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <button
                  onClick={handleCreate}
                  className="rounded-xl bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  {t("ai_memory_save")}
                </button>
              </div>
            </div>
          )}

          {memories.length === 0 && !showForm && (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("ai_memory_empty")}</p>
          )}

          <div className="space-y-1.5">
            {memories.map((m) => (
              <div
                key={m.id}
                className="group flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{m.content}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t(`ai_memory_category_${m.category}`)} · {m.created_at.slice(0, 10)}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="ml-2 h-7 w-7 shrink-0 items-center justify-center rounded-full text-destructive opacity-0 hover:bg-destructive/10 group-hover:flex group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
