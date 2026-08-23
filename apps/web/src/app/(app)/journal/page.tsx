"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Save, Check, ChevronLeft, ChevronRight, Plus, X, SquarePlay, Music, Play, Link, ImagePlus,
  Bold, Italic, Underline, Strikethrough, Highlighter, List, ListOrdered, Quote, Eraser,
  BookOpen, CheckSquare, Heart, Lightbulb, Church, MoreHorizontal, Trash2,
  Mic, MicOff, Circle, StopCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function execInline(cmd: string) {
  document.execCommand(cmd, false);
}

function focusEditorInAndRun(editor: HTMLElement | null, run: () => void) {
  if (editor && !editor.contains(document.activeElement)) {
    editor.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  run();
}

interface JournalEntry {
  id: string;
  title: string | null;
  content: string;
  entry_date: string;
  mood: string | null;
  tags: string[];
  favorite: boolean;
  private: boolean;
  created_at: string;
  entry_type: string;
}

interface MediaItem {
  type: "youtube" | "music" | "image" | "audio" | "document" | "file";
  url: string;
  id?: string;
  name?: string;
}

interface JournalPayload {
  text: string;
  media: MediaItem[];
}

const MOODS = [
  { emoji: "😔", label: "Low", value: "low" },
  { emoji: "😐", label: "Neutral", value: "neutral" },
  { emoji: "🙂", label: "Okay", value: "okay" },
  { emoji: "😊", label: "Good", value: "good" },
  { emoji: "😄", label: "Great", value: "great" },
];

const ENTRY_TYPES = [
  { value: "diary", label: "Diary", icon: BookOpen },
  { value: "todo", label: "Todo List", icon: CheckSquare },
  { value: "gratitude", label: "Gratitude", icon: Heart },
  { value: "idea", label: "Idea", icon: Lightbulb },
  { value: "prayer", label: "Prayer", icon: Church },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const EMPTY_PAYLOAD: JournalPayload = { text: "", media: [] };

function hostLabel(url: string, fallback: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return fallback;
  }
}

function parseMediaUrl(raw: string): MediaItem | null {
  const url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return null;

  const ytMatch =
    url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/) ??
    url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: "youtube", url, id: ytMatch[1] };

  const musicHosts = /(spotify|music\.apple|soundcloud|deezer|bandcamp|tidal)/i;
  if (musicHosts.test(url)) return { type: "music", url };

  return null;
}

function classifyFile(fileName: string, mime: string): MediaItem["type"] {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (mime.startsWith("image/") || /^(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/.test(ext)) return "image";
  if (mime.startsWith("audio/") || /^(mp3|wav|ogg|m4a|aac|flac|opus|wma|midi)$/.test(ext)) return "audio";
  if (mime === "application/pdf" || /^(pdf|docx?|txt|md|markdown|rtf|odt|xlsx?|pptx?|csv|json)$/.test(ext)) return "document";
  return "file";
}

function ToolbarBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
    >
      {children}
    </button>
  );
}

