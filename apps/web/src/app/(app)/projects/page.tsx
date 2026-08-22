"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { formatError, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, FolderKanban, Check, Archive, Search, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

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

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];
const FILTERS = ["all", "active", "completed", "archived"] as const;
type Filter = (typeof FILTERS)[number];

const fade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

export default function ProjectsPage() {
  const { t } = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiGet<Project[]>("/projects"),
  });

  const createProject = useMutation({
    mutationFn: () =>
      apiPost<Project>("/projects", {
        name: draft.trim(),
        description: null,
        color,
        status: "active",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDraft("");
      setColor(null);
      setShowCreate(false);
      toast.success(t("project_created"));
    },
    onError: (err) => toast.error(formatError(err)),
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

  const deleteProject = useMutation({
    mutationFn: (id: string) => apiDelete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("project_deleted"));
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

  const projects = projectsQuery.data ?? [];

  const visible = useMemo(() => {
    let list = projects;
    if (filter === "active") list = list.filter((p) => !p.archived && p.status !== "completed");
    else if (filter === "completed") list = list.filter((p) => p.status === "completed" && !p.archived);
    else if (filter === "archived") list = list.filter((p) => p.archived);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [projects, filter, search]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <motion.header {...fade}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("projects_title")}</h1>
            <p className="text-sm text-muted-foreground">{t("projects_desc")}</p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </motion.header>

      {/* Create form */}
      {showCreate && (
        <motion.div {...fade}>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="space-y-3">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draft.trim()) createProject.mutate();
                }}
                placeholder="Project name"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(color === c ? null : c)}
                      className={cn(
                        "h-6 w-6 rounded-full transition-all",
                        color === c
                          ? "scale-125 ring-2 ring-primary ring-offset-2 ring-offset-card"
                          : "hover:scale-110",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowCreate(false);
                      setDraft("");
                      setColor(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => createProject.mutate()}
                    disabled={!draft.trim() || createProject.isPending}
                  >
                    Create
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Search + filters */}
      <motion.div {...fade} transition={{ duration: 0.3, delay: 0.05 }} className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="pl-9"
          />
        </div>
        <div className="flex rounded-xl border border-border bg-card p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Project list */}
      <motion.div {...fade} transition={{ duration: 0.3, delay: 0.1 }} className="space-y-2">
        {visible.map((p) => (
          <div
            key={p.id}
            className="group rounded-2xl border border-border bg-card transition-all hover:border-primary/20"
          >
            {editingId === p.id ? (
              /* Edit mode */
              <div className="p-4 space-y-3">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Project name"
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditColor(editColor === c ? null : c)}
                        className={cn(
                          "h-5 w-5 rounded-full transition-all",
                          editColor === c && "scale-125 ring-2 ring-primary ring-offset-2 ring-offset-card",
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
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
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* View mode */
              <div className="flex items-center gap-3 p-4">
                <button
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: p.color ?? "#6366f1" }}
                    />
                    <span className="truncate text-sm font-semibold">{p.name}</span>
                  </div>
                  {p.task_count > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden max-w-[200px]">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {p.completed_count}/{p.task_count}
                      </span>
                    </div>
                  )}
                </button>

                {/* Action buttons — always visible */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStatus.mutate({
                        id: p.id,
                        status: p.status === "completed" ? "active" : "completed",
                      });
                    }}
                    className={cn(
                      "h-8 w-8 flex items-center justify-center rounded-lg transition-colors",
                      p.status === "completed"
                        ? "bg-success/10 text-success"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                    title={p.status === "completed" ? "Reopen" : "Complete"}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(p.id);
                      setEditName(p.name);
                      setEditDesc(p.description ?? "");
                      setEditColor(p.color);
                    }}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStatus.mutate({
                        id: p.id,
                        status: p.archived ? "active" : "archived",
                      });
                    }}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    title={p.archived ? "Unarchive" : "Archive"}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${p.name}"?`)) {
                        deleteProject.mutate(p.id);
                      }
                    }}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {projects.length === 0 && (
          <div className="py-16 text-center">
            <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">{t("no_projects")}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
