"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Confession } from "@/lib/types";
import { ReportModal } from "@/components/PostCard";
import { HeartIcon, MaskIcon, MoreIcon } from "@/components/icons";
import {
  Button,
  EmptyState,
  Modal,
  Skeleton,
  Textarea,
  cx,
  formatCount,
  timeAgo,
  useToast,
} from "@/components/ui";

const TOPICS = ["ders", "aşk", "aile", "para", "kampüs", "yurt", "staj", "gelecek", "arkadaşlık"];

export default function ConfessionsPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<"UNIVERSITY" | "GLOBAL" | "MINE">("UNIVERSITY");
  const [sort, setSort] = useState<"NEW" | "TOP">("NEW");
  const [topic, setTopic] = useState<string | null>(null);
  const [items, setItems] = useState<Confession[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);

  const load = useCallback(
    async (next?: string | null) => {
      if (!next) setLoading(true);
      try {
        const params = new URLSearchParams({ scope, sort, limit: "20" });
        if (topic) params.set("topic", topic);
        if (next) params.set("cursor", next);
        const data = await api.get<{ items: Confession[]; nextCursor: string | null }>(
          `/confessions?${params}`,
        );
        setItems((current) => (next ? [...current, ...data.items] : data.items));
        setCursor(data.nextCursor);
      } catch {
        if (!next) setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [scope, sort, topic],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-black tracking-tight">İtiraflar</h1>
          <p className="mt-1 text-[14px] text-muted">
            Tamamen anonim. Kimliğin hiçbir yerde görünmez.
          </p>
        </div>
        <Button icon={<MaskIcon width={17} height={17} />} onClick={() => setComposeOpen(true)}>
          <span className="hidden sm:inline">İtiraf et</span>
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: "UNIVERSITY", label: user?.university?.shortName ?? "Üniversitem" },
            { key: "GLOBAL", label: "Türkiye geneli" },
            { key: "MINE", label: "Benimkiler" },
          ] as const
        ).map((s) => (
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
        <button
          onClick={() => setSort(sort === "NEW" ? "TOP" : "NEW")}
          className="rounded-full surface-subtle px-3.5 py-1.5 text-[13.5px] font-medium text-muted"
        >
          {sort === "NEW" ? "En yeni" : "En popüler"}
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setTopic(null)}
          className={cx(
            "shrink-0 rounded-full px-3 py-1 text-[12.5px] font-medium",
            !topic ? "brand-soft-bg brand-text" : "surface-subtle text-muted",
          )}
        >
          hepsi
        </button>
        {TOPICS.map((t) => (
          <button
            key={t}
            onClick={() => setTopic(topic === t ? null : t)}
            className={cx(
              "shrink-0 rounded-full px-3 py-1 text-[12.5px] font-medium",
              topic === t ? "brand-soft-bg brand-text" : "surface-subtle text-muted",
            )}
          >
            #{t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<MaskIcon width={26} height={26} />}
          title="Henüz itiraf yok"
          description="İlk itirafı sen yaz. Kimse kim olduğunu bilmeyecek."
          action={<Button onClick={() => setComposeOpen(true)}>İtiraf et</Button>}
        />
      ) : (
        <div className="space-y-3">
          {items.map((confession) => (
            <ConfessionCard
              key={confession.id}
              confession={confession}
              onDeleted={(cid) => setItems((current) => current.filter((c) => c.id !== cid))}
            />
          ))}
          {cursor && (
            <button
              onClick={() => void load(cursor)}
              className="w-full rounded-xl py-2.5 text-[14px] font-semibold brand-text hover:bg-[var(--bg-subtle)]"
            >
              Daha fazla
            </button>
          )}
        </div>
      )}

      <ComposeConfessionModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onCreated={(c) => setItems((current) => [c, ...current])}
      />
    </div>
  );
}

