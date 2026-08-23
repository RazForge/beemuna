"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Plus, Upload, Search, Trash2, FileUp, Globe, StickyNote, X,
  Loader2, Sparkles, Network, BookOpen, FileText,
  BrainCircuit, Lightbulb, Headphones, Download, PanelLeft,
} from "lucide-react";
import { toast } from "sonner";

interface KnowledgeSpace { id: string; name: string; description: string | null; archived: boolean; created_at: string; }
interface Source { id: string; knowledge_space_id: string; type: string; title: string; filename: string | null; size_bytes: number | null; status: string; error_message: string | null; web_url: string | null; meta: Record<string, unknown>; }
interface Chunk { id: string; content: string; chunk_index: number; token_count: number | null; source_id: string; }
interface SearchHit { chunk: Chunk; source: Source; score: number; }
interface MindMapNode { label: string; children?: MindMapNode[]; }
interface MindMapData { topic: string; subtopics: MindMapNode[]; }

const dot: Record<string, string> = { ready: "bg-emerald-500", processing: "bg-amber-500 animate-pulse", uploading: "bg-amber-500 animate-pulse", empty: "bg-zinc-300", error: "bg-red-500" };
const COLORS = ["#4285f4", "#34a853", "#fbbc04", "#ea4335", "#a142f4", "#fa903e", "#24c1e0", "#f538a0", "#1a73e8", "#0d652d"];

