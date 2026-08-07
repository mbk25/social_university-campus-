"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { classYearLabel } from "@kampus/shared";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";
import { Feed } from "@/components/Feed";
import { ReportModal } from "@/components/PostCard";
import { ChatIcon, GraduationIcon, MapPinIcon, MoreIcon, ShieldCheckIcon } from "@/components/icons";
import {
  Avatar,
  Button,
  EmptyState,
  Skeleton,
  cx,
  formatCount,
  formatDate,
  useToast,
} from "@/components/ui";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user: me } = useAuth();

  const [profile, setProfile] = useState<User | null>(null);
  const [meta, setMeta] = useState<{
    online: boolean;
    lastSeenAt: string;
    isPrivate: boolean;
    communities: { id: string; slug: string; name: string; avatarUrl: string | null }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [tab, setTab] = useState<"POSTS" | "COMMUNITIES">("POSTS");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{
        user: User;
        online: boolean;
        lastSeenAt: string;
        isPrivate: boolean;
        communities: { id: string; slug: string; name: string; avatarUrl: string | null }[];
      }>(`/users/${username}`);
      setProfile(data.user);
      setMeta({
        online: data.online,
        lastSeenAt: data.lastSeenAt,
        isPrivate: data.isPrivate,
        communities: data.communities,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Profil yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow() {
    if (!profile) return;
    const following = profile.viewer?.isFollowing;
    setBusy(true);
    try {
      const result = await (following
        ? api.delete<{ followers: number }>(`/users/${profile.username}/follow`)
        : api.post<{ followers: number }>(`/users/${profile.username}/follow`));
      setProfile((p) =>
        p
          ? {
              ...p,
              viewer: { ...p.viewer!, isFollowing: !following },
              counts: p.counts ? { ...p.counts, followers: result.followers } : p.counts,
            }
          : p,
      );
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "İşlem yapılamadı", "error");
    } finally {
      setBusy(false);
    }
  }

  async function startChat() {
    if (!profile) return;
    try {
      const data = await api.post<{ conversation: { id: string } }>("/chat/conversations", {
        type: "DIRECT",
        memberIds: [profile.id],
      });
      router.push(`/mesajlar/${data.conversation.id}`);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Sohbet başlatılamadı", "error");
    }
  }

  async function toggleBlock() {
    if (!profile) return;
    const blocked = profile.viewer?.isBlocked;
    if (!blocked && !confirm(`${profile.displayName} engellensin mi?`)) return;
    try {
      await (blocked
        ? api.delete(`/users/${profile.username}/block`)
        : api.post(`/users/${profile.username}/block`));
      toast.show(blocked ? "Engel kaldırıldı" : "Kullanıcı engellendi", "success");
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "İşlem yapılamadı", "error");
    }
    setMenuOpen(false);
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[620px] space-y-4">
        <Skeleton className="h-52 rounded-[var(--radius-card)]" />
        <Skeleton className="h-32 rounded-[var(--radius-card)]" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <EmptyState
        title="Profil bulunamadı"
        description={error ?? undefined}
        action={<Button onClick={() => router.push("/akis")}>Ana sayfaya dön</Button>}
      />
    );
  }

  const isSelf = profile.viewer?.isSelf || me?.id === profile.id;

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-4">
      <div className="surface overflow-hidden rounded-[var(--radius-card)]">
        <div
          className="h-28 bg-gradient-to-br from-[#6b46ef] via-[#8f74ff] to-[#38e0c4] sm:h-36"
          style={
            profile.coverUrl
              ? { backgroundImage: `url(${profile.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : undefined
          }
        />

        <div className="px-4 pb-4">
          <div className="-mt-11 flex items-end justify-between gap-3">
            <div className="relative">
              <Avatar
                src={profile.avatarUrl}
                name={profile.displayName}
                size="xl"
                className="ring-4"
                style={{ "--tw-ring-color": "var(--bg-elevated)" } as React.CSSProperties}
              />
              {meta?.online && (
                <span className="absolute bottom-1.5 right-1.5 h-4 w-4 rounded-full border-[3px] border-[var(--bg-elevated)] bg-emerald-500" />
              )}
            </div>

            <div className="flex items-center gap-2 pb-1">
              {isSelf ? (
                <Link href="/ayarlar">
                  <Button variant="secondary" size="sm">
                    Profili düzenle
                  </Button>
                </Link>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={startChat}
                    icon={<ChatIcon width={16} height={16} />}
                  >
                    <span className="hidden sm:inline">Mesaj</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={profile.viewer?.isFollowing ? "secondary" : "primary"}
                    loading={busy}
                    onClick={toggleFollow}
                  >
                    {profile.viewer?.isFollowing ? "Takiptesin" : "Takip et"}
                  </Button>
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen((v) => !v)}
                      className="rounded-lg p-2 text-muted hover:bg-[var(--bg-subtle)]"
                      aria-label="Menü"
                    >
                      <MoreIcon width={18} height={18} />
                    </button>
                    {menuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                        <div className="surface absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl py-1 text-sm">
                          <button
                            onClick={toggleBlock}
                            className="block w-full px-3.5 py-2 text-left hover:bg-[var(--bg-subtle)]"
                          >
                            {profile.viewer?.isBlocked ? "Engeli kaldır" : "Engelle"}
                          </button>
                          <button
                            onClick={() => {
                              setReportOpen(true);
                              setMenuOpen(false);
                            }}
                            className="block w-full px-3.5 py-2 text-left text-rose-500 hover:bg-[var(--bg-subtle)]"
                          >
                            Şikayet et
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="text-[22px] font-black tracking-tight">{profile.displayName}</h1>
              {profile.isVerifiedStudent && (
                <span title="Doğrulanmış öğrenci" className="brand-text">
                  <ShieldCheckIcon width={18} height={18} />
                </span>
              )}
            </div>
            <p className="text-[14px] text-faint">@{profile.username}</p>

            {profile.bio && (
              <p className="mt-2.5 whitespace-pre-wrap text-[14.5px] leading-relaxed">{profile.bio}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted">
              {profile.university && (
                <span className="flex items-center gap-1.5">
                  <GraduationIcon width={15} height={15} className="text-faint" />
                  {profile.university.name}
                </span>
              )}
              {profile.department && (
                <span className="flex items-center gap-1.5">
                  <MapPinIcon width={15} height={15} className="text-faint" />
                  {profile.department}
                  {classYearLabel(profile.classYear) ? ` · ${classYearLabel(profile.classYear)}` : ""}
                </span>
              )}
            </div>

            {profile.badges && profile.badges.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.badges.map((badge) => (
                  <span
                    key={badge.code}
                    title={badge.label}
                    className="flex items-center gap-1 rounded-full surface-subtle px-2.5 py-1 text-[12px] font-medium"
                  >
                    <span>{badge.icon}</span>
                    {badge.label}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px]">
              <Stat label="gönderi" value={profile.counts?.posts ?? 0} />
              <Link href={`/u/${profile.username}/takipciler`} className="hover:underline">
                <Stat label="takipçi" value={profile.counts?.followers ?? 0} />
              </Link>
              <Link href={`/u/${profile.username}/takip`} className="hover:underline">
                <Stat label="takip" value={profile.counts?.following ?? 0} />
              </Link>
              <Stat label="karma" value={profile.karma} />
            </div>

            <p className="mt-2.5 text-[12.5px] text-faint">
              {formatDate(profile.createdAt)} tarihinde katıldı
            </p>
          </div>
        </div>

        <nav className="flex border-t border-[var(--border)]">
          {(
            [
              { key: "POSTS", label: "Gönderiler" },
              { key: "COMMUNITIES", label: "Topluluklar" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cx(
                "relative flex-1 py-3 text-[14px] font-semibold transition-colors",
                tab === t.key ? "brand-text" : "text-muted hover:bg-[var(--bg-subtle)]",
              )}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute inset-x-8 bottom-0 h-[3px] rounded-t-full bg-[var(--brand)]" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {tab === "POSTS" ? (
        <Feed
          query={`tab=USER&username=${profile.username}`}
          emptyTitle={isSelf ? "Henüz paylaşım yapmadın" : "Henüz paylaşım yok"}
          emptyDescription={isSelf ? "İlk gönderini paylaş, kampüs seni tanısın." : undefined}
        />
      ) : (
        <div className="surface divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)]">
          {meta?.communities.length === 0 && (
            <p className="p-6 text-center text-[14px] text-faint">Henüz topluluğa üye değil</p>
          )}
          {meta?.communities.map((c) => (
            <Link
              key={c.id}
              href={`/topluluk/${c.slug}`}
              className="flex items-center gap-3 p-3.5 transition-colors hover:bg-[var(--bg-subtle)]"
            >
              <Avatar src={c.avatarUrl} name={c.name} size="md" className="rounded-xl" />
              <span className="text-[15px] font-semibold">{c.name}</span>
            </Link>
          ))}
        </div>
      )}

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="USER"
        targetId={profile.id}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <strong className="font-bold">{formatCount(value)}</strong>{" "}
      <span className="text-muted">{label}</span>
    </span>
  );
}
