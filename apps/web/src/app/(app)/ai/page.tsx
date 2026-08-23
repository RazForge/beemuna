"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete, getToken } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Send, Trash2, Sparkles, Brain, Loader2, MessageSquare, Settings, PanelLeft, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\n/g, "<br />");
  return html;
}

interface Conversation {
  id: string;
  mode: string;
  title: string | null;
  knowledge_space_id: string | null;
  created_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  status: string;
  sources: { source_title: string; score: number; excerpt: string }[];
  created_at: string;
}

interface KnowledgeSpace {
  id: string;
  name: string;
}

const modes = [
  { value: "assistant", labelKey: "assistant" },
  { value: "research", labelKey: "research" },
  { value: "journal", labelKey: "reflection" },
  { value: "planner", labelKey: "planner" },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002/api/v1";

export default function AIPage() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [mode, setMode] = useState("assistant");
  const [spaceId, setSpaceId] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversationsQuery = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: () => apiGet<Conversation[]>("/ai/conversations"),
  });

  const spacesQuery = useQuery({
    queryKey: ["ai-spaces"],
    queryFn: () => apiGet<KnowledgeSpace[]>("/knowledge/spaces"),
  });

  const detailQuery = useQuery({
    queryKey: ["ai-conversation", activeConv],
    queryFn: () => apiGet<Conversation & { messages: Message[] }>(`/ai/conversations/${activeConv}`),
    enabled: !!activeConv,
  });

  const createConv = useMutation({
    mutationFn: () =>
      apiPost<Conversation>("/ai/conversations", {
        mode,
        knowledge_space_id: spaceId || null,
      }),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      setActiveConv(conv.id);
      setDraft("");
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const deleteConv = useMutation({
    mutationFn: (id: string) => apiDelete(`/ai/conversations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      if (activeConv) setActiveConv(null);
      toast.success(t("conversation_deleted"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  // Auto-select first conversation or create one
  useEffect(() => {
    if (conversationsQuery.isLoading) return;
    const convs = conversationsQuery.data ?? [];
    if (convs.length > 0 && !activeConv) {
      setActiveConv(convs[0].id);
    } else if (convs.length === 0 && !activeConv && !createConv.isPending) {
      createConv.mutate();
    }
  }, [conversationsQuery.data, conversationsQuery.isLoading, activeConv]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [detailQuery.data?.messages.length, streamText, streaming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleSend() {
    const content = draft.trim();
    if (!content || !activeConv || streaming) return;

    abortRef.current = new AbortController();
    setStreaming(true);
    setStreamText("");
    setDraft("");

    try {
      const response = await fetch(`${API_URL}/ai/conversations/${activeConv}/messages/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify({ content }),
        signal: abortRef.current.signal,
        credentials: "include",
      });

      if (!response.ok) {
        let message = `Request failed (${response.status})`;
        try {
          const data = await response.json();
          if (typeof data?.detail === "string") message = data.detail;
        } catch {
          // keep default
        }
        throw new Error(message);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming is not supported by this browser");

      const decoder = new TextDecoder();
      let buffer = "";
      let eventError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const event = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const dataLine = event.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const data = JSON.parse(dataLine.slice(5).trim());
          if (data.token) setStreamText((prev) => prev + data.token);
          else if (data.error) eventError = data.error;
          else if (data.done && data.error) eventError = data.error;
        }
      }

      if (eventError) throw new Error(eventError);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // user navigated away — server still persists what it generated
      } else {
        toast.error(formatError(err));
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setStreamText("");
      queryClient.invalidateQueries({ queryKey: ["ai-conversation"] });
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  const messages = detailQuery.data?.messages ?? [];

  return (
    <div className="mx-auto flex h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)] max-w-6xl flex-col gap-3 md:gap-4">
      {/* Header */}
      <header className="glass rounded-3xl p-3 md:p-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-white/10"
              >
                {showSidebar ? <X className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
              </button>
              <img 
                src="/images/beemuna-logo.png"
                alt="Beemuna" 
                className="h-8 w-8 md:h-10 md:w-10 rounded-xl shadow-md shadow-primary/20 border border-white/20"
              />
              <div>
                <h1 className="text-xl md:text-3xl font-extrabold tracking-tight">
                  {t("ai_title")}
                </h1>
                <p className="text-muted-foreground mt-0.5 text-xs md:text-sm max-w-xl font-medium hidden md:block">
                  {t("ai_desc")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-9 md:h-10 rounded-full px-3 md:px-5 shadow-md text-xs md:text-sm" onClick={() => createConv.mutate()}>
                <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1" /> <span className="hidden sm:inline">{t("new_chat")}</span>
              </Button>
              <Link href="/ai/settings">
                <Button size="icon" variant="outline" className="h-9 w-9 md:h-10 md:w-10 rounded-full" title={t("ai_settings")}>
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
            {modes.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  "h-7 md:h-8 rounded-full px-2.5 md:px-4 text-[11px] md:text-xs font-semibold transition-all",
                  mode === m.value
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "glass-subtle text-muted-foreground hover:text-foreground",
                )}
              >
                {t(m.labelKey)}
              </button>
            ))}
            <select
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              className="glass-subtle h-7 md:h-8 rounded-full px-2 md:px-3 text-[11px] md:text-xs font-medium focus:outline-none"
            >
              <option value="" className="bg-card text-foreground">{t("no_knowledge_space")}</option>
              {spacesQuery.data?.map((s) => (
                <option key={s.id} value={s.id} className="bg-card text-foreground">{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex flex-1 gap-3 md:gap-4 overflow-hidden relative">
        {/* Sidebar - mobile overlay */}
        {showSidebar && (
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden" onClick={() => setShowSidebar(false)} />
        )}
        <div className={cn(
          "glass space-y-1.5 overflow-y-auto rounded-2xl p-2 shrink-0",
          "fixed md:relative inset-y-0 left-0 z-50 w-64 md:w-56 md:shrink-0 pt-16 md:pt-0 transition-transform duration-200",
          showSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}>
          {conversationsQuery.data?.map((conv) => {
            const isActive = conv.id === activeConv;
            return (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-1 rounded-xl px-1 py-1 transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "hover:bg-primary/5",
                )}
              >
                <button
                  onClick={() => { setActiveConv(conv.id); setShowSidebar(false); }}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2.5 text-left transition-colors"
                >
                  <span className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                    isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                  )}>
                    <MessageSquare className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {conv.title}
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConv.mutate(conv.id);
                  }}
                  className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full text-destructive opacity-0 hover:bg-destructive/10 group-hover:flex group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          {conversationsQuery.data?.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {t("no_conversations")}
            </p>
          )}
        </div>

        <div className="glass flex flex-1 flex-col overflow-hidden rounded-2xl">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {!activeConv && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm">Starting conversation…</p>
              </div>
            )}

            {activeConv && messages.length === 0 && !streaming && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <Sparkles className="h-8 w-8 text-primary/70" />
                <p className="max-w-sm text-sm">
                  {detailQuery.data?.mode === "research"
                    ? t("research_mode_hint")
                    : t("ask_anything_hint")}
                </p>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[90%] md:max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] md:text-sm leading-relaxed",
                    m.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted",
                  )}
                >
                  <div>
                  {m.content ? (
                    <span dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                  ) : m.status === "error" ? (
                    <span className="text-destructive">{t("something_went_wrong")}</span>
                  ) : (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> {t("thinking")}
                    </span>
                  )}
                  {m.role === "assistant" && m.sources.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {t("sources")}
                      </p>
                      {m.sources.map((s, i) => (
                        <div key={i} className="rounded-lg bg-muted p-1.5">
                          <p className="text-xs font-medium">{s.source_title}</p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{s.excerpt}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                </div>
              </div>
            ))}

            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
                  {streamText ? (
                    <span dangerouslySetInnerHTML={{ __html: renderMarkdown(streamText) }} />
                  ) : (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> {t("thinking")}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border/50 p-3 md:p-4 pb-6 md:pb-8 mb-2">
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={activeConv ? t("ask_placeholder") : "Type a message…"}
                disabled={!activeConv}
                rows={1}
                className="glass-subtle h-10 md:h-11 max-h-[120px] flex-1 resize-none overflow-y-auto rounded-2xl px-3 md:px-4 py-2 md:py-2.5 text-[13px] md:text-sm focus-ring disabled:opacity-50"
              />
              {streaming ? (
                <Button size="icon" className="h-10 w-10 md:h-11 md:w-11 shrink-0 rounded-2xl" variant="outline" onClick={handleStop} title={t("stop")}>
                  <span className="block h-3 w-3 rounded-[3px] bg-foreground" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="h-10 w-10 md:h-11 md:w-11 shrink-0 rounded-2xl"
                  disabled={!activeConv || !draft.trim()}
                  onClick={handleSend}
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}