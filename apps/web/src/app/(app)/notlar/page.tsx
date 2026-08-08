"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, uploadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { MediaAsset, Note } from "@/lib/types";
import { BookIcon, DownloadIcon, PlusIcon, SearchIcon, StarIcon } from "@/components/icons";
import {
  Avatar,
  Button,
  EmptyState,
  Input,
  Modal,
  Select,
  Skeleton,
  Spinner,
  Textarea,
  cx,
  formatCount,
  timeAgo,
  useToast,
} from "@/components/ui";

const SCOPES = [
  { key: "ALL", label: "Tümü" },
  { key: "UNIVERSITY", label: "Üniversitem" },
  { key: "MINE", label: "Yüklediklerim" },
] as const;

export default function NotesPage() {
  const [scope, setScope] = useState<(typeof SCOPES)[number]["key"]>("ALL");
  const [sort, setSort] = useState<"NEW" | "TOP" | "DOWNLOADS">("NEW");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope, sort, limit: "30" });
      if (query.trim()) params.set("q", query.trim());
      const data = await api.get<{ items: Note[] }>(`/notes?${params}`);
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [scope, sort, query]);

  useEffect(() => {
    const t = setTimeout(() => void load(), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  return (
    <div className="mx-auto w-full max-w-[680px] space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-black tracking-tight">Ders Notları</h1>
          <p className="mt-1 text-[14px] text-muted">
            Kendi notunu paylaş, başkalarının notlarından faydalan
          </p>
        </div>
        <Button icon={<PlusIcon width={17} height={17} />} onClick={() => setUploadOpen(true)}>
          <span className="hidden sm:inline">Not yükle</span>
        </Button>
      </header>

      <div className="relative">
        <SearchIcon
          width={18}
          height={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ders adı veya kodu ara (örn. MATH219)"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] py-2.5 pl-10 pr-4 text-[15px] outline-none focus-ring focus:border-[var(--brand)]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            onClick={() => setScope(s.key)}
            className={cx(
              "rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors",
              scope === s.key ? "bg-[var(--brand)] text-white" : "surface-subtle text-muted",
            )}
          >
            {s.label}
          </button>
        ))}
        <span className="flex-1" />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 text-[13px] font-medium"
        >
          <option value="NEW">En yeni</option>
          <option value="TOP">En beğenilen</option>
          <option value="DOWNLOADS">En çok indirilen</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BookIcon width={26} height={26} />}
          title={query ? "Sonuç bulunamadı" : "Henüz not yok"}
          description="İlk notu sen yükle — arkadaşların sana minnettar olacak."
          action={
            <Button onClick={() => setUploadOpen(true)} icon={<PlusIcon width={17} height={17} />}>
              Not yükle
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((note) => (
            <NoteCard key={note.id} note={note} onChange={load} />
          ))}
        </div>
      )}

      <UploadNoteModal open={uploadOpen} onClose={() => setUploadOpen(false)} onCreated={load} />
    </div>
  );
}

