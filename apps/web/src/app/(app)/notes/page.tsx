"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { formatError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Folder, FileText, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

interface NoteFolder {
  id: string;
  name: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  updated_at: string;
}

export default function NotesPage() {
  const queryClient = useQueryClient();
  const { t } = useLang();
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [folderDraft, setFolderDraft] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const foldersQuery = useQuery({
    queryKey: ["note-folders"],
    queryFn: () => apiGet<NoteFolder[]>("/notes/folders"),
  });

  const notesQuery = useQuery({
    queryKey: ["notes", activeFolder],
    queryFn: () => apiGet<Note[]>(`/notes?limit=100${activeFolder ? `&folder_id=${activeFolder}` : ""}`),
  });

  const createFolder = useMutation({
    mutationFn: () => apiPost<NoteFolder>("/notes/folders", { name: folderDraft }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note-folders"] });
      setFolderDraft("");
      toast.success(t("folder_created"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const createNote = useMutation({
    mutationFn: () =>
      apiPost<Note>("/notes", {
        title: t("untitled_note"),
        content: "",
        folder_id: activeFolder || null,
      }),
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-timeline"] });
      setActiveNoteId(n.id);
      setNoteTitle(n.title);
      setNoteContent(n.content);
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const saveNote = useMutation({
    mutationFn: () =>
      apiPatch<Note>(`/notes/${activeNoteId}`, {
        title: noteTitle,
        content: noteContent,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success(t("note_saved"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const deleteNote = useMutation({
    mutationFn: (id: string) => apiDelete(`/notes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      if (activeNoteId) setActiveNoteId(null);
      toast.success(t("note_deleted"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  function selectNote(n: Note) {
    setActiveNoteId(n.id);
    setNoteTitle(n.title);
    setNoteContent(n.content);
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6 overflow-hidden">
      {/* Folders column */}
      <div className="w-56 shrink-0 flex flex-col gap-3 overflow-y-auto rounded-[22px] bg-card p-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04)]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("folders")}</h2>
        <button
          onClick={() => { setActiveFolder(null); setActiveNoteId(null); }}
          className={cn(
            "flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors",
            activeFolder === null ? "bg-primary/10 text-primary" : "hover:bg-accent text-foreground"
          )}
        >
          <Folder className="h-4 w-4" /> {t("all_notes")}
        </button>

        {foldersQuery.data?.map((f) => (
          <button
            key={f.id}
            onClick={() => { setActiveFolder(f.id); setActiveNoteId(null); }}
            className={cn(
              "flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors",
              activeFolder === f.id ? "bg-primary/10 text-primary" : "hover:bg-accent text-foreground"
            )}
          >
            <Folder className="h-4 w-4" /> {f.name}
          </button>
        ))}

        <div className="mt-auto pt-4 flex gap-1">
          <Input
            placeholder={t("new_folder_placeholder")}
            value={folderDraft}
            onChange={(e) => setFolderDraft(e.target.value)}
            className="h-9 px-3 text-xs"
          />
          <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => createFolder.mutate()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Notes list column */}
      <div className="w-64 shrink-0 flex flex-col gap-3 overflow-y-auto rounded-[22px] bg-card p-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("notes")}</h2>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => createNote.mutate()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          {notesQuery.data?.map((n) => (
            <div
              key={n.id}
              onClick={() => selectNote(n)}
              className={cn(
                "group relative flex cursor-pointer flex-col gap-1 rounded-xl p-3 text-left transition-colors",
                activeNoteId === n.id ? "bg-primary/10 text-primary" : "hover:bg-accent"
              )}
            >
              <p className="pr-6 text-sm font-semibold truncate">{n.title || t("untitled")}</p>
              <p className="text-xs text-muted-foreground truncate">{n.content || t("empty_content")}</p>
              <button
                onClick={(e) => { e.stopPropagation(); deleteNote.mutate(n.id); }}
                className="absolute right-2 top-3 hidden text-muted-foreground hover:text-destructive group-hover:block"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {notesQuery.data?.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">{t("no_notes_in_folder")}</p>
          )}
        </div>
      </div>

      {/* Editor column */}
      <div className="flex-1 flex flex-col rounded-[22px] bg-card p-6 shadow-[0_0_0_0.5px_rgba(0,0,0,0.04)] overflow-hidden">
        {activeNoteId ? (
          <div className="flex flex-1 flex-col gap-4 overflow-hidden">
            <input
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder={t("note_title_placeholder")}
              className="bg-transparent text-2xl font-bold placeholder:text-muted-foreground/40 focus:outline-none"
            />
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder={t("start_writing")}
              className="flex-1 w-full resize-none bg-transparent text-[15px] leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none"
            />
            <div className="flex justify-end gap-2 border-t border-black/5 dark:border-white/5 pt-4">
              <Button size="sm" loading={saveNote.isPending} onClick={() => saveNote.mutate()}>
                {saveNote.isSuccess ? <Check className="h-4 w-4" /> : t("save")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground gap-2">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-sm">{t("select_or_create_note")}</p>
          </div>
        )}
      </div>
    </div>
  );
}