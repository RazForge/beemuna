"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/lib/i18n";
import { apiGet, apiPost, apiDelete, getToken } from "@/lib/api";
import type { AIMemory } from "@/lib/types";

export function MemoryPanel() {
  const { t } = useLang();
  const [memories, setMemories] = useState<AIMemory[]>([]);
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-stone-900 dark:text-stone-100">{t("ai_memory_panel")}</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400"
        >
          {showForm ? t("ai_memory_cancel") : t("ai_memory_create")}
        </button>
      </div>

      {showForm && (
        <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3 dark:border-stone-700 dark:bg-stone-800">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("ai_memory_content")}
            className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
            rows={3}
          />
          <div className="flex gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded border border-stone-300 bg-white px-2 py-1 text-sm dark:border-stone-600 dark:bg-stone-900"
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
              className="rounded bg-amber-600 px-3 py-1 text-sm text-white hover:bg-amber-700"
            >
              {t("ai_memory_save")}
            </button>
          </div>
        </div>
      )}

      {memories.length === 0 && !showForm && (
        <p className="text-sm text-stone-500 dark:text-stone-400">{t("ai_memory_empty")}</p>
      )}

      <div className="space-y-2">
        {memories.map((m) => (
          <div
            key={m.id}
            className="flex items-start justify-between rounded border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800"
          >
            <div className="flex-1">
              <p className="text-sm text-stone-800 dark:text-stone-200">{m.content}</p>
              <div className="mt-1 flex gap-2 text-xs text-stone-500 dark:text-stone-400">
                <span>{t(`ai_memory_category_${m.category}`)}</span>
                <span>·</span>
                <span>{m.created_at.slice(0, 10)}</span>
              </div>
            </div>
            <button
              onClick={() => handleDelete(m.id)}
              className="ml-2 text-xs text-red-500 hover:text-red-700"
            >
              {t("ai_memory_delete")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