function MindMapSVG({ data, expandedBranches, onToggleBranch }: { data: MindMapData; expandedBranches: Set<number>; onToggleBranch: (i: number) => void }) {
  const W = 900, H = 440;
  const CX = W / 2, ROOT_Y = 36;
  const BRANCH_GAP = W / (data.subtopics.length + 1);
  const BRANCH_Y = 130;
  const LEAF_Y = 240;

  const subs = data.subtopics.map((sub, i) => {
    const bx = BRANCH_GAP * (i + 1);
    const isExpanded = expandedBranches.has(i);
    const kids = isExpanded ? (sub.children ?? []).map((child, j) => {
      const childCount = sub.children?.length ?? 1;
      const spread = 72;
      return { child, x: bx + (j - (childCount - 1) / 2) * spread, y: LEAF_Y, c: COLORS[(i + j + 1) % 10] };
    }) : [];
    return { sub, x: bx, y: BRANCH_Y, kids, c: COLORS[i % 10], isExpanded, childCount: sub.children?.length ?? 0 };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" className="select-none" style={{ maxWidth: W, maxHeight: H }}>
      <defs>
        {COLORS.map((c, i) => (
          <linearGradient key={i} id={`tg${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity="0.25" />
            <stop offset="100%" stopColor={c} stopOpacity="0.05" />
          </linearGradient>
        ))}
        <filter id="ts" x="-5%" y="-5%" width="110%" height="115%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.06" />
        </filter>
      </defs>

      {/* Lines from root to branches */}
      {subs.map((b, i) => (
        <path key={`rl${i}`} d={`M${CX},${ROOT_Y + 16} C${CX},${(ROOT_Y + 16 + b.y) / 2} ${b.x},${(ROOT_Y + 16 + b.y) / 2} ${b.x},${b.y - 14}`}
          fill="none" stroke={b.c} strokeWidth="2" strokeOpacity="0.35" strokeLinecap="round" />
      ))}

      {/* Lines from expanded branches to leaves */}
      {subs.map((b, i) => b.isExpanded && b.kids.map((k, j) => (
        <path key={`bl${i}${j}`} d={`M${b.x},${b.y + 14} C${b.x},${(b.y + k.y) / 2} ${k.x},${(b.y + k.y) / 2} ${k.x},${k.y - 10}`}
          fill="none" stroke={k.c} strokeWidth="1.5" strokeOpacity="0.25" strokeLinecap="round" />
      )))}

      {/* Leaf nodes (only for expanded branches) */}
      {subs.map((b, i) => b.isExpanded && b.kids.map((k, j) => (
        <g key={`k${i}${j}`} filter="url(#ts)">
          <rect x={k.x - 36} y={k.y - 10} width={72} height={20} rx={10} fill={`url(#tg${(i + j + 1) % 10})`} stroke={k.c} strokeWidth="1" strokeOpacity="0.4" />
          <text x={k.x} y={k.y + 1} textAnchor="middle" dominantBaseline="central" className="fill-foreground pointer-events-none" fontSize="8.5" fontWeight="500">
            {k.child.label.length > 11 ? k.child.label.slice(0, 9) + "…" : k.child.label}
          </text>
        </g>
      )))}

      {/* Branch nodes */}
      {subs.map((b, i) => (
        <g key={`b${i}`} filter="url(#ts)" className="cursor-pointer" onClick={() => onToggleBranch(i)}>
          <rect x={b.x - 44} y={b.y - 14} width={88} height={28} rx={14} fill={`url(#tg${i})`} stroke={b.c} strokeWidth="1.5" strokeOpacity={b.isExpanded ? "0.7" : "0.5"} />
          <text x={b.x} y={b.y + 1} textAnchor="middle" dominantBaseline="central" className="fill-foreground pointer-events-none" fontSize="10" fontWeight="600">
            {b.sub.label.length > 12 ? b.sub.label.slice(0, 10) + "…" : b.sub.label}
          </text>
          {b.childCount > 0 && !b.isExpanded && (
            <g>
              <circle cx={b.x + 36} cy={b.y} r={7} fill={b.c} fillOpacity="0.3" />
              <text x={b.x + 36} y={b.y + 1} textAnchor="middle" dominantBaseline="central" className="fill-foreground pointer-events-none" fontSize="8" fontWeight="700">{b.childCount}</text>
            </g>
          )}
          {b.isExpanded && (
            <g>
              <circle cx={b.x + 36} cy={b.y} r={7} fill={b.c} fillOpacity="0.15" stroke={b.c} strokeWidth="0.8" />
              <line x1={b.x + 33} y1={b.y} x2={b.x + 39} y2={b.y} stroke={b.c} strokeWidth="1.5" />
            </g>
          )}
        </g>
      ))}

      {/* Root node */}
      <rect x={CX - 52} y={ROOT_Y - 12} width={104} height={24} rx={12} fill="#4285f4" fillOpacity="0.15" stroke="#4285f4" strokeWidth="2" strokeOpacity="0.6" />
      <text x={CX} y={ROOT_Y + 1} textAnchor="middle" dominantBaseline="central" className="fill-foreground" fontSize="10" fontWeight="700">
        {data.topic.length > 14 ? data.topic.slice(0, 12) + "…" : data.topic}
      </text>
    </svg>
  );
}

export default function KnowledgePage() {
  const { t } = useLang();
  const qc = useQueryClient();
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeSpace, setActiveSpace] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [spaceDesc, setSpaceDesc] = useState("");
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mindMap, setMindMap] = useState<MindMapData | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [expandedBranches, setExpandedBranches] = useState<Set<number>>(new Set());
  const [mindMapFullscreen, setMindMapFullscreen] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [showSaveNote, setShowSaveNote] = useState(false);
  const [pendingSummary, setPendingSummary] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const spacesQ = useQuery({ queryKey: ["ks"], queryFn: () => apiGet<KnowledgeSpace[]>("/knowledge/spaces") });
  const sourcesQ = useQuery({ queryKey: ["ksrc", activeSpace], queryFn: () => apiGet<Source[]>(`/knowledge/spaces/${activeSpace}/sources`), enabled: !!activeSpace });
  const allChunksQ = useQuery({ queryKey: ["kch", activeSpace], queryFn: () => apiGet<Chunk[]>(`/knowledge/spaces/${activeSpace}/chunks?limit=500`), enabled: !!activeSpace });
  const searchQ = useQuery({ queryKey: ["ksearch", activeSpace, searchQuery], queryFn: () => apiGet<SearchHit[]>(`/knowledge/spaces/${activeSpace}/search?q=${encodeURIComponent(searchQuery)}`), enabled: !!activeSpace && searchQuery.trim().length > 0 });

  const mindMapQ = useQuery({ queryKey: ["mm", activeSpace], queryFn: () => {
    const c = allChunksQ.data?.map(ch => ch.content).join("\n\n") ?? "";
    return apiPost<{ mind_map: MindMapData }>("/ai/mind-map", { space_id: activeSpace, content: c });
  }, enabled: false });

  const summaryQ = useQuery({ queryKey: ["sum", activeSpace], queryFn: () => {
    const c = allChunksQ.data?.map(ch => ch.content).join("\n\n") ?? "";
    return apiPost<{ summary: string }>("/ai/summarize", { space_id: activeSpace, content: c, title: activeData?.name ?? "" });
  }, enabled: false });

  const createSpace = useMutation({ mutationFn: () => apiPost<KnowledgeSpace>("/knowledge/spaces", { name: spaceName, description: spaceDesc || null }),
    onSuccess: (s) => { qc.invalidateQueries({ queryKey: ["ks"] }); setActiveSpace(s.id); setShowCreate(false); setSpaceName(""); setSpaceDesc(""); toast.success(t("kn_space_created")); },
    onError: (e) => toast.error(formatError(e)) });

  const uploadFile = useMutation({ mutationFn: async (f: File) => { const fd = new FormData(); fd.append("file", f); return apiPost<Source>(`/knowledge/spaces/${activeSpace}/sources/upload`, fd); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ksrc"] }); qc.invalidateQueries({ queryKey: ["kch"] }); toast.success(t("kn_source_uploaded")); },
    onError: (e) => toast.error(formatError(e)) });

  const addPaste = useMutation({ mutationFn: () => apiPost<Source>(`/knowledge/spaces/${activeSpace}/sources?title=${encodeURIComponent(pasteTitle)}&source_type=paste&content=${encodeURIComponent(pasteContent)}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ksrc"] }); qc.invalidateQueries({ queryKey: ["kch"] }); setPasteOpen(false); setPasteContent(""); setPasteTitle(""); toast.success(t("kn_source_added")); },
    onError: (e) => toast.error(formatError(e)) });

  const delSpace = useMutation({ mutationFn: (id: string) => apiDelete(`/knowledge/spaces/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ks"] }); setActiveSpace(null); toast.success(t("kn_space_deleted")); } });

  const delSource = useMutation({ mutationFn: (id: string) => apiDelete(`/knowledge/spaces/${activeSpace}/sources/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ksrc"] }); qc.invalidateQueries({ queryKey: ["kch"] }); setSelectedSource(null); toast.success(t("kn_source_deleted")); } });

  function handleUpload(f: File | undefined) { if (!f || !activeSpace) return; if (!/\.(pdf|txt|md|markdown|docx|html|htm|csv|json)$/i.test(f.name)) { toast.error(t("kn_unsupported_format")); return; } uploadFile.mutate(f); }

  function handleGenMap() {
    if (!allChunksQ.data?.length) return;
    setMindMap(null); setSelectedNode(null); setExpandedBranches(new Set());
    mindMapQ.refetch().then(({ data }) => { if (data?.mind_map) setMindMap(data.mind_map); });
  }

  function toggleBranch(i: number) {
    setExpandedBranches(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function handleGenSummary() {
    if (!activeSpace || !allChunksQ.data?.length) return;
    setAiSummary(null);
    summaryQ.refetch().then(({ data }) => {
      if (data?.summary) {
        setPendingSummary(data.summary);
        setShowSaveNote(true);
      }
    });
  }

  function saveNoteAsSource() {
    if (!activeSpace || !pendingSummary) return;
    const title = `Be'emuna Note — ${activeData?.name ?? "Notebook"}`;
    apiPost<Source>(`/knowledge/spaces/${activeSpace}/sources?title=${encodeURIComponent(title)}&source_type=note&content=${encodeURIComponent(pendingSummary)}`).then(() => {
      setAiSummary(pendingSummary);
      qc.invalidateQueries({ queryKey: ["ksrc"] }); qc.invalidateQueries({ queryKey: ["kch"] });
      toast.success("Be'emuna note saved as source");
    }).catch(() => toast.error("Failed to save note"));
    setShowSaveNote(false);
    setPendingSummary(null);
  }

  function dismissNote() {
    setAiSummary(pendingSummary);
    setShowSaveNote(false);
    setPendingSummary(null);
  }

  function handleAudio() {
    if (!aiSummary) return;
    if (audioPlaying) { window.speechSynthesis?.cancel(); setAudioPlaying(false); return; }
    window.speechSynthesis?.cancel();
    const ps = aiSummary.split(/\n{2,}/).filter(p => p.trim());
    let i = 0;
    function next() {
      if (i >= ps.length) { setAudioPlaying(false); return; }
      const u = new SpeechSynthesisUtterance(ps[i++].trim());
      u.rate = 0.82; u.pitch = 1.05; u.volume = 1;
      const vs = window.speechSynthesis?.getVoices?.() ?? [];
      const v = vs.find(v => v.name.includes("Google UK English Female")) || vs.find(v => v.name.includes("Google UK English Male")) || vs.find(v => v.name.includes("Samantha")) || vs.find(v => v.name.includes("Karen")) || vs.find(v => v.name.includes("Daniel")) || vs.find(v => v.name.includes("Microsoft Zira")) || vs.find(v => v.lang.startsWith("en-US")) || vs.find(v => v.lang.startsWith("en"));
      if (v) u.voice = v;
      u.onend = () => setTimeout(next, 400);
      u.onerror = () => setAudioPlaying(false);
      window.speechSynthesis?.speak(u);
    }
    setAudioPlaying(true); next();
  }

  function downloadMindMap() {
    if (!mindMap) return;
    const svg = document.querySelector('[data-mindmap] svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${mindMap.topic}-mindmap.svg`; a.click(); URL.revokeObjectURL(url);
  }

  const activeData = spacesQ.data?.find(s => s.id === activeSpace);
  const srcCount = sourcesQ.data?.length ?? 0;

  return (
    <div className="mx-auto flex h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)] max-w-7xl flex-col gap-3 md:gap-4">

      {/* Header */}
      <header className="rounded-3xl border border-border/50 bg-card p-3 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSidebar(!showSidebar)} className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
              {showSidebar ? <X className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">Knowledge</h1>
              <p className="text-muted-foreground text-xs hidden md:block">AI-powered notebook — upload sources, generate notes, mind maps & audio</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-9 rounded-full px-4 shadow-md text-xs" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New Notebook
            </Button>
          </div>
        </div>
        {activeData && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <span className="h-7 rounded-full bg-primary text-primary-foreground px-3 text-[11px] font-semibold flex items-center gap-1.5 shadow-md">
              <BookOpen className="h-3 w-3" /> {activeData.name}
              <button onClick={() => { setActiveSpace(null); setMindMap(null); setAiSummary(null); setSelectedSource(null); setSelectedNode(null); setExpandedBranches(new Set()); }} className="ml-0.5 hover:bg-primary-foreground/20 rounded-full p-0.5"><X className="h-2.5 w-2.5" /></button>
            </span>
            <button onClick={() => { if (confirm(`Delete notebook "${activeData.name}"? This cannot be undone.`)) delSpace.mutate(activeData.id); }}
              className="h-7 rounded-full bg-destructive/10 text-destructive px-3 text-[11px] font-medium flex items-center gap-1 hover:bg-destructive/20 transition-colors">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
            <span className="h-7 rounded-full bg-muted px-3 text-[11px] font-medium flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${srcCount > 0 ? "bg-emerald-500" : "bg-zinc-300"}`} /> {srcCount} source{srcCount !== 1 ? "s" : ""}
            </span>
            {aiSummary && <span className="h-7 rounded-full bg-primary/10 text-primary px-3 text-[11px] font-medium flex items-center gap-1"><Sparkles className="h-3 w-3" /> Be'emuna Note ready</span>}
            {mindMap && <span className="h-7 rounded-full bg-blue-500/10 text-blue-600 px-3 text-[11px] font-medium flex items-center gap-1"><Network className="h-3 w-3" /> Mind Map ready</span>}
          </div>
        )}
      </header>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-3xl border border-border/50 shadow-2xl p-6 w-96">
            <h3 className="text-sm font-bold mb-4">Create Notebook</h3>
            <div className="flex flex-col gap-3">
              <Input placeholder="Notebook name" value={spaceName} onChange={e => setSpaceName(e.target.value)} className="rounded-xl h-10" />
              <Input placeholder="Description (optional)" value={spaceDesc} onChange={e => setSpaceDesc(e.target.value)} className="rounded-xl h-10" />
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="rounded-full h-9 flex-1 shadow-md" loading={createSpace.isPending} onClick={() => createSpace.mutate()}>Create</Button>
                <Button size="sm" variant="outline" className="rounded-full h-9" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      {!activeSpace ? (
        <div className="flex-1 rounded-3xl border border-border/50 bg-card flex flex-col items-center justify-center text-muted-foreground gap-3">
          <BookOpen className="h-16 w-16 opacity-15" />
          <div className="text-center">
            <p className="text-sm font-semibold">Select a notebook</p>
            <p className="text-xs mt-1">Or create a new one to get started</p>
          </div>
          {spacesQ.data && spacesQ.data.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {spacesQ.data.map(s => (
                <button key={s.id} onClick={() => { setActiveSpace(s.id); }}
                  className="h-8 rounded-full bg-muted hover:bg-accent px-4 text-xs font-medium transition-colors">
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex gap-3 md:gap-4 overflow-hidden min-h-0">

          {/* Sidebar overlay */}
          {showSidebar && <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden" onClick={() => setShowSidebar(false)} />}

          {/* Sources sidebar */}
          <div className={cn(
            "space-y-1.5 overflow-y-auto rounded-2xl border border-border/50 bg-card p-2 shrink-0",
            "fixed md:relative inset-y-0 left-0 z-50 w-64 md:w-52 md:shrink-0 pt-16 md:pt-0 transition-transform duration-200",
            showSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          )}>
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.markdown,.docx,.html,.htm,.csv,.json" className="hidden" onChange={e => { handleUpload(e.target.files?.[0]); e.target.value = ""; }} />
              <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px] flex-1" onClick={() => fileRef.current?.click()} loading={uploadFile.isPending}>
                <Upload className="h-3 w-3 mr-1" /> Upload
              </Button>
              <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px] flex-1" onClick={() => setPasteOpen(!pasteOpen)}>
                <StickyNote className="h-3 w-3 mr-1" /> Paste
              </Button>
            </div>
            {pasteOpen && (
              <div className="rounded-xl border border-border/50 bg-accent/30 p-2.5 mb-1.5">
                <input placeholder="Title" value={pasteTitle} onChange={e => setPasteTitle(e.target.value)} className="w-full text-xs font-medium bg-transparent border-0 outline-none placeholder:text-muted-foreground mb-1.5" />
                <textarea placeholder="Paste content…" value={pasteContent} onChange={e => setPasteContent(e.target.value)} className="min-h-20 w-full bg-transparent border-0 outline-none resize-none text-[11px] leading-relaxed placeholder:text-muted-foreground" />
                <div className="flex gap-1.5 mt-2">
                  <Button size="sm" className="rounded-full h-6 text-[10px] flex-1" disabled={!pasteTitle.trim() || !pasteContent.trim()} loading={addPaste.isPending} onClick={() => addPaste.mutate()}>Add</Button>
                  <Button size="sm" variant="ghost" className="rounded-full h-6 text-[10px]" onClick={() => setPasteOpen(false)}>Cancel</Button>
                </div>
              </div>
            )}
            <div className="relative mb-1.5">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input placeholder="Search sources…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 rounded-xl bg-muted/50 border-0 text-[11px] outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/30" />
            </div>
            {sourcesQ.data?.map(s => (
              <div key={s.id} onClick={() => { setSelectedSource(s); setMindMap(null); setSelectedNode(null); setShowSidebar(false); }}
                className={cn("group flex items-center gap-2.5 rounded-xl px-2.5 py-2 cursor-pointer transition-all duration-150",
                  selectedSource?.id === s.id ? "bg-primary/10 text-primary shadow-sm" : "hover:bg-white/40 dark:hover:bg-white/[0.06]")}>
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", selectedSource?.id === s.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                  {s.type === "web" ? <Globe className="h-3.5 w-3.5" /> : s.type === "paste" ? <StickyNote className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold truncate">{s.title}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${dot[s.status] ?? "bg-zinc-300"}`} />
                    <span className="text-[9px] text-muted-foreground">{s.type}</span>
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); delSource.mutate(s.id); }} className="hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"><X className="h-3 w-3" /></button>
              </div>
            ))}
            {searchQ.data?.map(h => (
              <div key={h.chunk.id} onClick={() => { setSelectedSource(h.source); setMindMap(null); setSelectedNode(null); }}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 cursor-pointer hover:bg-white/40 dark:hover:bg-white/[0.06]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500"><Search className="h-3.5 w-3.5" /></span>
                <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold truncate">{h.source.title}</p><p className="text-[9px] text-muted-foreground truncate">{h.chunk.content.slice(0, 60)}</p></div>
                <span className="text-[9px] text-muted-foreground font-medium">{(h.score * 100).toFixed(0)}%</span>
              </div>
            ))}
            {!sourcesQ.data?.length && !searchQuery && <p className="text-[10px] text-muted-foreground text-center py-6">No sources yet</p>}
          </div>

          {/* Center: Be'emuna Note */}
          <div className="flex-1 rounded-2xl border border-border/50 bg-card flex flex-col overflow-hidden min-w-0">
            <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">Be'emuna Note</h3>
              <span className="text-[10px] text-muted-foreground font-medium">— {activeData?.name}</span>
              <div className="flex-1" />
              <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px] px-3" onClick={handleGenSummary} disabled={summaryQ.isFetching || !allChunksQ.data?.length}>
                {summaryQ.isFetching ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                {aiSummary ? "Regenerate" : "Generate Note"}
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {summaryQ.isFetching && !aiSummary ? (
                <div className="flex flex-col items-center gap-3 py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground font-medium">Analyzing {allChunksQ.data?.length ?? 0} chunks from {srcCount} source{srcCount !== 1 ? "s" : ""}…</p>
                </div>
              ) : aiSummary ? (
                <div className="max-w-xl mx-auto text-[13px] leading-relaxed text-foreground/85 whitespace-pre-line">{aiSummary}</div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                  <Lightbulb className="h-12 w-12 opacity-15" />
                  <p className="text-xs font-medium">Generate an Be'emuna note from all {srcCount} source{srcCount !== 1 ? "s" : ""}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Studio */}
          <div className="w-72 shrink-0 rounded-2xl border border-border/50 bg-card flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">Studio</h3>
            </div>
            <div className="p-3 border-b border-border/50 grid grid-cols-2 gap-2">
              <button onClick={handleGenMap} disabled={!allChunksQ.data?.length || mindMapQ.isFetching}
                className={cn("flex flex-col items-center gap-1.5 rounded-2xl border border-border/50 bg-background p-3 hover:bg-accent/40 transition-all disabled:opacity-30 group",
                  mindMap && "ring-2 ring-blue-500/20 bg-blue-500/5")}>
                {mindMapQ.isFetching ? <Loader2 className="h-5 w-5 text-blue-500 animate-spin" /> : <Network className="h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform" />}
                <span className="text-[10px] font-semibold">Mind Map</span>
              </button>
              <button onClick={handleAudio} disabled={!aiSummary}
                className={cn("flex flex-col items-center gap-1.5 rounded-2xl border border-border/50 bg-background p-3 hover:bg-accent/40 transition-all disabled:opacity-30 group",
                  audioPlaying && "ring-2 ring-emerald-500/20 bg-emerald-500/5")}>
                {audioPlaying ? <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" /> : <Headphones className="h-5 w-5 text-emerald-500 group-hover:scale-110 transition-transform" />}
                <span className="text-[10px] font-semibold">{audioPlaying ? "Stop" : "Audio"}</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3" data-mindmap>
              {mindMapQ.isFetching && !mindMap ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  <p className="text-[10px] text-muted-foreground font-medium">Generating…</p>
                </div>
              ) : mindMap ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold flex items-center gap-1"><Network className="h-3 w-3 text-blue-500" /> {mindMap.topic}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0 rounded-full" onClick={downloadMindMap} title="Download SVG"><Download className="h-3 w-3" /></Button>
                      <button onClick={() => { setMindMap(null); setSelectedNode(null); }} className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-accent"><X className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all" onClick={() => setMindMapFullscreen(true)}>
                    <MindMapSVG data={mindMap} expandedBranches={expandedBranches} onToggleBranch={toggleBranch} />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                  <Lightbulb className="h-8 w-8 opacity-20" />
                  <p className="text-[10px] text-center font-medium">Click Mind Map to generate from all sources</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Note Confirmation Modal */}
      {showSaveNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-3xl border border-border/50 shadow-2xl p-6 w-96">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-bold">Save Be'emuna Note?</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Save this AI-generated note as a source in your notebook? You can reference it anytime.</p>
            <div className="rounded-xl bg-accent/30 p-3 mb-4 max-h-32 overflow-y-auto">
              <p className="text-[11px] text-foreground/80 whitespace-pre-line line-clamp-6">{pendingSummary?.slice(0, 300)}{pendingSummary && pendingSummary.length > 300 ? "…" : ""}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="rounded-full h-8 flex-1 shadow-md text-xs" onClick={saveNoteAsSource}>
                <Plus className="h-3 w-3 mr-1" /> Save as Source
              </Button>
              <Button size="sm" variant="outline" className="rounded-full h-8 text-xs" onClick={dismissNote}>
                Just View
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mind Map Fullscreen Modal */}
      {mindMapFullscreen && mindMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setMindMapFullscreen(false)}>
          <div className="relative w-[92vw] h-[85vh] max-w-6xl bg-card rounded-3xl border border-border/50 shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5 text-blue-500" />
                <h2 className="text-base font-bold">{mindMap.topic}</h2>
                <span className="text-xs text-muted-foreground">— {mindMap.subtopics.length} subtopics</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={downloadMindMap}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download SVG
                </Button>
                <button onClick={() => setMindMapFullscreen(false)} className="h-8 w-8 rounded-full hover:bg-accent flex items-center justify-center">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-4">
              <div className="w-full h-full flex items-center justify-center" data-mindmap-full>
                <MindMapSVG data={mindMap} expandedBranches={expandedBranches} onToggleBranch={toggleBranch} />
              </div>
            </div>
            {selectedNode && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-sm shadow-lg px-5 py-3 max-w-sm">
                <p className="text-sm font-bold text-primary">{selectedNode}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mindMap.subtopics.find(s => s.label === selectedNode)?.children?.length ?? 0} sub-concepts
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
