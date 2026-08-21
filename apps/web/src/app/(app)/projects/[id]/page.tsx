"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { formatError, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ArrowLeft, Trash2, GripVertical, Check, X, Table, FileText, Heading, Type, CheckSquare, Minus, List, Quote, ToggleRight, Image as ImageIcon, MessageSquareQuote, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  status: string;
  archived: boolean;
  task_count: number;
  completed_count: number;
  progress: number;
}

interface ProjectBlock {
  id: string;
  project_id: string;
  type: string;
  title: string | null;
  content: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const BLOCK_TYPES = [
  { value: "text", label: "Text", icon: Type },
  { value: "heading", label: "Heading", icon: Heading },
  { value: "bullets", label: "Bullet list", icon: List },
  { value: "todo", label: "Todo", icon: CheckCircle2 },
  { value: "quote", label: "Quote", icon: Quote },
  { value: "callout", label: "Callout", icon: MessageSquareQuote },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "table", label: "Table", icon: Table },
  { value: "divider", label: "Divider", icon: Minus },
  { value: "toggle", label: "Toggle", icon: ToggleRight },
] as const;

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

export default function ProjectFolderPage() {
  const { t } = useLang();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingHeader, setEditingHeader] = useState<"name" | "desc" | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiGet<Project>(`/projects/${projectId}`),
    enabled: !!projectId,
  });

  const updateProject = useMutation({
    mutationFn: (patch: Partial<Project>) => apiPatch<Project>(`/projects/${projectId}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditingHeader(null);
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const blocksQuery = useQuery({
    queryKey: ["project-blocks", projectId],
    queryFn: () => apiGet<ProjectBlock[]>(`/projects/${projectId}/blocks`),
    enabled: !!projectId,
  });

  const createBlock = useMutation({
    mutationFn: (payload: { type: string; title?: string | null; content: Record<string, unknown>; sort_order: number }) =>
      apiPost<ProjectBlock>(`/projects/${projectId}/blocks`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-blocks", projectId] });
      setShowAdd(false);
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const updateBlock = useMutation({
    mutationFn: ({ id, ...patch }: Partial<ProjectBlock> & { id: string }) =>
      apiPatch<ProjectBlock>(`/blocks/${id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-blocks", projectId] });
      setEditingId(null);
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const deleteBlock = useMutation({
    mutationFn: (id: string) => apiDelete(`/blocks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-blocks", projectId] });
      toast.success("Block deleted");
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const project = projectQuery.data;
  const blocks = blocksQuery.data ?? [];

  const sortedBlocks = useMemo(() => {
    return [...blocks].sort((a, b) => a.sort_order - b.sort_order);
  }, [blocks]);

  const addBlock = (type: string) => {
    const content: Record<string, unknown> = {};
    if (type === "table") {
      content.columns = [{ id: uid(), name: "Column 1" }];
      content.rows = [{ id: uid(), values: {} }];
    } else if (type === "todo" || type === "task_list") {
      content.items = [];
    } else if (type === "heading") {
      content.text = "Heading";
    } else if (type === "bullets") {
      content.items = [];
    } else if (type === "quote") {
      content.text = "";
      content.author = "";
    } else if (type === "callout") {
      content.text = "";
      content.color = "#eef2ff";
    } else if (type === "image") {
      content.url = "";
      content.caption = "";
    } else if (type === "toggle") {
      content.text = "";
      content.open = false;
    } else if (type === "divider") {
      // divider uses empty content object
    } else {
      content.text = "";
    }
    createBlock.mutate({ type, title: null, content, sort_order: blocks.length });
  };

  if (projectQuery.isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!project) {
    return <div className="flex h-64 items-center justify-center text-destructive">Project not found</div>;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-8 pt-4">
      <div className="glass flex flex-wrap items-center gap-3 rounded-[24px] border-white/20 p-5 dark:border-white/5">
        <Button variant="ghost" size="icon" onClick={() => router.push("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: project.color ?? "#94a3b8" }}
        />
        <div className="min-w-0 flex-1">
          {editingHeader === "name" ? (
            <Input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => {
                if (editName.trim() && editName.trim() !== project.name) {
                  updateProject.mutate({ name: editName.trim() });
                } else setEditingHeader(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditingHeader(null);
              }}
              className="text-xl font-bold"
            />
          ) : (
            <h1
              onClick={() => { setEditingHeader("name"); setEditName(project.name); }}
              className="cursor-pointer text-2xl font-extrabold tracking-tight transition-colors hover:text-primary"
              title="Click to rename"
            >
              {project.name} <span className="text-xs font-medium text-muted-foreground/60">✎</span>
            </h1>
          )}
          {editingHeader === "desc" ? (
            <Input
              autoFocus
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              onBlur={() => {
                updateProject.mutate({ description: editDesc.trim() || null });
                setEditingHeader(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditingHeader(null);
              }}
              className="mt-1 text-sm"
            />
          ) : (
            <p
              onClick={() => { setEditingHeader("desc"); setEditDesc(project.description ?? ""); }}
              className="mt-0.5 cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
              title="Click to edit"
            >
              {project.description || "Add a description…"}
            </p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>{project.completed_count}/{project.task_count} tasks</span>
          <span>{project.progress}%</span>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-3">
        {sortedBlocks.map((block) => (
          <BlockCard
            key={block.id}
            block={block}
            isEditing={editingId === block.id}
            onStartEdit={() => setEditingId(block.id)}
            onCancelEdit={() => setEditingId(null)}
            onUpdate={(patch) => updateBlock.mutate({ id: block.id, ...patch })}
            onDelete={() => deleteBlock.mutate(block.id)}
          />
        ))}
      </div>

      {showAdd ? (
        <div className="apple-card flex flex-col gap-2 p-4">
          <p className="text-sm font-semibold">Add block</p>
          <div className="flex flex-wrap gap-2">
            {BLOCK_TYPES.map((bt) => (
              <Button
                key={bt.value}
                size="sm"
                variant="outline"
                onClick={() => addBlock(bt.value)}
                loading={createBlock.isPending}
              >
                <bt.icon className="h-4 w-4" /> {bt.label}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="self-start" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> Add block
        </Button>
      )}
    </div>
  );
}

function BlockCard({
  block,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
}: {
  block: ProjectBlock;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (patch: Partial<ProjectBlock>) => void;
  onDelete: () => void;
}) {
  const { t } = useLang();

  if (isEditing) {
    return <BlockEditor block={block} onSave={onUpdate} onCancel={onCancelEdit} />;
  }

  return (
    <div
      className="group cursor-pointer rounded-2xl border border-black/5 bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/40 dark:border-white/10"
      onClick={onStartEdit}
      title="Click to edit"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <GripVertical className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
          <span className="text-xs font-medium uppercase tracking-wider">
            {block.type.replace("_", " ")}
          </span>
          {block.title && (
            <span className="text-sm font-semibold text-foreground">{block.title}</span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onStartEdit(); }}>
            <span className="text-[11px] font-bold">✎</span>
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <BlockViewer block={block} />
    </div>
  );
}

function BlockViewer({ block }: { block: ProjectBlock }) {
  const content = block.content || {};
  switch (block.type) {
    case "heading":
      return <h2 className="mt-2 text-lg font-bold">{content.text as string || "Heading"}</h2>;
    case "text":
      return <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{content.text as string || ""}</p>;
    case "note":
      return (
        <div className="mt-2 rounded-xl bg-black/[0.03] p-3 text-sm dark:bg-white/5">
          {content.text as string || <span className="text-muted-foreground">Empty note</span>}
        </div>
      );
    case "divider":
      return <div className="my-2 h-px w-full bg-border" />;
    case "bullets": {
      const items = (content.items as Array<{ id: string; text: string }>) || [];
      return (
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
          {items.map((item) => (
            <li key={item.id}>{item.text || "Empty bullet"}</li>
          ))}
          {items.length === 0 && <p className="text-xs text-muted-foreground">No items yet</p>}
        </ul>
      );
    }
    case "quote":
      return (
        <blockquote className="mt-2 border-l-4 border-primary/40 pl-4 text-sm italic text-muted-foreground">
          {content.text as string || "Quote"}
          {content.author ? <span className="mt-1 block text-xs not-italic font-semibold text-foreground">— {content.author as string}</span> : null}
        </blockquote>
      );
    case "callout":
      return (
        <div
          className="mt-2 rounded-xl border p-3 text-sm"
          style={{ backgroundColor: (content.color as string) || "#eef2ff", borderColor: (content.color as string) || "#eef2ff" }}
        >
          {content.text as string || "Callout"}
        </div>
      );
    case "image":
      return (
        <div className="mt-2">
          {content.url ? (
            <img
              src={content.url as string}
              alt={content.caption as string || "Image"}
              className="max-h-72 w-full rounded-xl border border-border object-cover"
            />
          ) : (
            <p className="text-xs text-muted-foreground">No image set. Click to add one.</p>
          )}
          {typeof content.caption === "string" && content.caption && <p className="mt-1 text-xs text-muted-foreground">{content.caption}</p>}
        </div>
      );
    case "toggle":
      return (
        <div className="mt-2">
          <details open={!!content.open} className="text-sm">
            <summary className="cursor-pointer font-semibold">{content.text as string || "Toggle"}</summary>
            <div className="mt-1.5 text-sm text-muted-foreground">{content.detail as string || ""}</div>
          </details>
        </div>
      );
    case "todo":
    case "task_list": {
      const items = (content.items as Array<{ id: string; text: string; done: boolean }>) || [];
      return (
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <span className={cn("h-4 w-4 rounded border", item.done && "bg-primary text-primary-foreground")}>
                {item.done && <Check className="h-3 w-3" />}
              </span>
              <span className={cn(item.done && "text-muted-foreground line-through")}>{item.text}</span>
            </li>
          ))}
          {items.length === 0 && <p className="text-xs text-muted-foreground">No tasks yet</p>}
        </ul>
      );
    }
    case "table": {
      const columns = (content.columns as Array<{ id: string; name: string }>) || [];
      const rows = (content.rows as Array<{ id: string; values: Record<string, string> }>) || [];
      return (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {columns.map((col) => (
                  <th key={col.id} className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">
                    {col.name}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/50">
                  {columns.map((col) => (
                    <td key={col.id} className="px-2 py-1.5 text-xs">
                      {row.values[col.id] || ""}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-2 py-3 text-center text-xs text-muted-foreground">
                    Empty table
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    }
    default:
      return <p className="mt-2 text-sm text-muted-foreground">Unknown block type</p>;
  }
}

function BlockEditor({
  block,
  onSave,
  onCancel,
}: {
  block: ProjectBlock;
  onSave: (patch: Partial<ProjectBlock>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(block.title || "");
  const [content, setContent] = useState<Record<string, unknown>>(block.content || {});
  const [type, setType] = useState(block.type);

  const save = () => {
    onSave({ title: title || null, content, type });
  };

  const updateContent = (patch: Record<string, unknown>) => {
    setContent((prev) => ({ ...prev, ...patch }));
  };

  const tableColumns = (content.columns as Array<{ id: string; name: string }>) || [];
  const tableRows = (content.rows as Array<{ id: string; values: Record<string, string> }>) || [];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-card p-4 dark:border-white/20">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Block title (optional)"
        className="font-semibold"
      />
      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map((bt) => (
          <Button
            key={bt.value}
            size="sm"
            variant={type === bt.value ? "default" : "outline"}
            onClick={() => {
              setType(bt.value as ProjectBlock["type"]);
              if (bt.value === "table") {
                updateContent({ columns: [{ id: uid(), name: "Column 1" }], rows: [{ id: uid(), values: {} }] });
              } else if (bt.value === "todo") {
                updateContent({ items: [] });
              } else if (bt.value === "bullets") {
                updateContent({ items: [] });
              } else if (bt.value === "quote") {
                updateContent({ text: "", author: "" });
              } else if (bt.value === "callout") {
                updateContent({ text: "", color: "#eef2ff" });
              } else if (bt.value === "image") {
                updateContent({ url: "", caption: "" });
              } else if (bt.value === "toggle") {
                updateContent({ text: "", open: false });
              } else if (bt.value === "divider") {
                updateContent({});
              } else {
                updateContent({ text: "" });
              }
            }}
          >
            <bt.icon className="h-4 w-4" /> {bt.label}
          </Button>
        ))}
      </div>

      {(type === "text" || type === "heading" || type === "note" || type === "callout") && (
        <Textarea
          value={(content.text as string) || ""}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateContent({ text: e.target.value })}
          placeholder={type === "heading" ? "Heading text" : "Write something…"}
          className={cn("min-h-[120px]", type === "heading" && "text-lg font-bold")}
        />
      )}

      {type === "quote" && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={(content.text as string) || ""}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateContent({ text: e.target.value })}
            placeholder="Quote text"
            className="min-h-[80px]"
          />
          <Input
            value={(content.author as string) || ""}
            onChange={(e) => updateContent({ author: e.target.value })}
            placeholder="Author (optional)"
            className="text-sm"
          />
        </div>
      )}

      {type === "image" && (
        <div className="flex flex-col gap-2">
          <Input
            value={(content.url as string) || ""}
            onChange={(e) => updateContent({ url: e.target.value })}
            placeholder="Image URL (https://…)"
            className="text-sm"
          />
          <Input
            value={(content.caption as string) || ""}
            onChange={(e) => updateContent({ caption: e.target.value })}
            placeholder="Caption (optional)"
            className="text-sm"
          />
          {typeof content.url === "string" && content.url && (
            <img
              src={content.url}
              alt="preview"
              className="max-h-48 rounded-xl border border-border object-cover"
            />
          )}
        </div>
      )}

      {type === "toggle" && (
        <div className="flex flex-col gap-2">
          <Input
            value={(content.text as string) || ""}
            onChange={(e) => updateContent({ text: e.target.value })}
            placeholder="Toggle title"
            className="text-sm font-semibold"
          />
          <Textarea
            value={(content.detail as string) || ""}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateContent({ detail: e.target.value })}
            placeholder="Hidden content when open…"
            className="min-h-[80px]"
          />
        </div>
      )}

      {(type === "todo" || type === "task_list") && (
        <TaskListEditor
          items={(content.items as Array<{ id: string; text: string; done: boolean }>) || []}
          onChange={(items) => updateContent({ items })}
        />
      )}

      {type === "bullets" && (
        <BulletsEditor
          items={(content.items as Array<{ id: string; text: string }>) || []}
          onChange={(items) => updateContent({ items })}
        />
      )}

      {type === "table" && (
        <TableEditor
          columns={tableColumns}
          rows={tableRows}
          onColumnsChange={(columns) => updateContent({ columns })}
          onRowsChange={(rows) => updateContent({ rows })}
        />
      )}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4" /> Cancel
        </Button>
        <Button size="sm" onClick={save}>
          <Check className="h-4 w-4" /> Save
        </Button>
      </div>
    </div>
  );
}

function TaskListEditor({
  items,
  onChange,
}: {
  items: Array<{ id: string; text: string; done: boolean }>;
  onChange: (items: Array<{ id: string; text: string; done: boolean }>) => void;
}) {
  const add = () => {
    onChange([...items, { id: uid(), text: "", done: false }]);
  };
  const remove = (id: string) => {
    onChange(items.filter((i) => i.id !== id));
  };
  const toggle = (id: string) => {
    onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  };
  const updateText = (id: string, text: string) => {
    onChange(items.map((i) => (i.id === id ? { ...i, text } : i)));
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={() => toggle(item.id)}
          >
            <span className={cn("h-4 w-4 rounded border", item.done && "bg-primary text-primary-foreground")}>
              {item.done && <Check className="h-3 w-3" />}
            </span>
          </Button>
          <Input
            value={item.text}
            onChange={(e) => updateText(item.id, e.target.value)}
            placeholder={`Task ${idx + 1}`}
            className="h-8 text-xs"
          />
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(item.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}>
        <Plus className="h-4 w-4" /> Add task
      </Button>
    </div>
  );
}

function BulletsEditor({
  items,
  onChange,
}: {
  items: Array<{ id: string; text: string }>;
  onChange: (items: Array<{ id: string; text: string }>) => void;
}) {
  const add = () => {
    onChange([...items, { id: uid(), text: "" }]);
  };
  const remove = (id: string) => {
    onChange(items.filter((i) => i.id !== id));
  };
  const updateText = (id: string, text: string) => {
    onChange(items.map((i) => (i.id === id ? { ...i, text } : i)));
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2">
          <span className="text-foreground/50 text-sm">•</span>
          <Input
            value={item.text}
            onChange={(e) => updateText(item.id, e.target.value)}
            placeholder={`Item ${idx + 1}`}
            className="h-8 text-xs"
          />
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(item.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}>
        <Plus className="h-4 w-4" /> Add item
      </Button>
    </div>
  );
}

function TableEditor({
  columns,
  rows,
  onColumnsChange,
  onRowsChange,
}: {
  columns: Array<{ id: string; name: string }>;
  rows: Array<{ id: string; values: Record<string, string> }>;
  onColumnsChange: (columns: Array<{ id: string; name: string }>) => void;
  onRowsChange: (rows: Array<{ id: string; values: Record<string, string> }>) => void;
}) {
  const addColumn = () => {
    onColumnsChange([...columns, { id: uid(), name: `Column ${columns.length + 1}` }]);
  };
  const removeColumn = (id: string) => {
    const next = columns.filter((c) => c.id !== id);
    onColumnsChange(next);
    onRowsChange(rows.map((r) => ({ ...r, values: Object.fromEntries(Object.entries(r.values).filter(([k]) => k !== id)) })));
  };
  const updateColumnName = (id: string, name: string) => {
    onColumnsChange(columns.map((c) => (c.id === id ? { ...c, name } : c)));
  };
  const addRow = () => {
    onRowsChange([...rows, { id: uid(), values: {} }]);
  };
  const removeRow = (id: string) => {
    onRowsChange(rows.filter((r) => r.id !== id));
  };
  const updateCell = (rowId: string, colId: string, value: string) => {
    onRowsChange(rows.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, [colId]: value } } : r)));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {columns.map((col) => (
          <div key={col.id} className="flex items-center gap-1">
            <Input
              value={col.name}
              onChange={(e) => updateColumnName(col.id, e.target.value)}
              className="h-7 text-xs"
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeColumn(col.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={addColumn}>
          <Plus className="h-4 w-4" /> Column
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-black/[0.02] dark:bg-white/5">
              {columns.map((col) => (
                <th key={col.id} className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">
                  {col.name}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/50">
                {columns.map((col) => (
                  <td key={col.id} className="px-1 py-1">
                    <Input
                      value={row.values[col.id] || ""}
                      onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                      className="h-7 border-0 bg-transparent p-1 text-xs focus-visible:ring-1"
                    />
                  </td>
                ))}
                <td className="w-8 px-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive"
                    onClick={() => removeRow(row.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No rows
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Button size="sm" variant="outline" onClick={addRow}>
        <Plus className="h-4 w-4" /> Add row
      </Button>
    </div>
  );
}
