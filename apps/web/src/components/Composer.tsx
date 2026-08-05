"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, api, uploadImage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Community, MediaAsset, Post } from "@/lib/types";
import { CloseIcon, ImageIcon, MaskIcon, PollIcon } from "./icons";
import { Avatar, Button, Spinner, cx, useToast } from "./ui";

const MAX_LENGTH = 2000;
const MAX_MEDIA = 4;

export function Composer({
  communityId,
  communityName,
  placeholder = "Kampüste neler oluyor?",
  onPosted,
  autoFocus,
  allowAnonymous = true,
}: {
  communityId?: string | null;
  communityName?: string;
  placeholder?: string;
  onPosted?: (post: Post) => void;
  autoFocus?: boolean;
  allowAnonymous?: boolean;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollHours, setPollHours] = useState(24);
  const [target, setTarget] = useState<string>(communityId ?? "");
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);

  const expanded = content.length > 0 || media.length > 0 || showPoll;

  useEffect(() => {
    if (communityId) return;
    api
      .get<{ items: Community[] }>("/communities?filter=MINE&limit=50")
      .then((data) => setMyCommunities(data.items))
      .catch(() => undefined);
  }, [communityId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 340)}px`;
  }, [content]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const remaining = MAX_MEDIA - media.length;
    if (remaining <= 0) {
      toast.show(`En fazla ${MAX_MEDIA} görsel ekleyebilirsiniz`, "error");
      return;
    }

    setUploading(true);
    try {
      const uploads = await Promise.all(
        Array.from(files)
          .slice(0, remaining)
          .map((file) => uploadImage(file, "post")),
      );
      setMedia((m) => [...m, ...uploads]);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Görsel yüklenemedi", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    const trimmed = content.trim();
    const validPollOptions = pollOptions.map((o) => o.trim()).filter(Boolean);

    if (!trimmed && media.length === 0 && !showPoll) return;
    if (showPoll && validPollOptions.length < 2) {
      toast.show("Ankette en az 2 seçenek olmalı", "error");
      return;
    }

    setPosting(true);
    try {
      const result = await api.post<{ post: Post }>("/posts", {
        content: trimmed,
        communityId: target || null,
        media,
        isAnonymous,
        ...(showPoll
          ? {
              poll: {
                question: trimmed.slice(0, 140) || "Anket",
                options: validPollOptions,
                endsInHours: pollHours,
              },
            }
          : {}),
      });

      setContent("");
      setMedia([]);
      setShowPoll(false);
      setPollOptions(["", ""]);
      setIsAnonymous(false);
      onPosted?.(result.post);
      toast.show("Gönderi paylaşıldı", "success");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Gönderi paylaşılamadı", "error");
    } finally {
      setPosting(false);
    }
  }

  if (!user) return null;

  const remaining = MAX_LENGTH - content.length;
  const overLimit = remaining < 0;

  return (
    <div className="surface rounded-[var(--radius-card)] p-4">
      <div className="flex gap-3">
        {isAnonymous ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-muted">
            <MaskIcon width={20} height={20} />
          </span>
        ) : (
          <Avatar src={user.avatarUrl} name={user.displayName} size="md" />
        )}

        <div className="min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            autoFocus={autoFocus}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit();
            }}
            placeholder={communityName ? `${communityName} topluluğuna yaz...` : placeholder}
            rows={expanded ? 3 : 1}
            className="w-full resize-none bg-transparent text-[16px] leading-relaxed outline-none placeholder:text-[var(--text-faint)]"
          />

          {media.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {media.map((item) => (
                <div key={item.url} className="group relative aspect-square overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => setMedia((m) => m.filter((x) => x.url !== item.url))}
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white transition-opacity"
                    aria-label="Görseli kaldır"
                  >
                    <CloseIcon width={14} height={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showPoll && (
            <div className="mt-3 space-y-2 rounded-xl border border-[var(--border)] p-3">
              {pollOptions.map((option, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={option}
                    onChange={(e) =>
                      setPollOptions((opts) => opts.map((o, j) => (j === i ? e.target.value : o)))
                    }
                    placeholder={`Seçenek ${i + 1}`}
                    maxLength={60}
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-sm focus-ring"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => setPollOptions((opts) => opts.filter((_, j) => j !== i))}
                      className="rounded-lg p-1.5 text-faint hover:text-rose-500"
                      aria-label="Seçeneği kaldır"
                    >
                      <CloseIcon width={16} height={16} />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between gap-2 pt-1">
                {pollOptions.length < 6 && (
                  <button
                    onClick={() => setPollOptions((o) => [...o, ""])}
                    className="text-[13px] font-medium brand-text hover:underline"
                  >
                    + Seçenek ekle
                  </button>
                )}
                <select
                  value={pollHours}
                  onChange={(e) => setPollHours(Number(e.target.value))}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-[13px]"
                >
                  <option value={6}>6 saat</option>
                  <option value={24}>1 gün</option>
                  <option value={72}>3 gün</option>
                  <option value={168}>1 hafta</option>
                </select>
              </div>
            </div>
          )}

          {expanded && !communityId && myCommunities.length > 0 && (
            <div className="mt-3">
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 text-[13px] font-medium focus-ring"
              >
                <option value="">Herkese açık akış</option>
                {myCommunities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-3 flex items-center gap-1 border-t border-[var(--border)] pt-2.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
            <ToolButton
              onClick={() => fileRef.current?.click()}
              disabled={uploading || media.length >= MAX_MEDIA}
              title="Görsel ekle"
            >
              {uploading ? <Spinner size={18} /> : <ImageIcon width={19} height={19} />}
            </ToolButton>

            <ToolButton
              onClick={() => setShowPoll((v) => !v)}
              active={showPoll}
              title="Anket ekle"
            >
              <PollIcon width={19} height={19} />
            </ToolButton>

            {allowAnonymous && (
              <ToolButton
                onClick={() => setIsAnonymous((v) => !v)}
                active={isAnonymous}
                title="Anonim paylaş"
              >
                <MaskIcon width={19} height={19} />
              </ToolButton>
            )}

            <div className="flex-1" />

            {content.length > 0 && (
              <span
                className={cx(
                  "text-[12.5px] tabular-nums",
                  overLimit ? "font-semibold text-rose-500" : remaining < 100 ? "text-amber-500" : "text-faint",
                )}
              >
                {remaining}
              </span>
            )}

            <Button
              size="sm"
              onClick={submit}
              loading={posting}
              disabled={overLimit || (!content.trim() && media.length === 0)}
            >
              Paylaş
            </Button>
          </div>

          {isAnonymous && (
            <p className="mt-2 text-[12.5px] text-muted">
              🎭 Anonim paylaşımda adın ve profilin görünmez. Kurallara aykırı içerikte hesabın
              moderasyon tarafından tespit edilebilir.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cx(
        "rounded-lg p-2 transition-colors disabled:opacity-40",
        active
          ? "brand-soft-bg brand-text"
          : "text-muted hover:bg-[var(--bg-subtle)] hover:brand-text",
      )}
    >
      {children}
    </button>
  );
}