function ItemPreview({ item, onRemove }: { item: MediaItem; onRemove: () => void }) {
  const { t } = useLang();
  const [playing, setPlaying] = useState(false);
  if (item.type === "youtube" && item.id) {
    if (playing) {
      return (
        <div className="group relative overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
          <div className="aspect-video w-full">
            <iframe
              src={`https://www.youtube.com/embed/${item.id}?autoplay=1`}
              title={t("youtube_thumbnail")}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture web-share"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
          <button
            onClick={onRemove}
            className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
            aria-label={t("remove_link")}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      );
    }
    return (
      <div className="group relative overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.preventDefault()}
          className="block"
        >
          <img
            src={`https://img.youtube.com/vi/${item.id}/hqdefault.jpg`}
            alt={t("youtube_thumbnail")}
            className="h-20 w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPlaying(true);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-transform hover:scale-110"
              aria-label="Play"
            >
              <Play className="h-4 w-4 fill-white" />
            </button>
          </div>
        </a>
        <button
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
          aria-label={t("remove_link")}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  if (item.type === "image") {
    return (
      <div className="group relative overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={item.url}
            alt={item.name ?? t("attached_image")}
            className="h-24 w-full object-cover transition-transform group-hover:scale-105"
          />
        </a>
        <button
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
          aria-label={t("remove_image")}
        >
          <X className="h-3 w-3" />
        </button>
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {t("image")}
        </span>
      </div>
    );
  }

  if (item.type === "audio") {
    return (
      <div className="group relative flex items-center gap-3 rounded-xl border border-black/10 bg-black/[0.03] p-2.5 dark:border-white/10 dark:bg-white/5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
          <Music className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{item.name ?? t("music")}</p>
          <audio controls className="mt-1.5 h-9 w-full max-w-[230px]" src={item.url} preload="metadata" />
        </div>
        <button
          onClick={onRemove}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-black/10 group-hover:opacity-100"
          aria-label={t("remove_link")}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="group relative flex items-center gap-3 rounded-xl border border-black/10 bg-black/[0.03] p-2.5 dark:border-white/10 dark:bg-white/5">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning transition-transform group-hover:scale-110">
          <SquarePlay className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">
            {item.type === "music" ? t("music") : item.name ?? (item.type === "document" ? "Document" : "File")}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {item.type === "document" || item.type === "file" ? "Open attached file" : hostLabel(item.url, t("music"))}
          </p>
        </div>
      </a>
      <button
        onClick={onRemove}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-black/10 group-hover:opacity-100"
        aria-label={t("remove_link")}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function EntryEditor({
  viewDate,
  initialEntry,
  onShiftDay,
  selectedEntryId,
  onSelectEntry,
  onCreateEntry,
  onDeleteEntry,
  onSaveSuccess,
  entriesForDate,
  saveCounter,
}: {
  viewDate: string;
  initialEntry?: JournalEntry;
  onShiftDay: (delta: number) => void;
  selectedEntryId: string | null;
  onSelectEntry: (id: string | null) => void;
  onCreateEntry: (type: string) => void;
  onDeleteEntry: (id: string) => void;
  onSaveSuccess?: () => void;
  entriesForDate: JournalEntry[];
  saveCounter: number;
}) {
  const queryClient = useQueryClient();
  const { t } = useLang();

  const parsed = useMemo<JournalPayload>(() => {
    if (!initialEntry?.content) return EMPTY_PAYLOAD;
    try {
      const obj = JSON.parse(initialEntry.content);
      if (obj && typeof obj === "object" && Array.isArray(obj.media)) {
        return { text: typeof obj.text === "string" ? obj.text : "", media: obj.media };
      }
    } catch {
      // legacy plain text
    }
    return { text: initialEntry.content, media: [] };
  }, [initialEntry]);

  const [title, setTitle] = useState(initialEntry?.title ?? "");
  const [content, setContent] = useState(parsed.text);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = parsed.text;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDate, selectedEntryId]);

  const [media, setMedia] = useState<MediaItem[]>(parsed.media);
  const [mood, setMood] = useState<string | null>(initialEntry?.mood ?? null);
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  // Voice typing (Speech-to-Text)
  const [voiceTyping, setVoiceTyping] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Voice memo recording
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const prevSaveCounter = useRef(saveCounter);
  useEffect(() => {
    if (saveCounter !== prevSaveCounter.current) {
      prevSaveCounter.current = saveCounter;
      setContent("");
      setMedia([]);
      setMood(null);
      if (editorRef.current) {
        editorRef.current.innerHTML = "";
      }
    }
  }, [saveCounter]);

  const addLink = () => {
    const item = parseMediaUrl(linkInput);
    if (!item) {
      setLinkError(t("paste_link_hint"));
      return;
    }
    setLinkError(null);
    setMedia((prev) => [...prev, item]);
    setLinkInput("");
  };

  // ── Voice Typing (Speech-to-Text) ────────────────────────────────────────
  const toggleVoiceTyping = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("Speech recognition is not supported in this browser");
      return;
    }

    if (voiceTyping) {
      recognitionRef.current?.stop();
      setVoiceTyping(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript && editorRef.current) {
        editorRef.current.focus();
        document.execCommand("insertText", false, transcript);
        setContent(editorRef.current.innerText);
      }
    };

    recognition.onerror = () => {
      setVoiceTyping(false);
    };

    recognition.onend = () => {
      setVoiceTyping(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setVoiceTyping(true);
    toast.success("Voice typing started — speak now");
  };

  // ── Voice Memo Recording ─────────────────────────────────────────────────
  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      return;
    }

    if (!navigator.mediaDevices || !window.MediaRecorder) {
      toast.error("Voice recording is not supported on this device");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Find a supported MIME type
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/aac",
        "audio/wav",
      ];
      let selectedMime = "";
      for (const mt of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) {
          selectedMime = mt;
          break;
        }
      }

      const options: MediaRecorderOptions = selectedMime ? { mimeType: selectedMime } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          setMedia((prev) => [...prev, { type: "audio", url: reader.result as string, name: `Voice memo ${new Date().toLocaleTimeString()}` }]);
          toast.success("Voice memo saved");
        };
        reader.onerror = () => {
          toast.error("Failed to save voice memo");
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.onerror = () => {
        toast.error("Recording failed");
        setRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordTime(0);
      recordTimerRef.current = setInterval(() => {
        setRecordTime((t) => {
          const next = t + 1;
          if (next >= 300) {
            // 5 min max
            mediaRecorderRef.current?.stop();
            setRecording(false);
            if (recordTimerRef.current) clearInterval(recordTimerRef.current);
            toast.info("Max recording time reached (5 min)");
          }
          return next;
        });
      }, 1000);
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        toast.error("Microphone permission denied — allow access in Settings");
      } else {
        toast.error("Could not start recording");
      }
    }
  };

  const formatRecordTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const snapshotFromEditor = () => {
    const html = editorRef.current?.innerHTML ?? "";
    return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const text = snapshotFromEditor();
      const payloadJson = JSON.stringify({ text, media } satisfies JournalPayload);
      const payload = { title: title || null, content: payloadJson, entry_date: viewDate, mood, entry_type: initialEntry?.entry_type ?? "diary" };
      const isTemp = initialEntry?.id?.startsWith("temp-");
      if (initialEntry?.id && !isTemp) {
        return apiPatch<JournalEntry>(`/journal/${initialEntry.id}`, payload);
      }
      return apiPost<JournalEntry>("/journal", { ...payload, private: true, tags: [] });
    },
    onSuccess: (savedEntry) => {
      queryClient.setQueryData<JournalEntry[]>(["journal-month", viewDate], (old = []) => {
        const filtered = old.filter((e) => !e.id.startsWith("temp-") && e.id !== savedEntry.id);
        return [savedEntry, ...filtered];
      });
      queryClient.setQueryData<JournalEntry[]>(["journal-date", viewDate], (old = []) => {
        const filtered = old.filter((e) => !e.id.startsWith("temp-") && e.id !== savedEntry.id);
        return [savedEntry, ...filtered];
      });
      onSaveSuccess?.();
      onSelectEntry(savedEntry.id);
      toast.success(t("reflection_saved"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      if (entryId.startsWith("temp-")) {
        return;
      }
      await apiDelete(`/journal/${entryId}`);
    },
    onSuccess: (_, entryId) => {
      queryClient.setQueryData<JournalEntry[]>(["journal-month", viewDate], (old = []) => old.filter((e) => e.id !== entryId));
      queryClient.setQueryData<JournalEntry[]>(["journal-date", viewDate], (old = []) => old.filter((e) => e.id !== entryId));
      onDeleteEntry(entryId);
      toast.success(t("entry_deleted"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const isToday = viewDate === localDateString(new Date());
  const dayLabel = new Date(`${viewDate}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const [showHl, setShowHl] = useState(false);
  const HL_COLORS = [
    { name: "Yellow", value: "#fde047" },
    { name: "Green", value: "#86efac" },
    { name: "Cyan", value: "#67e8f9" },
    { name: "Pink", value: "#f9a8d4" },
    { name: "Orange", value: "#fdba74" },
    { name: "Purple", value: "#d8b4fe" },
  ];

  const getEntryTypeIcon = (type: string) => {
    const found = ENTRY_TYPES.find((et) => et.value === type);
    if (found) return <found.icon className="h-3.5 w-3.5" />;
    return <MoreHorizontal className="h-3.5 w-3.5" />;
  };

  const selectedEntry = entriesForDate.find((e) => e.id === selectedEntryId) ?? initialEntry;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr_260px]">
      {/* LEFT PANEL: date navigation + mood + media */}
      <aside className="glass h-fit rounded-[22px] p-5 lg:sticky lg:top-2">
        <div className="flex items-center justify-between gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => onShiftDay(-1)} aria-label={t("previous_day")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 text-center">
            <p className="truncate text-[15px] font-semibold leading-tight">{isToday ? t("today") : dayLabel}</p>
            <p className="text-xs text-muted-foreground">{t("how_are_you_feeling")}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => onShiftDay(1)} aria-label={t("next_day")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="my-5 h-px bg-black/5 dark:bg-white/10" />

        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("mood")}</p>
        <div className="flex flex-wrap justify-center gap-1 rounded-full bg-muted p-1.5">
          {MOODS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMood(m.value === mood ? null : m.value)}
              title={t("mood_" + m.value)}
              className={`flex h-11 w-11 items-center justify-center rounded-full text-xl transition-all duration-200 ${
                mood === m.value ? "scale-110 bg-white shadow-sm dark:bg-card" : "opacity-60 hover:opacity-100"
              }`}
            >
              {m.emoji}
            </button>
          ))}
        </div>

        {/* Media & Links */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("media_links")}</p>
          </div>

          {media.length > 0 && (
            <div className="mb-3 space-y-2">
              {media.map((item, i) => (
                <ItemPreview key={`${item.url}-${i}`} item={item} onRemove={() => setMedia((prev) => prev.filter((_, j) => j !== i))} />
              ))}
            </div>
          )}

          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Link className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={linkInput}
                onChange={(e) => { setLinkInput(e.target.value); if (linkError) setLinkError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
                placeholder={t("youtube_or_music_link_placeholder")}
                className="w-full rounded-full border border-input bg-transparent py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button size="sm" className="h-8 shrink-0 rounded-full px-3" onClick={addLink} aria-label={t("add_link")}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {linkError && <p className="mt-2 text-[11px] text-destructive">{linkError}</p>}

          {/* Voice Memo Record */}
          <button
            type="button"
            onClick={toggleRecording}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-4 transition-all ${
              recording
                ? "border-red-500 bg-red-500/5 text-red-500 animate-pulse"
                : "border-input hover:border-primary/40 hover:bg-primary/5 text-muted-foreground"
            }`}
          >
            {recording ? (
              <>
                <StopCircle className="h-5 w-5" />
                <span className="text-xs font-bold">Recording {formatRecordTime(recordTime)}</span>
              </>
            ) : (
              <>
                <Circle className="h-5 w-5 fill-current" />
                <span className="text-xs font-bold">Record voice memo</span>
              </>
            )}
          </button>

          <div
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files);
              for (const file of files) {
                const type = classifyFile(file.name, file.type);
                const reader = new FileReader();
                reader.onloadend = () => {
                  setMedia((prev) => [...prev, { type, url: reader.result as string, name: file.name }]);
                };
                reader.readAsDataURL(file);
              }
            }}
            className="mt-3 space-y-2"
          >
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-input py-6 transition-all hover:border-primary/40 hover:bg-primary/5">
              <input
                type="file"
                multiple
                className="hidden"
                accept="*/*"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  for (const file of files) {
                    const type = classifyFile(file.name, file.type);
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setMedia((prev) => [...prev, { type, url: reader.result as string, name: file.name }]);
                    };
                    reader.readAsDataURL(file);
                  }
                  e.target.value = "";
                }}
              />
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground">{t("add_image_hint")}</span>
            </label>
          </div>

          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <SquarePlay className="h-3 w-3" />
            {t("media_hint")}
          </p>
        </div>
      </aside>

      {/* RIGHT PANEL: reflection editor */}
      <div className="glass flex min-h-[560px] flex-col gap-5 rounded-[22px] p-7">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("title_for_day_placeholder")}
          className="bg-transparent text-2xl font-semibold placeholder:text-muted-foreground/50 focus:outline-none"
        />

        {/* Formatting toolbar */}
        <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-muted/60 p-1.5">
          <ToolbarBtn title="Bold" onClick={() => focusEditorInAndRun(editorRef.current, () => execInline("bold"))}><Bold className="h-4 w-4" /></ToolbarBtn>
          <ToolbarBtn title="Italic" onClick={() => focusEditorInAndRun(editorRef.current, () => execInline("italic"))}><Italic className="h-4 w-4" /></ToolbarBtn>
          <ToolbarBtn title="Underline" onClick={() => focusEditorInAndRun(editorRef.current, () => execInline("underline"))}><Underline className="h-4 w-4" /></ToolbarBtn>
          <ToolbarBtn title="Strikethrough" onClick={() => focusEditorInAndRun(editorRef.current, () => execInline("strikeThrough"))}><Strikethrough className="h-4 w-4" /></ToolbarBtn>
          <div className="relative">
            <ToolbarBtn
              title="Highlight"
              onClick={() => setShowHl((v) => !v)}
            ><Highlighter className="h-4 w-4" style={{ color: showHl ? "#facc15" : undefined }} /></ToolbarBtn>
            {showHl && (
              <div className="absolute left-0 top-9 z-20 flex gap-1 rounded-xl border border-black/10 bg-card p-1.5 shadow-xl dark:border-white/10">
                {HL_COLORS.map((c) => (
                  <button
                    key={c.value}
                    title={c.name}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      focusEditorInAndRun(editorRef.current, () => document.execCommand("hiliteColor", false, c.value));
                      setShowHl(false);
                    }}
                    className="h-5 w-5 rounded-full border border-black/20 transition-transform hover:scale-125"
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
          <ToolbarBtn title="Bullet list" onClick={() => focusEditorInAndRun(editorRef.current, () => execInline("insertUnorderedList"))}><List className="h-4 w-4" /></ToolbarBtn>
          <ToolbarBtn title="Numbered list" onClick={() => focusEditorInAndRun(editorRef.current, () => execInline("insertOrderedList"))}><ListOrdered className="h-4 w-4" /></ToolbarBtn>
          <ToolbarBtn
              title="Quote"
              onClick={() =>
                focusEditorInAndRun(editorRef.current, () => {
                  document.execCommand("formatBlock", false, "blockquote");
                })
              }
            ><Quote className="h-4 w-4" /></ToolbarBtn>
          <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
          <ToolbarBtn title="Clear formatting" onClick={() => focusEditorInAndRun(editorRef.current, () => execInline("removeFormat"))}><Eraser className="h-4 w-4" /></ToolbarBtn>
          <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
          <button
            type="button"
            title={voiceTyping ? "Stop voice typing" : "Voice type (speech-to-text)"}
            onClick={toggleVoiceTyping}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
              voiceTyping
                ? "bg-red-500/15 text-red-500 animate-pulse"
                : "text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            }`}
          >
            {voiceTyping ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        </div>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => setContent((e.target as HTMLDivElement).innerText)}
          data-placeholder={t("write_reflection_placeholder")}
          className="min-h-[360px] w-full flex-1 resize-none overflow-y-auto rounded-[24px] bg-muted/50 p-6 text-[17px] leading-relaxed outline-none focus:ring-2 focus:ring-ring empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50"
        />
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("characters_private", { count: String(content.length) })}
          </p>
          <Button
            size="lg"
            loading={saveMutation.isPending}
            disabled={!content.trim() && !selectedEntry}
            onClick={() => saveMutation.mutate()}
          >
            {selectedEntry && saveMutation.isSuccess ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {selectedEntry ? t("update_reflection") : t("save_reflection")}
          </Button>
        </div>
      </div>

      {/* RIGHT SIDEBAR: entry list + types */}
      <aside className="glass h-fit rounded-[22px] p-4 lg:sticky lg:top-2">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("entries_for_day", { count: String(entriesForDate.length) })}</p>
          <NewEntryPopover onSelect={onCreateEntry} />
        </div>
        <div className="space-y-1.5">
          {entriesForDate.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">{t("no_entries_for_day")}</p>
          )}
          {entriesForDate.map((entry) => {
            const isActive = entry.id === selectedEntryId;
            const entryType = ENTRY_TYPES.find((et) => et.value === entry.entry_type);
            const Icon = entryType?.icon ?? MoreHorizontal;
            return (
              <div
                key={entry.id}
                className={cn(
                  "group flex items-center gap-1 rounded-xl px-1 py-1 transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "hover:bg-black/5 dark:hover:bg-white/10",
                )}
              >
                <button
                  onClick={() => onSelectEntry(entry.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {entry.title || t("untitled_entry")}
                  </span>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 rounded-full text-destructive hover:text-destructive/80"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(t("confirm_delete_entry"))) {
                      deleteMutation.mutate(entry.id);
                    }
                  }}
                  aria-label={t("delete_entry")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function NewEntryPopover({ onSelect }: { onSelect: (type: string) => void }) {
  const [open, setOpen] = useState(false);
  const { t } = useLang();

  return (
    <div className="relative">
      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => setOpen((v) => !v)} aria-label={t("new_entry")}>
        <Plus className="h-4 w-4" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-20 w-48 rounded-xl border border-black/10 bg-card p-1.5 shadow-xl dark:border-white/10">
            {ENTRY_TYPES.map((et) => (
              <button
                key={et.value}
                onClick={() => { onSelect(et.value); setOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              >
                <et.icon className="h-4 w-4 text-muted-foreground" />
                {t("entry_type_" + et.value)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function JournalPage() {
  const today = useMemo(() => localDateString(new Date()), []);
  const [viewDate, setViewDate] = useState(today);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [saveCounter, setSaveCounter] = useState(0);
  const { t } = useLang();

  const queryClient = useQueryClient();

  const monthQuery = useQuery({
    queryKey: ["journal-month", viewDate],
    queryFn: () =>
      apiGet<JournalEntry[]>(
        `/journal?month=${Number(viewDate.slice(5, 7))}&year=${Number(viewDate.slice(0, 4))}&limit=200`,
      ),
  });

  const dateQuery = useQuery({
    queryKey: ["journal-date", viewDate],
    queryFn: () =>
      apiGet<JournalEntry[]>(
        `/journal?entry_date=${viewDate}`,
      ),
  });

  const allEntries = monthQuery.data ?? [];
  const entriesForDate = allEntries.filter((e) => e.entry_date === viewDate);
  const entryForDate = entriesForDate.find((e) => e.id === selectedEntryId) ?? entriesForDate[0] ?? dateQuery.data?.find((e) => e.entry_date === viewDate);

  const shiftDay = (delta: number) => {
    const d = new Date(`${viewDate}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setViewDate(localDateString(d));
    setSelectedEntryId(null);
  };

  const handleSelectEntry = (id: string | null) => {
    setSelectedEntryId(id);
  };

  const handleCreateEntry = (type: string) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newEntry: JournalEntry = {
      id: tempId,
      title: "",
      content: "",
      entry_date: viewDate,
      mood: null,
      tags: [],
      favorite: false,
      private: true,
      created_at: new Date().toISOString(),
      entry_type: type,
    };
    queryClient.setQueryData<JournalEntry[]>(["journal-month", viewDate], (old = []) => [newEntry, ...old]);
    queryClient.setQueryData<JournalEntry[]>(["journal-date", viewDate], (old = []) => [newEntry, ...old]);
    setSelectedEntryId(newEntry.id);
  };

  const handleSaveSuccess = () => {
    setSaveCounter((c) => c + 1);
  };

  const handleDeleteEntry = (id: string) => {
    if (selectedEntryId === id) {
      setSelectedEntryId(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center gap-3">
        <img 
          src="/images/beemuna-logo.png"
          alt="Beemuna" 
          className="h-10 w-10 md:h-12 md:w-12 rounded-2xl shadow-lg shadow-primary/20 border border-white/20"
        />
        <div>
          <h1 className="text-4xl font-bold">{t("reflection")}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{t("journal_subtitle")}</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
      >
        <EntryEditor
          key={viewDate + "-" + (selectedEntryId ?? "new") + "-" + saveCounter}
          viewDate={viewDate}
          initialEntry={entryForDate}
          onShiftDay={shiftDay}
          selectedEntryId={selectedEntryId}
          onSelectEntry={handleSelectEntry}
          onCreateEntry={handleCreateEntry}
          onDeleteEntry={handleDeleteEntry}
          onSaveSuccess={handleSaveSuccess}
          entriesForDate={entriesForDate}
          saveCounter={saveCounter}
        />
      </motion.div>
    </div>
  );
}
