"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Upload, Search, Trash2, FileUp, Globe, StickyNote, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface KnowledgeSpace {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  created_at: string;
}

interface Source {
  id: string;
  knowledge_space_id: string;
  type: string;
  title: string;
  filename: string | null;
  size_bytes: number | null;
  status: string;
  error_message: string | null;
  web_url: string | null;
  meta: Record<string, unknown>;
}

interface Chunk {
  id: string;
  content: string;
  chunk_index: number;
  token_count: number | null;
}

interface SearchHit {
  chunk: Chunk;
  source: Source;
  score: number;
}

const statusColors: Record<string, string> = {
  ready: "bg-success/15 text-success",
  processing: "bg-warning/15 text-warning",
  uploading: "bg-warning/15 text-warning",
  empty: "bg-muted text-muted-foreground",
  error: "bg-destructive/15 text-destructive",
};

const statusLabels: Record<string, string> = {
  ready: "kn_ready",
  processing: "kn_processing",
  uploading: "kn_uploading",
  empty: "kn_empty",
  error: "kn_error",
};

export default function KnowledgePage() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [activeSpace, setActiveSpace] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [spaceDesc, setSpaceDesc] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const spacesQuery = useQuery({
    queryKey: ["knowledge-spaces"],
    queryFn: () => apiGet<KnowledgeSpace[]>("/knowledge/spaces"),
  });

  const sourcesQuery = useQuery({
    queryKey: ["knowledge-sources", activeSpace],
    queryFn: () => apiGet<Source[]>(`/knowledge/spaces/${activeSpace}/sources`),
    enabled: !!activeSpace,
  });

  const searchQueryHook = useQuery({
    queryKey: ["knowledge-search", activeSpace, searchQuery],
    queryFn: () => apiGet<SearchHit[]>(`/knowledge/spaces/${activeSpace}/search?q=${encodeURIComponent(searchQuery)}`),
    enabled: !!activeSpace && searchQuery.trim().length > 0,
  });

  const createSpace = useMutation({
    mutationFn: () => apiPost<KnowledgeSpace>("/knowledge/spaces", { name: spaceName, description: spaceDesc || null }),
    onSuccess: (space) => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-spaces"] });
      setActiveSpace(space.id);
      setShowCreate(false);
      setSpaceName("");
      setSpaceDesc("");
      toast.success(t("kn_space_created"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiPost<Source>(`/knowledge/spaces/${activeSpace}/sources/upload`, form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-sources"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      toast.success(t("kn_source_uploaded"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const createPasteSource = useMutation({
    mutationFn: () =>
      apiPost<Source>(`/knowledge/spaces/${activeSpace}/sources?title=${encodeURIComponent(pasteTitle)}&source_type=paste&content=${encodeURIComponent(pasteContent)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-sources"] });
      setPasteOpen(false);
      setPasteContent("");
      setPasteTitle("");
      toast.success(t("kn_source_added"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const deleteSpace = useMutation({
    mutationFn: (id: string) => apiDelete(`/knowledge/spaces/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-spaces"] });
      if (activeSpace) setActiveSpace(null);
      toast.success(t("kn_space_deleted"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const deleteSource = useMutation({
    mutationFn: (id: string) => apiDelete(`/knowledge/spaces/${activeSpace}/sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-sources"] });
      toast.success(t("kn_source_deleted"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  function handleUpload(file: File | undefined) {
    if (!file || !activeSpace) return;
    if (!/\.(pdf|txt|md|markdown|docx)$/i.test(file.name)) {
      toast.error(t("kn_unsupported_format"));
      return;
    }
    uploadFile.mutate(file);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="glass rounded-[28px] p-7 flex flex-wrap items-center justify-between gap-4 shadow-xl border-white/20 dark:border-white/5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-br from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
            {t("kn_title")}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm max-w-2xl font-medium">
            {t("kn_subtitle")}
          </p>
        </div>
        <Button size="sm" className="h-10 rounded-full px-5 shadow-md" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-1.5" /> {t("kn_new_space")}
        </Button>
      </header>

      {showCreate && (
        <Card className="max-w-lg">
          <CardContent className="flex flex-col gap-3 pt-6">
            <Input
              placeholder={t("kn_space_name")}
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
            />
            <Input
              placeholder={t("description_optional")}
              value={spaceDesc}
              onChange={(e) => setSpaceDesc(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" loading={createSpace.isPending} onClick={() => createSpace.mutate()}>
                {t("create")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
                {t("cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {spacesQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : spacesQuery.data?.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Globe className="h-10 w-10 opacity-40" />
          <p className="text-sm">{t("kn_no_spaces")}</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {spacesQuery.data?.map((space) => (
            <div
              key={space.id}
              onClick={() => setActiveSpace(space.id === activeSpace ? null : space.id)}
              className={`group relative rounded-lg border px-4 py-3 text-left transition-colors cursor-pointer ${
                activeSpace === space.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-accent"
              }`}
            >
              <p className="text-sm font-semibold">{space.name}</p>
              {space.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{space.description}</p>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSpace.mutate(space.id);
                }}
                type="button"
                className="absolute right-1.5 top-1.5 hidden h-6 w-6 items-center justify-center rounded text-destructive hover:bg-destructive/10 group-hover:flex"
                title={t("kn_delete_space")}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {activeSpace && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.markdown,.docx"
              className="hidden"
              onChange={(e) => {
                handleUpload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} loading={uploadFile.isPending}>
              <Upload className="h-4 w-4" /> {t("kn_upload_file")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPasteOpen(!pasteOpen)}>
              <StickyNote className="h-4 w-4" /> {t("kn_add_note")}
            </Button>
            <div className="flex-1" />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("kn_search_space")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-8"
              />
            </div>
          </div>

          {pasteOpen && (
            <Card>
              <CardContent className="flex flex-col gap-3 pt-6">
                <Input
                  placeholder={t("title")}
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                />
                <textarea
                  placeholder={t("kn_paste_content")}
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  className="min-h-32 w-full rounded-full border border-input bg-transparent p-3 text-sm focus-ring"
                />
                <div className="flex gap-2">
                  <Button size="sm" disabled={!pasteTitle.trim() || !pasteContent.trim()} loading={createPasteSource.isPending} onClick={() => createPasteSource.mutate()}>
                    {t("add")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPasteOpen(false)}>
                    {t("cancel")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {searchQuery.trim() ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {t("kn_results")} ({searchQueryHook.data?.length ?? 0})
              </p>
              {searchQueryHook.isFetching && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("kn_searching")}
                </div>
              )}
              {searchQueryHook.data?.map((hit) => (
                <Card key={hit.chunk.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{hit.source.title}</p>
                      <span className="text-xs text-muted-foreground">
                        {t("kn_chunk")} {hit.chunk.chunk_index + 1} · {t("kn_score")} {(hit.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-4">{hit.chunk.content}</p>
                  </CardContent>
                </Card>
              ))}
              {!searchQueryHook.isFetching && searchQueryHook.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("kn_no_matches")}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{t("kn_sources")} ({sourcesQuery.data?.length ?? 0})</p>
              {sourcesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("kn_loading")}</p>
              ) : sourcesQuery.data?.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                  <FileUp className="h-8 w-8 opacity-40" />
                  <p className="text-sm">{t("kn_no_sources")}</p>
                </div>
              ) : (
                sourcesQuery.data?.map((source) => (
                  <Card key={source.id}>
                    <CardContent className="flex items-center gap-3 pt-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        {source.type === "web" ? <Globe className="h-4 w-4 text-primary" /> : <FileUp className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{source.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {source.type}
                          {source.filename ? ` · ${source.filename}` : ""}
                          {source.size_bytes ? ` · ${(source.size_bytes / 1024).toFixed(1)} KB` : ""}
                        </p>
                        {source.error_message && source.status === "error" && (
                          <p className="mt-1 text-xs text-destructive">{source.error_message}</p>
                        )}
                        {typeof source.meta?.embed_error === "string" && (
                          <p className="mt-1 text-xs text-warning">
                            {t("kn_embed_failed")} — {String(source.meta.embed_error).slice(0, 100)}
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColors[source.status] ?? "bg-muted text-muted-foreground"}`}>
                        {t(statusLabels[source.status] ?? source.status)}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSource.mutate(source.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}