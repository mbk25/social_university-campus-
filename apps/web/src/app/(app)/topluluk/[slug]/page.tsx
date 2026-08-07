"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { classYearLabel } from "@kampus/shared";
import { ApiError, api } from "@/lib/api";
import type { Community, MiniUser } from "@/lib/types";
import { Composer } from "@/components/Composer";
import { Feed, type FeedHandle } from "@/components/Feed";
import { ChatIcon, LockIcon, ShareIcon, ShieldCheckIcon, UsersIcon } from "@/components/icons";
import { Avatar, Button, EmptyState, Skeleton, cx, formatCount, useToast } from "@/components/ui";

const SCOPE_LABEL = {
  DEPARTMENT: "Bölüm topluluğu",
  UNIVERSITY: "Üniversite topluluğu",
  GLOBAL: "Genel topluluk",
} as const;

type Tab = "POSTS" | "MEMBERS" | "ABOUT";

export default function CommunityPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const toast = useToast();

  const [community, setCommunity] = useState<Community | null>(null);
  const [moderators, setModerators] = useState<(MiniUser & { role: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("POSTS");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Sunucuda window yok; ilk render'da boş bırakıp istemcide dolduruyoruz.
  const [origin, setOrigin] = useState("");
  const feedRef = useRef<FeedHandle | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  const onFeedReady = useCallback((handle: FeedHandle) => {
    feedRef.current = handle;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ community: Community; moderators: (MiniUser & { role: string })[] }>(
        `/communities/${slug}`,
      );
      setCommunity(data.community);
      setModerators(data.moderators);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Topluluk yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleMembership() {
    if (!community) return;
    setBusy(true);
    try {
      if (community.viewer?.isMember) {
        if (!confirm(`${community.name} topluluğundan ayrılmak istiyor musun?`)) return;
        await api.delete(`/communities/${community.id}/leave`);
        toast.show("Topluluktan ayrıldın", "info");
      } else {
        const result = await api.post<{ joined: boolean; pending?: boolean }>(
          `/communities/${community.id}/join`,
        );
        toast.show(result.joined ? "Topluluğa katıldın 🎉" : "Katılım isteğin gönderildi", "success");
      }
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "İşlem yapılamadı", "error");
    } finally {
      setBusy(false);
    }
  }

  async function openChat() {
    if (!community) return;
    try {
      const data = await api.get<{ conversation: { id: string } }>(
        `/chat/conversations/community/${community.id}`,
      );
      router.push(`/mesajlar/${data.conversation.id}`);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Sohbet açılamadı", "error");
    }
  }

  async function shareCommunity() {
    if (!community) return;
    // Adres çubuğu yerine kanonik adres: eski/yeni slug karışmasın.
    const url = `${window.location.origin}/topluluk/${community.slug}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.show("Bağlantı kopyalandı", "success");
    } catch {
      toast.show("Bağlantı kopyalanamadı", "error");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[680px] space-y-4">
        <Skeleton className="h-40 rounded-[var(--radius-card)]" />
        <Skeleton className="h-24 rounded-[var(--radius-card)]" />
      </div>
    );
  }

  if (error || !community) {
    return (
      <EmptyState
        title="Topluluğa erişilemedi"
        description={error ?? undefined}
        action={
          <Link href="/topluluklar">
            <Button>Topluluklara dön</Button>
          </Link>
        }
      />
    );
  }

  const isMember = !!community.viewer?.isMember;
  const isStaff = community.viewer?.role === "OWNER" || community.viewer?.role === "MODERATOR";
  const canSeeContent = community.visibility === "PUBLIC" || isMember;

  return (
    <div className="mx-auto w-full max-w-[680px] space-y-4">
      {/* ------------------------------------------------------------ Kapak */}
      <div className="surface overflow-hidden rounded-[var(--radius-card)]">
        <div
          className="h-28 bg-gradient-to-br from-[#8f74ff] via-[#6b46ef] to-[#38e0c4] sm:h-36"
          style={
            community.coverUrl
              ? { backgroundImage: `url(${community.coverUrl})`, backgroundSize: "cover" }
              : undefined
          }
        />
        <div className="px-4 pb-4">
          <div className="-mt-9 flex items-end justify-between gap-3">
            <Avatar
              src={community.avatarUrl}
              name={community.name}
              size="xl"
              className="rounded-3xl ring-4"
              style={{ "--tw-ring-color": "var(--bg-elevated)" } as React.CSSProperties}
            />
            <div className="flex gap-2 pb-1">
              {isMember && (
                <Button variant="secondary" size="sm" onClick={openChat} icon={<ChatIcon width={16} height={16} />}>
                  Sohbet
                </Button>
              )}
              <Button
                size="sm"
                variant={isMember ? "secondary" : "primary"}
                loading={busy}
                onClick={toggleMembership}
                disabled={community.viewer?.hasPendingRequest}
              >
                {community.viewer?.hasPendingRequest
                  ? "Beklemede"
                  : isMember
                    ? "Üyesin"
                    : "Katıl"}
              </Button>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-black tracking-tight">{community.name}</h1>
              {community.visibility === "PRIVATE" && (
                <span className="flex items-center gap-1 rounded-md surface-subtle px-1.5 py-0.5 text-[11px] font-semibold text-muted">
                  <LockIcon width={11} height={11} /> Gizli
                </span>
              )}
              <span className="rounded-md brand-soft-bg px-2 py-0.5 text-[11.5px] font-semibold brand-text">
                {SCOPE_LABEL[community.scope]}
              </span>
            </div>

            {community.description && (
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{community.description}</p>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-faint">
              <span>
                <strong className="text-[var(--text)]">{formatCount(community.memberCount)}</strong> üye
              </span>
              <span>
                <strong className="text-[var(--text)]">{formatCount(community.postCount)}</strong> gönderi
              </span>
              {community.university && <span>{community.university.name}</span>}
              {community.department && <span>{community.department}</span>}
            </div>

            <div className="mt-3">
              <span className="mb-1.5 block text-[12.5px] font-medium text-faint">
                Davet bağlantısı — arkadaşlarına gönder
              </span>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={origin ? `${origin}/topluluk/${community.slug}` : ""}
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={shareCommunity}
                  aria-label="Topluluk bağlantısı"
                  className="min-w-0 flex-1 cursor-pointer rounded-xl surface-subtle px-3 py-2 text-[13px] text-muted outline-none"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={shareCommunity}
                  icon={<ShareIcon width={15} height={15} />}
                >
                  {copied ? "Kopyalandı" : "Kopyala"}
                </Button>
              </div>
            </div>

            {community.tags.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {community.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full surface-subtle px-2.5 py-0.5 text-[12px] text-muted"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <nav className="flex border-t border-[var(--border)]">
          {(
            [
              { key: "POSTS", label: "Gönderiler" },
              { key: "MEMBERS", label: "Üyeler" },
              { key: "ABOUT", label: "Hakkında" },
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
                <span className="absolute inset-x-6 bottom-0 h-[3px] rounded-t-full bg-[var(--brand)]" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ---------------------------------------------------------- İçerik */}
      {!canSeeContent ? (
        <EmptyState
          icon={<LockIcon width={26} height={26} />}
          title="Bu topluluk gizli"
          description="İçeriği görebilmek için katılım isteği gönder ve yöneticilerin onayını bekle."
          action={
            <Button onClick={toggleMembership} loading={busy}>
              Katılım isteği gönder
            </Button>
          }
        />
      ) : tab === "POSTS" ? (
        <>
          {isMember && (
            <Composer
              communityId={community.id}
              communityName={community.name}
              onPosted={(post) => feedRef.current?.prepend(post)}
            />
          )}
          <Feed
            query={`tab=COMMUNITY&community=${community.slug}`}
            onReady={onFeedReady}
            emptyTitle="Henüz gönderi yok"
            emptyDescription={
              isMember
                ? "İlk paylaşımı sen yap ve topluluğu canlandır."
                : "Katıldıktan sonra paylaşım yapabilirsin."
            }
          />
        </>
      ) : tab === "MEMBERS" ? (
        <MembersTab communityId={community.id} isStaff={isStaff} />
      ) : (
        <AboutTab community={community} moderators={moderators} />
      )}
    </div>
  );
}

function MembersTab({ communityId, isStaff }: { communityId: string; isStaff: boolean }) {
  const [members, setMembers] = useState<
    (MiniUser & { role: string; department: string | null; classYear: number | null; karma: number })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api
        .get<{ items: typeof members }>(
          `/communities/${communityId}/members?limit=50${query ? `&q=${encodeURIComponent(query)}` : ""}`,
        )
        .then((d) => setMembers(d.items))
        .catch(() => setMembers([]))
        .finally(() => setLoading(false));
    }, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [communityId, query]);

  const ROLE_LABEL: Record<string, string> = {
    OWNER: "Kurucu",
    MODERATOR: "Moderatör",
    MEMBER: "Üye",
  };

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Üye ara..."
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2.5 text-[15px] outline-none focus-ring"
      />

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : (
        <div className="surface divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)]">
          {members.map((member) => (
            <Link
              key={member.id}
              href={`/u/${member.username}`}
              className="flex items-center gap-3 p-3.5 transition-colors hover:bg-[var(--bg-subtle)]"
            >
              <Avatar src={member.avatarUrl} name={member.displayName} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-semibold">{member.displayName}</span>
                  {member.role !== "MEMBER" && (
                    <span className="shrink-0 rounded brand-soft-bg px-1.5 py-0.5 text-[10.5px] font-bold brand-text">
                      {ROLE_LABEL[member.role]}
                    </span>
                  )}
                </div>
                <span className="block truncate text-[12.5px] text-faint">
                  @{member.username}
                  {member.department ? ` · ${member.department}` : ""}
                  {classYearLabel(member.classYear) ? ` · ${classYearLabel(member.classYear)}` : ""}
                </span>
              </div>
              {isStaff && <span className="text-[12px] text-faint">{member.karma} karma</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AboutTab({
  community,
  moderators,
}: {
  community: Community;
  moderators: (MiniUser & { role: string })[];
}) {
  return (
    <div className="space-y-3">
      <section className="surface rounded-[var(--radius-card)] p-4">
        <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold">
          <ShieldCheckIcon width={17} height={17} className="brand-text" />
          Topluluk kuralları
        </h2>
        {community.rules.length > 0 ? (
          <ol className="space-y-2">
            {community.rules.map((rule, i) => (
              <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-muted">
                <span className="font-bold brand-text">{i + 1}.</span>
                {rule}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[14px] text-muted">
            Bu topluluk için özel kural belirlenmemiş. Platform genelindeki{" "}
            <Link href="/kurallar" className="brand-text hover:underline">
              topluluk kuralları
            </Link>{" "}
            geçerlidir.
          </p>
        )}
      </section>

      <section className="surface rounded-[var(--radius-card)] p-4">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold">
          <UsersIcon width={17} height={17} className="brand-text" />
          Yöneticiler
        </h2>
        <div className="space-y-2.5">
          {moderators.map((mod) => (
            <Link key={mod.id} href={`/u/${mod.username}`} className="flex items-center gap-2.5">
              <Avatar src={mod.avatarUrl} name={mod.displayName} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold hover:underline">
                  {mod.displayName}
                </span>
                <span className="block text-[12px] text-faint">
                  {mod.role === "OWNER" ? "Kurucu" : "Moderatör"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="surface rounded-[var(--radius-card)] p-4 text-[13.5px] text-muted">
        Kuruluş: {new Date(community.createdAt).toLocaleDateString("tr-TR", { dateStyle: "long" })}
      </section>
    </div>
  );
}
