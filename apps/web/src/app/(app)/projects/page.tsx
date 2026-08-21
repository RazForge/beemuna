"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { formatError, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, FolderKanban, Check, Archive, Search, SortAsc, X } from "lucide-react";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  status: string;
  archived: boolean;
  created_at: string;
  task_count: number;
  completed_count: number;
  progress: number;
}

const COLORS = ["#e58e7d", "#e0b060", "#7da86c", "#6ca0a8", "#8a7db0", "#c07da0"];
const FILTERS = ["all", "active", "completed", "archived"] as const;
type Filter = typeof FILTERS[number];
const SORT_OPTIONS = ["newest", "name", "progress"] as const;
type Sort = typeof SORT_OPTIONS[number];

export default function ProjectsPage() {
  const { t } = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiGet<Project[]>("/projects"),
  });

  const updateProject = useMutation({
    mutationFn: ({ id, ...patch }: Partial<Project> & { id: string }) =>
      apiPatch<Project>(`/projects/${id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditingId(null);
      toast.success(t("project_updated"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const createProject = useMutation({
    mutationFn: () =>
      apiPost<Project>("/projects", {
        name: draft.trim(),
        description: desc.trim() || null,
        color,
        status: "active",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDraft("");
      setDesc("");
      setColor(null);
      toast.success(t("project_created"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiPatch<Project>(`/projects/${id}`, {
        status,
        archived: status === "archived",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
    onError: (err) => toast.error(formatError(err)),
  });

  const deleteProject = useMutation({
    mutationFn: (id: string) => apiDelete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("project_deleted"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const projects = projectsQuery.data ?? [];

  const visible = useMemo(() => {
    let list = projects;
    if (filter === "active") list = list.filter((p) => !p.archived && p.status !== "completed");
    else if (filter === "completed") list = list.filter((p) => p.status === "completed" && !p.archived);
    else if (filter === "archived") list = list.filter((p) => p.archived);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q));
    }

    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "progress") list = [...list].sort((a, b) => b.progress - a.progress);
    else list = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return list;
  }, [projects, filter, search, sort]);

  const active = projects.filter((p) => !p.archived && p.status !== "completed");
  const completed = projects.filter((p) => p.status === "completed" && !p.archived);
  const archived = projects.filter((p) => p.archived);

  function ProjectRow({ p }: { p: Project }) {
    const { t } = useLang();
    const isEditing = editingId === p.id;

    if (isEditing) {
      return (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-card p-4 dark:border-white/20">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder={t("new_project_name")}
            className="font-semibold"
          />
          <Input
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder={t("what_about")}
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setEditColor(editColor === c ? null : c)}
                  className={cn(
                    "h-5 w-5 rounded-full transition-transform",
                    editColor === c && "scale-125 ring-2 ring-primary ring-offset-2 dark:ring-offset-background",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  updateProject.mutate({
                    id: p.id,
                    name: editName.trim() || p.name,
                    description: editDesc.trim() || null,
                    color: editColor,
                  })
                }
                disabled={!editName.trim()}
              >
                {t("save")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-card px-4 py-3 dark:border-white/10 cursor-pointer transition-colors hover:bg-accent/50"
        onClick={() => router.push(`/projects/${p.id}`)}
      >
        <div className="flex items-center gap-3">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: p.color ?? "#94a3b8" }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{p.name}</p>
            {p.description && (
              <p className="truncate text-[13px] text-muted-foreground">{p.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
              {p.completed_count}/{p.task_count}
            </span>
            {!p.archived && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStatus.mutate({
                    id: p.id,
                    status: p.status === "completed" ? "active" : "completed",
                  });
                }}
                title={p.status === "completed" ? t("reopen") : t("mark_complete")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  p.status === "completed"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10",
                )}
              >
                <Check className="h-4 w-4" />
              </button>
            )}
            {!p.archived && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStatus.mutate({ id: p.id, status: "archived" });
                }}
                title={t("archive")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Archive className="h-4 w-4" />
              </button>
            )}
            {p.archived && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStatus.mutate({ id: p.id, status: "active" });
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                title={t("unarchive")}
              >
                <Archive className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingId(p.id);
                setEditName(p.name);
                setEditDesc(p.description ?? "");
                setEditColor(p.color);
              }}
              title={t("edit")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            >
              <span className="text-[11px] font-bold">✎</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteProject.mutate(p.id);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive/10"
              title={t("delete")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {p.task_count > 0 && (
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/80 transition-all"
                style={{ width: `${p.progress}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{p.progress}%</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-8 pt-4">
      <header className="glass rounded-[28px] p-7 flex flex-wrap items-center justify-between gap-4 shadow-xl border-white/20 dark:border-white/5">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-inner">
              <FolderKanban className="h-6 w-6" />
            </span>
            <span className="bg-gradient-to-br from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
              {t("projects_title")}
            </span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl font-medium">{t("projects_desc")}</p>
        </div>
      </header>

      {/* Create */}
      <div className="apple-card flex flex-col gap-3 p-5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) createProject.mutate();
          }}
          placeholder={t("new_project_name")}
        />
        <Input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={t("what_about")}
        />
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(color === c ? null : c)}
                className={cn(
                  "h-5 w-5 rounded-full transition-transform",
                  color === c && "scale-125 ring-2 ring-primary ring-offset-2 dark:ring-offset-background",
                )}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <Button
            onClick={() => createProject.mutate()}
            disabled={!draft.trim() || createProject.isPending}
          >
            <Plus className="h-4 w-4" /> {t("create")}
          </Button>
        </div>
      </div>

      {/* Search, filter, sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            className="pl-9"
          />
        </div>
        <div className="flex rounded-full border border-input bg-card p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-medium transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "all" ? t("all") : f === "active" ? t("active") : f === "completed" ? t("completed") : t("archived")}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-9 rounded-full border border-input bg-card px-3 text-sm"
        >
          <option value="newest">{t("sort_newest")}</option>
          <option value="name">{t("sort_name")}</option>
          <option value="progress">{t("sort_progress")}</option>
        </select>
      </div>

      {visible.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-[15px] font-semibold text-muted-foreground">
            {t("all")} ({visible.length})
          </h2>
          <div className="flex flex-col gap-2">
            {visible.map((p) => (
              <ProjectRow key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

      {projects.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("no_projects")}
        </p>
      )}
    </div>
  );
}