"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { MiniUser, Post } from "@/lib/types";
import {
  BookmarkIcon,
  CommentIcon,
  HeartIcon,
  MaskIcon,
  MoreIcon,
  PinIcon,
  ShareIcon,
  SendIcon,
  ShieldCheckIcon,
} from "./icons";
import { RichText } from "./RichText";
import { Avatar, Button, Modal, Spinner, cx, formatCount, timeAgo, useToast } from "./ui";

export function PostCard({
  post: initial,
  onDeleted,
  compact = false,
}: {
  post: Post;
  onDeleted?: (id: string) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [post, setPost] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [friends, setFriends] = useState<MiniUser[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  const author = post.author;
  const displayName = post.isAnonymous ? post.anonymousAlias ?? "Anonim" : author?.displayName ?? "";
  const profileHref = post.isAnonymous || !author ? null : `/u/${author.username}`;

  async function toggleLike() {
    if (busy) return;
    const liked = post.viewer.hasLiked;
    // İyimser güncelleme
    setPost((p) => ({
      ...p,
      viewer: { ...p.viewer, hasLiked: !liked },
      likeCount: p.likeCount + (liked ? -1 : 1),
    }));
    try {
      const result = await (liked
        ? api.delete<{ likeCount: number }>(`/posts/${post.id}/like`)
        : api.post<{ likeCount: number }>(`/posts/${post.id}/like`));
      setPost((p) => ({ ...p, likeCount: result.likeCount }));
    } catch (err) {
      setPost((p) => ({
        ...p,
        viewer: { ...p.viewer, hasLiked: liked },
        likeCount: p.likeCount + (liked ? 1 : -1),
      }));
      toast.show(err instanceof ApiError ? err.message : "Beğeni kaydedilemedi", "error");
    }
  }

  async function toggleBookmark() {
    const saved = post.viewer.hasBookmarked;
    setPost((p) => ({ ...p, viewer: { ...p.viewer, hasBookmarked: !saved } }));
    try {
      await (saved
        ? api.delete(`/posts/${post.id}/bookmark`)
        : api.post(`/posts/${post.id}/bookmark`));
      toast.show(saved ? "Kaydedilenlerden çıkarıldı" : "Kaydedildi", "success");
    } catch {
      setPost((p) => ({ ...p, viewer: { ...p.viewer, hasBookmarked: saved } }));
    }
  }

  async function vote(optionId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api.post<{ post: Post }>(`/posts/${post.id}/poll/vote`, { optionId });
      setPost(result.post);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Oy verilemedi", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Bu gönderi silinsin mi?")) return;
    try {
      await api.delete(`/posts/${post.id}`);
      toast.show("Gönderi silindi", "success");
      onDeleted?.(post.id);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Silinemedi", "error");
    }
  }

  async function share() {
    const url = `${window.location.origin}/gonderi/${post.id}`;
    if (navigator.share) {
      await navigator.share({ url, title: "Kampus gönderisi" }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.show("Bağlantı kopyalandı", "success");
  }

  async function openShare() {
    if (!user) return;
    setSelectedFriendIds([]);
    setShareOpen(true);
    setFriendsLoading(true);
    try {
      const data = await api.get<{ items: MiniUser[] }>(`/users/${user.username}/following?limit=50`);
      setFriends(data.items);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Takip ettiklerin yüklenemedi", "error");
    } finally {
      setFriendsLoading(false);
    }
  }

  function toggleFriend(friendId: string) {
    setSelectedFriendIds((current) =>
      current.includes(friendId) ? current.filter((id) => id !== friendId) : [...current, friendId],
    );
  }

  async function sendToFriends() {
    const recipients = friends.filter((friend) => selectedFriendIds.includes(friend.id));
    if (recipients.length === 0) return;
    setSharing(true);
    try {
      await Promise.all(recipients.map(async (friend) => {
        const { conversation } = await api.post<{ conversation: { id: string } }>("/chat/conversations", { type: "DIRECT", memberIds: [friend.id] });
        await api.post(`/chat/conversations/${conversation.id}/messages`, { content: `Kampus'te seninle bir gönderi paylaştı: ${window.location.origin}/gonderi/${post.id}` });
      }));
      setShareOpen(false);
      toast.show(`${recipients.length} kişiye gönderildi`, "success");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Gönderi iletilemedi", "error");
    } finally {
      setSharing(false);
    }
  }

  const mediaCount = post.media.length;

  return (
    <article
      className={cx(
        "surface animate-fade-up group relative rounded-[var(--radius-card)] transition-colors",
        compact ? "p-3.5" : "p-4",
      )}
    >
      {post.isPinned && (
        <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold brand-text">
          <PinIcon width={13} height={13} /> Sabitlenmiş
        </div>
      )}

      <header className="flex items-start gap-3">
        {profileHref ? (
          <Link href={profileHref} className="shrink-0">
            <Avatar src={author?.avatarUrl} name={displayName} size="md" />
          </Link>
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-muted">
            <MaskIcon width={20} height={20} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[15px] leading-tight">
            {profileHref ? (
              <Link href={profileHref} className="truncate font-bold hover:underline">
                {displayName}
              </Link>
            ) : (
              <span className="truncate font-bold">{displayName}</span>
            )}

            {author?.isVerifiedStudent && (
              <span title="Doğrulanmış öğrenci" className="brand-text">
                <ShieldCheckIcon width={15} height={15} />
              </span>
            )}

            {!post.isAnonymous && author && (
              <span className="truncate text-[13px] text-faint">@{author.username}</span>
            )}
            <span className="text-[13px] text-faint">·</span>
            <Link href={`/gonderi/${post.id}`} className="text-[13px] text-faint hover:underline">
              {timeAgo(post.createdAt)}
            </Link>
            {post.editedAt && <span className="text-[12px] text-faint">(düzenlendi)</span>}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
            {post.community && (
              <Link
                href={`/topluluk/${post.community.slug}`}
                className="font-medium hover:underline"
              >
                {post.community.name}
              </Link>
            )}
            {!post.isAnonymous && author?.university && (
              <>
                {post.community && <span className="text-faint">·</span>}
                <span className="truncate">{author.university.shortName}</span>
              </>
            )}
            {!post.isAnonymous && author?.department && (
              <>
                <span className="text-faint">·</span>
                <span className="truncate">{author.department}</span>
              </>
            )}
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-1.5 text-faint opacity-0 transition-opacity hover:bg-[var(--bg-subtle)] hover:text-[var(--text)] group-hover:opacity-100 focus:opacity-100"
            aria-label="Gönderi menüsü"
          >
            <MoreIcon width={18} height={18} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="surface absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl py-1 text-sm">
                <button
                  onClick={() => {
                    void share();
                    setMenuOpen(false);
                  }}
                  className="block w-full px-3.5 py-2 text-left hover:bg-[var(--bg-subtle)]"
                >
                  Bağlantıyı kopyala
                </button>
                {!post.viewer.isMine && (
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
                {post.viewer.canDelete && (
                  <button
                    onClick={() => {
                      void remove();
                      setMenuOpen(false);
                    }}
                    className="block w-full px-3.5 py-2 text-left text-rose-500 hover:bg-[var(--bg-subtle)]"
                  >
                    Sil
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {post.content && (
        <div
          className="mt-2.5 cursor-pointer"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) return;
            router.push(`/gonderi/${post.id}`);
          }}
        >
          <RichText
            text={post.content}
            className="whitespace-pre-wrap break-words text-[15px] leading-[1.6]"
          />
        </div>
      )}

      {mediaCount > 0 && (
        <div
          className={cx(
            "mt-3 grid gap-1.5 overflow-hidden rounded-2xl",
            mediaCount === 1 && "grid-cols-1",
            mediaCount === 2 && "grid-cols-2",
            mediaCount === 3 && "grid-cols-2",
            mediaCount >= 4 && "grid-cols-2",
          )}
        >
          {post.media.slice(0, 4).map((media, i) => (
            <button
              key={media.url}
              onClick={() => setLightbox(media.url)}
              className={cx(
                "relative overflow-hidden bg-[var(--bg-subtle)]",
                mediaCount === 3 && i === 0 && "row-span-2",
                mediaCount === 1 ? "max-h-[520px]" : "aspect-square",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.url}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {post.poll && (
        <div className="mt-3 space-y-2">
          <p className="text-[14px] font-semibold">{post.poll.question}</p>
          {post.poll.options.map((option) => {
            const total = post.poll!.totalVotes || 1;
            const pct = Math.round((option.voteCount / total) * 100);
            const voted = post.poll!.viewerVotedOptionId === option.id;
            const hasVoted = !!post.poll!.viewerVotedOptionId;
            const ended = new Date(post.poll!.endsAt) < new Date();

            return (
              <button
                key={option.id}
                onClick={() => !ended && vote(option.id)}
                disabled={ended || busy}
                className={cx(
                  "relative w-full overflow-hidden rounded-xl border px-3.5 py-2.5 text-left text-[14px] transition-colors",
                  voted ? "border-[var(--brand)]" : "border-[var(--border)]",
                  !ended && "hover:border-[var(--brand)]",
                )}
              >
                {(hasVoted || ended) && (
                  <span
                    className="absolute inset-y-0 left-0 brand-soft-bg transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                  />
                )}
                <span className="relative flex items-center justify-between gap-3">
                  <span className={cx("truncate font-medium", voted && "brand-text")}>
                    {option.text}
                  </span>
                  {(hasVoted || ended) && (
                    <span className="shrink-0 text-[13px] text-muted">%{pct}</span>
                  )}
                </span>
              </button>
            );
          })}
          <p className="text-[12.5px] text-faint">
            {formatCount(post.poll.totalVotes)} oy ·{" "}
            {new Date(post.poll.endsAt) < new Date()
              ? "sona erdi"
              : `${timeAgo(post.poll.endsAt).replace("şimdi", "az")} kaldı`}
          </p>
        </div>
      )}

      <footer className="mt-3 flex items-center gap-1 border-t border-[var(--border)] pt-2.5">
        <ActionButton
          active={post.viewer.hasLiked}
          activeClass="text-rose-500"
          onClick={toggleLike}
          icon={<HeartIcon width={19} height={19} filled={post.viewer.hasLiked} />}
          label={post.likeCount > 0 ? formatCount(post.likeCount) : undefined}
          title="Beğen"
        />
        <Link href={`/gonderi/${post.id}`} className="contents">
          <ActionButton
            icon={<CommentIcon width={19} height={19} />}
            label={post.commentCount > 0 ? formatCount(post.commentCount) : undefined}
            title="Yorum yap"
          />
        </Link>
        <ActionButton
          onClick={() => void openShare()}
          icon={<ShareIcon width={18} height={18} />}
          title="Paylaş"
        />
        <div className="flex-1" />
        <ActionButton
          active={post.viewer.hasBookmarked}
          activeClass="brand-text"
          onClick={toggleBookmark}
          icon={<BookmarkIcon width={18} height={18} filled={post.viewer.hasBookmarked} />}
          title="Kaydet"
        />
      </footer>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="POST"
        targetId={post.id}
      />

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Arkadaşına gönder" size="sm">
        <p className="mb-3 text-[13px] text-muted">Takip ettiğin birine bu gönderinin bağlantısını mesaj olarak gönder.</p>
        {friendsLoading ? (
          <div className="py-6 text-center"><Spinner size={22} className="brand-text" /></div>
        ) : friends.length === 0 ? (
          <p className="rounded-xl surface-subtle p-3 text-[13px] text-muted">Gönderebileceğin biri için önce bir kullanıcıyı takip et.</p>
        ) : (
          <div className="max-h-72 divide-y overflow-y-auto rounded-xl border">
            {friends.map((friend) => (
              <button key={friend.id} onClick={() => toggleFriend(friend.id)} disabled={sharing} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-subtle)] disabled:opacity-60">
                <Avatar src={friend.avatarUrl} name={friend.displayName} size="sm" />
                <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{friend.displayName}</span><span className="block text-[12px] text-faint">@{friend.username}</span></span>
                <span className={cx("flex h-5 w-5 items-center justify-center rounded-md border", selectedFriendIds.includes(friend.id) ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border-strong)]")}>
                  {selectedFriendIds.includes(friend.id) && "✓"}
                </span>
              </button>
            ))}
          </div>
        )}
        {friends.length > 0 && (
          <Button className="mt-3" fullWidth loading={sharing} disabled={selectedFriendIds.length === 0} onClick={() => void sendToFriends()}>
            {selectedFriendIds.length > 0 ? `${selectedFriendIds.length} kişiye gönder` : "Gönder"}
          </Button>
        )}
      </Modal>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}
    </article>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  active,
  activeClass,
  title,
}: {
  icon: React.ReactNode;
  label?: string;
  onClick?: () => void;
  active?: boolean;
  activeClass?: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cx(
        "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
        active ? activeClass : "text-muted hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]",
      )}
    >
      <span className={cx(active && "animate-pop")}>{icon}</span>
      {label && <span>{label}</span>}
    </button>
  );
}

const REASONS = [
  { value: "SPAM", label: "Spam / reklam" },
  { value: "HARASSMENT", label: "Taciz veya zorbalık" },
  { value: "HATE_SPEECH", label: "Nefret söylemi" },
  { value: "SEXUAL_CONTENT", label: "Cinsel içerik" },
  { value: "VIOLENCE", label: "Şiddet" },
  { value: "MISINFORMATION", label: "Yanlış bilgi" },
  { value: "IMPERSONATION", label: "Sahte hesap / taklit" },
  { value: "OTHER", label: "Diğer" },
];

export function ReportModal({
  open,
  onClose,
  targetType,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  targetType: string;
  targetId: string;
}) {
  const toast = useToast();
  const [reason, setReason] = useState("SPAM");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    setSending(true);
    try {
      const result = await api.post<{ message: string }>("/reports", {
        targetType,
        targetId,
        reason,
        details: details || undefined,
      });
      toast.show(result.message, "success");
      onClose();
      setDetails("");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Bildirim gönderilemedi", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="İçeriği şikayet et" size="sm">
      <div className="space-y-1.5">
        {REASONS.map((r) => (
          <label
            key={r.value}
            className={cx(
              "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
              reason === r.value
                ? "border-[var(--brand)] brand-soft-bg"
                : "border-[var(--border)] hover:bg-[var(--bg-subtle)]",
            )}
          >
            <input
              type="radio"
              name="reason"
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
              className="accent-[var(--brand)]"
            />
            {r.label}
          </label>
        ))}
      </div>

      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Eklemek istediğiniz bir şey var mı? (isteğe bağlı)"
        maxLength={500}
        rows={3}
        className="mt-3 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm focus-ring"
      />
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" fullWidth onClick={onClose}>
          Vazgeç
        </Button>
        <Button fullWidth loading={sending} onClick={submit}>
          Gönder
        </Button>
      </div>
    </Modal>
  );
}
