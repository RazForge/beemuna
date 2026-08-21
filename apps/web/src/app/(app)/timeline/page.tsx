"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiDelete } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { formatError } from "@/lib/utils";
import type { TimelineItem, TimelinePage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pin,
  Archive,
  ArchiveRestore,
  Trash2,
  CheckSquare,
  Target,
  BookOpen,
  FileText,
  Activity,
  CalendarDays,
  Timer,
  Clock,
  ListChecks,
  FolderKanban,
  Trophy,
  Lightbulb,
  FileUp,
  Brain,
  Bell,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  task: CheckSquare,
  subtask: ListChecks,
  project: FolderKanban,
  goal: Trophy,
  milestone: Target,
  journal: BookOpen,
  note: FileText,
  calendar_event: CalendarDays,
  habit: Activity,
  focus: Timer,
  research: Lightbulb,
  document: FileUp,
  ai_insight: Brain,
  reminder: Bell,
  notification: Bell,
};

const typeLabels: Record<string, string> = {
  task: "tl_task",
  subtask: "tl_subtask",
  project: "tl_project",
  goal: "tl_goal",
  milestone: "tl_milestone",
  journal: "tl_journal",
  note: "tl_note",
  calendar_event: "tl_event",
  habit: "tl_habit",
  focus: "tl_focus",
  research: "tl_research",
  document: "tl_document",
  ai_insight: "tl_ai",
  reminder: "tl_reminder",
  notification: "tl_notification",
};

function groupByDay(items: TimelineItem[], locale: string): { label: string; items: TimelineItem[] }[] {
  const groups = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const d = new Date(item.occurred_at);
    const key = d.toLocaleDateString(locale, {
      year: "numeric", month: "long", day: "numeric", weekday: "long",
    });
    const arr = groups.get(key) ?? [];
    arr.push(item);
    groups.set(key, arr);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

export default function TimelinePage() {
  const { t, locale } = useLang();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [type, setType] = useState<string>("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["timeline", page, type, pinnedOnly, showArchived],
    queryFn: () =>
      apiGet<TimelinePage>(`/timeline?page=${page}&page_size=30${type ? `&entity_type=${type}` : ""}${pinnedOnly ? "&pinned=true" : ""}${showArchived ? "&archived=true" : ""}`),
  });

  const pinMutation = useMutation({
    mutationFn: (item: TimelineItem) => apiPatch<TimelineItem>(`/timeline/${item.id}`, { pinned: !item.pinned }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["timeline"] }); },
  });

  const archiveMutation = useMutation({
    mutationFn: (item: TimelineItem) => apiPatch<TimelineItem>(`/timeline/${item.id}`, { archived: !item.archived }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["timeline"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/timeline/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      toast.success(t("tl_removed"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const filtered = useCallback(() => {
    const items = data?.items ?? [];
    if (!search.trim()) return items;
    return items.filter((i) =>
      (i.title + (i.description ?? "")).toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  const items = filtered();
  const groups = groupByDay(items, locale);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("tl_title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("tl_subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder={t("tl_search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="h-9 rounded-full border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("tl_all_types")}</option>
            {Object.entries(typeLabels).map(([k, v]) => (
              <option key={k} value={k}>{t(v)}</option>
            ))}
          </select>
          <Button
            variant={pinnedOnly ? "default" : "outline"}
            size="sm"
            onClick={() => { setPinnedOnly(!pinnedOnly); setPage(1); }}
          >
            <Pin className="h-3.5 w-3.5" /> {t("tl_pinned")}
          </Button>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => { setShowArchived(!showArchived); setPage(1); }}
          >
            {showArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            {showArchived ? t("tl_active") : t("tl_archived")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{formatError(error)}</p>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Inbox className="h-10 w-10 opacity-40" />
          <p className="text-sm">{showArchived ? t("tl_no_archived") : t("tl_no_items")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {group.label}
              </h2>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const Icon = typeIcons[item.entity_type] ?? Inbox;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 rounded-lg border border-border bg-card p-3 ${
                        item.pinned ? "border-primary/40 bg-primary/[0.03]" : ""
                      }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        {item.description && (
                          <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                      <div className="hidden lg:block shrink-0">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {t(typeLabels[item.entity_type] ?? item.entity_type)}
                        </span>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {new Date(item.occurred_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={item.pinned ? t("tl_unpin") : t("tl_pin")}
                          onClick={() => pinMutation.mutate(item)}
                        >
                          <Pin className={`h-3.5 w-3.5 ${item.pinned ? "fill-primary text-primary" : ""}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={item.archived ? t("tl_restore") : t("tl_archive")}
                          onClick={() => archiveMutation.mutate(item)}
                        >
                          {item.archived
                            ? <ArchiveRestore className="h-3.5 w-3.5" />
                            : <Archive className="h-3.5 w-3.5" />}
                        </Button>
                        {showArchived && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            title={t("delete")}
                            onClick={() => deleteMutation.mutate(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t("previous")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t("tl_page")} {data?.page ?? 1} / {Math.max(1, Math.ceil((data?.total ?? 0) / 30))}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!data?.has_more}
              onClick={() => setPage(page + 1)}
            >
              {t("next")}
            </Button>
            {isFetching && <span className="text-xs text-muted-foreground">{t("tl_loading")}</span>}
          </div>
        </div>
      )}
    </div>
  );
}