"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete, getToken } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Send, Trash2, Sparkles, Brain, Loader2, MessageSquare, Settings } from "lucide-react";
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
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-6xl flex-col gap-4">
      <header className="glass rounded-[28px] p-6 shadow-xl border-white/20 dark:border-white/5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-br from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
                {t("ai_title")}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm max-w-xl font-medium">
                {t("ai_desc")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-10 rounded-full px-5 shadow-md" onClick={() => createConv.mutate()}>
                <Plus className="h-4 w-4 mr-1.5" /> {t("new_chat")}
              </Button>
              <Link href="/ai/settings">
                <Button size="icon" variant="outline" className="h-10 w-10 rounded-full" title={t("ai_settings")}>
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {modes.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  "h-8 rounded-full px-4 text-xs font-semibold transition-all",
                  mode === m.value
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {t(m.labelKey)}
              </button>
            ))}
            <div className="ml-1 h-5 w-px bg-border" />
            <select
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              className="h-8 rounded-full border border-black/10 bg-white/50 px-3 text-xs font-medium shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-black/20 focus:outline-none"
            >
              <option value="" className="bg-card text-foreground">{t("no_knowledge_space")}</option>
              {spacesQuery.data?.map((s) => (
                <option key={s.id} value={s.id} className="bg-card text-foreground">{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="w-56 shrink-0 space-y-1.5 overflow-y-auto rounded-2xl border border-border bg-card p-2">
          {conversationsQuery.data?.map((conv) => {
            const isActive = conv.id === activeConv;
            return (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-1 rounded-xl px-1 py-1 transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "hover:bg-black/5 dark:hover:bg-white/10",
                )}
              >
                <button
                  onClick={() => setActiveConv(conv.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
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

        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {!activeConv && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12">
                  <Brain className="h-7 w-7 text-primary" />
                </div>
                <p className="text-sm">{t("start_conversation")}</p>
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
                    "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted",
                  )}
                >
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
                    <div className="mt-2 space-y-1 border-t border-border/60 pt-2">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {t("sources")}
                      </p>
                      {m.sources.map((s, i) => (
                        <div key={i} className="rounded-lg bg-card/70 p-1.5">
                          <p className="text-xs font-medium">{s.source_title}</p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{s.excerpt}</p>
                        </div>
                      ))}
                    </div>
                  )}
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

          <div className="border-t border-border p-4">
            <div className="flex items-center gap-2">
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
                placeholder={activeConv ? t("ask_placeholder") : t("start_chat_first")}
                disabled={!activeConv}
                rows={1}
                className="h-11 max-h-[120px] flex-1 resize-none overflow-y-auto rounded-2xl border border-input bg-background px-4 py-2.5 text-sm focus-ring disabled:opacity-50"
              />
              {streaming ? (
                <Button size="icon" className="h-11 w-11 shrink-0 rounded-2xl" variant="outline" onClick={handleStop} title={t("stop")}>
                  <span className="block h-3 w-3 rounded-[3px] bg-foreground" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-2xl"
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