function NoteCard({ note, onChange }: { note: Note; onChange: () => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(note.viewer?.myRating ?? null);
  const [avg, setAvg] = useState(note.ratingAvg);
  const [count, setCount] = useState(note.ratingCount);

  async function rate(value: number) {
    try {
      const result = await api.post<{ myRating: number; ratingAvg: number; ratingCount: number }>(
        `/notes/${note.id}/rate`,
        { rating: value },
      );
      setRating(result.myRating);
      setAvg(result.ratingAvg);
      setCount(result.ratingCount);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Puan verilemedi", "error");
    }
  }

  async function download() {
    try {
      const result = await api.post<{ files: MediaAsset[] }>(`/notes/${note.id}/download`);
      for (const file of result.files) window.open(file.url, "_blank", "noopener");
      onChange();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "İndirilemedi", "error");
    }
  }

  async function remove() {
    if (!confirm("Not silinsin mi?")) return;
    await api.delete(`/notes/${note.id}`).catch(() => undefined);
    onChange();
  }

  return (
    <article className="surface rounded-[var(--radius-card)] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl brand-soft-bg brand-text">
          <BookIcon width={20} height={20} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {note.courseCode && (
              <span className="rounded-md brand-soft-bg px-1.5 py-0.5 font-mono text-[11.5px] font-bold brand-text">
                {note.courseCode}
              </span>
            )}
            <h3 className="text-[15.5px] font-bold leading-snug">{note.title}</h3>
          </div>

          <p className="mt-0.5 text-[13px] text-muted">
            {note.courseName}
            {note.department ? ` · ${note.department}` : ""}
          </p>

          {note.description && (
            <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-muted">
              {note.description}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-faint">
            <Link href={`/u/${note.uploader.username}`} className="flex items-center gap-1.5 hover:underline">
              <Avatar src={note.uploader.avatarUrl} name={note.uploader.displayName} size="xs" />
              {note.uploader.displayName}
            </Link>
            {note.university && <span>{note.university.shortName}</span>}
            <span>{timeAgo(note.createdAt)}</span>
            <span className="flex items-center gap-1">
              <DownloadIcon width={13} height={13} />
              {formatCount(note.downloadCount)}
            </span>
            <span>{note.files.length} dosya</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => rate(star)}
                  title={`${star} yıldız`}
                  className={cx(
                    "transition-colors",
                    (rating ?? 0) >= star ? "text-amber-400" : "text-[var(--border-strong)]",
                  )}
                >
                  <StarIcon width={16} height={16} filled={(rating ?? 0) >= star} />
                </button>
              ))}
              <span className="ml-1.5 text-[12.5px] text-muted">
                {avg > 0 ? `${avg.toFixed(1)} (${count})` : "puanlanmamış"}
              </span>
            </div>

            <span className="flex-1" />

            {note.viewer?.canDelete && (
              <button onClick={remove} className="text-[13px] font-medium text-faint hover:text-rose-500">
                Sil
              </button>
            )}
            <Button size="sm" onClick={download} icon={<DownloadIcon width={15} height={15} />}>
              İndir
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function UploadNoteModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [courseName, setCourseName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"UNIVERSITY" | "GLOBAL">("UNIVERSITY");
  const [files, setFiles] = useState<MediaAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true);
    try {
      const uploads = await Promise.all(Array.from(list).slice(0, 10).map((f) => uploadFile(f)));
      setFiles((current) => [...current, ...uploads].slice(0, 10));
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Dosya yüklenemedi", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    setBusy(true);
    try {
      await api.post("/notes", {
        title: title.trim(),
        courseName: courseName.trim(),
        description: description.trim() || undefined,
        department: user?.department,
        visibility,
        files,
      });
      toast.show("Not paylaşıldı, teşekkürler! 📚", "success");
      onCreated();
      onClose();
      setTitle("");
      setCourseName("");
      setDescription("");
      setFiles([]);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Not yüklenemedi", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Ders notu yükle">
      <div className="space-y-4">
        <Input
          label="Başlık"
          placeholder="Örn. Veri Yapıları — Tüm Dönem Özeti"
          value={title}
          maxLength={140}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Input
          label="Ders adı"
          placeholder="Veri Yapıları"
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
        />

        <Textarea
          label="Açıklama"
          rows={2}
          placeholder="Notlar hangi haftaları kapsıyor? Kaynak nedir?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Select
          label="Kimler görebilsin?"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as typeof visibility)}
        >
          <option value="UNIVERSITY">Sadece {user?.university?.shortName ?? "üniversitem"}</option>
          <option value="GLOBAL">Tüm üniversiteler</option>
        </Select>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-muted">Dosyalar</span>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.zip,image/*"
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-strong)] py-6 text-[14px] font-medium text-muted transition-colors hover:border-[var(--brand)] hover:brand-text"
          >
            {uploading ? <Spinner size={18} /> : <PlusIcon width={18} height={18} />}
            PDF, Word, PowerPoint veya görsel seç
          </button>

          {files.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {files.map((file) => (
                <li
                  key={file.url}
                  className="flex items-center justify-between gap-2 rounded-lg surface-subtle px-3 py-2 text-[13px]"
                >
                  <span className="min-w-0 truncate">{file.name}</span>
                  <button
                    onClick={() => setFiles((current) => current.filter((f) => f.url !== file.url))}
                    className="shrink-0 text-faint hover:text-rose-500"
                  >
                    kaldır
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="rounded-xl surface-subtle p-3 text-[12.5px] leading-relaxed text-muted">
          ⚠️ Yalnızca kendi notlarını veya paylaşım izni olan materyalleri yükle. Telif hakkı olan
          kitap/slayt taramaları kaldırılır.
        </p>

        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            fullWidth
            loading={busy}
            onClick={submit}
            disabled={title.trim().length < 3 || courseName.trim().length < 2 || files.length === 0}
          >
            Paylaş
          </Button>
        </div>
      </div>
    </Modal>
  );
}