function ConfessionCard({
  confession: initial,
  onDeleted,
}: {
  confession: Confession;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const [confession, setConfession] = useState(initial);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  async function toggleLike() {
    const liked = confession.viewer.hasLiked;
    setConfession((c) => ({
      ...c,
      viewer: { ...c.viewer, hasLiked: !liked },
      likeCount: c.likeCount + (liked ? -1 : 1),
    }));
    try {
      const result = await (liked
        ? api.delete<{ likeCount: number }>(`/confessions/${confession.id}/like`)
        : api.post<{ likeCount: number }>(`/confessions/${confession.id}/like`));
      setConfession((c) => ({ ...c, likeCount: result.likeCount }));
    } catch {
      setConfession((c) => ({
        ...c,
        viewer: { ...c.viewer, hasLiked: liked },
        likeCount: c.likeCount + (liked ? 1 : -1),
      }));
    }
  }

  async function remove() {
    if (!confirm("İtirafın silinsin mi?")) return;
    try {
      await api.delete(`/confessions/${confession.id}`);
      onDeleted(confession.id);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Silinemedi", "error");
    }
  }

  return (
    <article className="surface animate-fade-up group rounded-[var(--radius-card)] p-4">
      <header className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full surface-subtle text-muted">
          <MaskIcon width={18} height={18} />
        </span>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold">{confession.alias}</span>
          <span className="block text-[12px] text-faint">
            {timeAgo(confession.createdAt)}
            {confession.university ? ` · ${confession.university.shortName}` : " · Türkiye geneli"}
            {confession.topic ? ` · #${confession.topic}` : ""}
          </span>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-1.5 text-faint opacity-0 transition-opacity hover:bg-[var(--bg-subtle)] group-hover:opacity-100"
            aria-label="Menü"
          >
            <MoreIcon width={17} height={17} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="surface absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-xl py-1 text-sm">
                {confession.viewer.isMine ? (
                  <button
                    onClick={() => {
                      void remove();
                      setMenuOpen(false);
                    }}
                    className="block w-full px-3.5 py-2 text-left text-rose-500 hover:bg-[var(--bg-subtle)]"
                  >
                    Sil
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setReportOpen(true);
                      setMenuOpen(false);
                    }}
                    className="block w-full px-3.5 py-2 text-left hover:bg-[var(--bg-subtle)]"
                  >
                    Şikayet et
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <p className="mt-2.5 whitespace-pre-wrap break-words text-[15px] leading-[1.65]">
        {confession.content}
      </p>

      <footer className="mt-3 flex items-center gap-1 border-t border-[var(--border)] pt-2.5">
        <button
          onClick={toggleLike}
          className={cx(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
            confession.viewer.hasLiked
              ? "text-rose-500"
              : "text-muted hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]",
          )}
        >
          <span className={cx(confession.viewer.hasLiked && "animate-pop")}>
            <HeartIcon width={18} height={18} filled={confession.viewer.hasLiked} />
          </span>
          {confession.likeCount > 0 && formatCount(confession.likeCount)}
        </button>
        {confession.viewer.isMine && (
          <span className="ml-auto text-[12px] text-faint">senin itirafın</span>
        )}
      </footer>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="CONFESSION"
        targetId={confession.id}
      />
    </article>
  );
}

function ComposeConfessionModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (confession: Confession) => void;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [scope, setScope] = useState<"UNIVERSITY" | "GLOBAL">("UNIVERSITY");
  const [topic, setTopic] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const result = await api.post<{ confession: Confession }>("/confessions", {
        content: content.trim(),
        scope,
        topic: topic ?? undefined,
      });
      onCreated(result.confession);
      toast.show("İtirafın paylaşıldı 🎭", "success");
      onClose();
      setContent("");
      setTopic(null);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Paylaşılamadı", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Anonim itiraf">
      <div className="space-y-4">
        <Textarea
          rows={6}
          maxLength={1000}
          autoFocus
          placeholder="İçinden geçenleri yaz. Kimse kim olduğunu bilmeyecek..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          hint={`${content.length}/1000`}
        />

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-muted">Konu (isteğe bağlı)</span>
          <div className="flex flex-wrap gap-1.5">
            {TOPICS.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(topic === t ? null : t)}
                className={cx(
                  "rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors",
                  topic === t ? "bg-[var(--brand)] text-white" : "surface-subtle text-muted",
                )}
              >
                #{t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {(
            [
              { key: "UNIVERSITY", label: `Sadece ${user?.university?.shortName ?? "üniversitem"}` },
              { key: "GLOBAL", label: "Türkiye geneli" },
            ] as const
          ).map((s) => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={cx(
                "flex-1 rounded-xl border px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                scope === s.key
                  ? "border-[var(--brand)] brand-soft-bg brand-text"
                  : "border-[var(--border)] text-muted",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p className="rounded-xl surface-subtle p-3 text-[12.5px] leading-relaxed text-muted">
          🔒 Adın, kullanıcı adın ve profilin hiçbir yerde görünmez. Ancak hakaret, tehdit ve
          hedef gösterme durumunda moderasyon ekibi kaydı inceleyebilir.
        </p>

        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Vazgeç
          </Button>
          <Button fullWidth loading={busy} onClick={submit} disabled={content.trim().length < 10}>
            Anonim paylaş
          </Button>
        </div>
      </div>
    </Modal>
  );
}
