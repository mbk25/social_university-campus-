"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";
import { Avatar, Button, Spinner, formatCount, useToast } from "@/components/ui";
import { CheckIcon, ShareIcon, UsersIcon } from "@/components/icons";

/** /feed/trending topluluğun tamamını değil, bu alanları döndürüyor. */
interface SuggestedCommunity {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  memberCount: number;
  scope: "DEPARTMENT" | "UNIVERSITY" | "GLOBAL";
  department: string | null;
}

const SCOPE_LABEL = {
  DEPARTMENT: "Bölüm",
  UNIVERSITY: "Üniversite",
  GLOBAL: "Genel",
} as const;

export default function WelcomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<User[]>([]);
  const [communities, setCommunities] = useState<SuggestedCommunity[]>([]);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let iptal = false;

    // İki öneri de bağımsız; biri patlarsa diğeri yine gösterilsin.
    Promise.allSettled([
      api.get<{ items: User[] }>("/users/me/suggestions"),
      api.get<{ suggestedCommunities: SuggestedCommunity[] }>("/feed/trending"),
    ]).then(([kisiler, topluluklar]) => {
      if (iptal) return;
      if (kisiler.status === "fulfilled") setPeople(kisiler.value.items);
      if (topluluklar.status === "fulfilled") {
        setCommunities(topluluklar.value.suggestedCommunities);
      }
      setLoading(false);
    });

    return () => {
      iptal = true;
    };
  }, []);

  const isBusy = useCallback((id: string) => busy.has(id), [busy]);

  const withBusy = useCallback(async (id: string, fn: () => Promise<void>) => {
    setBusy((s) => new Set(s).add(id));
    try {
      await fn();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "İşlem yapılamadı", "error");
    } finally {
      setBusy((s) => {
        const yeni = new Set(s);
        yeni.delete(id);
        return yeni;
      });
    }
  }, [toast]);

  function toggleFollow(kisi: User) {
    void withBusy(kisi.id, async () => {
      if (followed.has(kisi.id)) {
        await api.delete(`/users/${kisi.username}/follow`);
        setFollowed((s) => {
          const yeni = new Set(s);
          yeni.delete(kisi.id);
          return yeni;
        });
      } else {
        await api.post(`/users/${kisi.username}/follow`);
        setFollowed((s) => new Set(s).add(kisi.id));
      }
    });
  }

  function toggleJoin(topluluk: SuggestedCommunity) {
    void withBusy(topluluk.id, async () => {
      if (joined.has(topluluk.id)) {
        await api.delete(`/communities/${topluluk.id}/leave`);
        setJoined((s) => {
          const yeni = new Set(s);
          yeni.delete(topluluk.id);
          return yeni;
        });
      } else {
        const sonuc = await api.post<{ joined: boolean; pending?: boolean }>(
          `/communities/${topluluk.id}/join`,
        );
        if (sonuc.joined) setJoined((s) => new Set(s).add(topluluk.id));
        else toast.show("Katılım isteğin gönderildi", "success");
      }
    });
  }

  async function inviteLink() {
    const adres = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Kampus",
          text: "Üniversite öğrencilerinin sosyal ağı — sadece okul e-postasıyla giriliyor.",
          url: adres,
        });
        return;
      }
      await navigator.clipboard.writeText(adres);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Kullanıcı paylaşım penceresini kapattıysa sessiz geç.
    }
  }

  const secilen = followed.size + joined.size;
  const bosMu = !loading && people.length === 0 && communities.length === 0;

  const devamEtiketi = useMemo(() => {
    if (bosMu) return "Akışa git";
    return secilen > 0 ? "Akışa git" : "Şimdilik geç";
  }, [bosMu, secilen]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size={28} className="brand-text" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-5 pb-24">
      {/* ------------------------------------------------------------ başlık */}
      <div className="pt-2 text-center">
        <h1 className="text-[26px] font-black tracking-tight sm:text-[32px]">
          Hoş geldin{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""} 🎓
        </h1>
        <p className="mx-auto mt-2 max-w-[420px] text-[15px] leading-relaxed text-muted">
          {bosMu
            ? "Kampüsünde ilk sen varsın. Aşağıdan arkadaşlarını çağır, sohbeti sen başlat."
            : "Birkaç kişiyi takip et ve topluluklara katıl — akışın dolu başlasın."}
        </p>
      </div>

      {/* ------------------------------------------------------- boş durum */}
      {bosMu && (
        <div className="surface rounded-[var(--radius-card)] p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl brand-soft-bg brand-text">
            <UsersIcon width={26} height={26} />
          </span>
          <h2 className="mt-4 text-[18px] font-bold tracking-tight">
            Üniversitenden henüz kimse yok
          </h2>
          <p className="mx-auto mt-2 max-w-[380px] text-[14px] leading-relaxed text-muted">
            Kampus yeni bir yer ve senin okulunda ilk üye sensin. Bir sosyal ağın
            değeri içindeki insanlardan gelir — birkaç arkadaşını çağırırsan burası
            hemen canlanır.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={inviteLink} icon={<ShareIcon width={15} height={15} />}>
              {copied ? "Bağlantı kopyalandı" : "Arkadaşlarını çağır"}
            </Button>
            <Link href="/topluluklar">
              <Button variant="secondary" className="w-full sm:w-auto">
                Topluluk oluştur
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- kişiler */}
      {people.length > 0 && (
        <section className="surface rounded-[var(--radius-card)] p-4 sm:p-5">
          <h2 className="text-[17px] font-bold tracking-tight">Tanıyor olabilirsin</h2>
          <p className="mt-1 text-[13.5px] text-muted">
            Aynı bölüm ve üniversiteden kişiler önce geliyor.
          </p>

          <ul className="mt-4 space-y-1">
            {people.map((kisi) => {
              const takipte = followed.has(kisi.id);
              return (
                <li
                  key={kisi.id}
                  className="flex items-center gap-3 rounded-xl px-1 py-2 transition-colors hover:bg-[var(--bg-subtle)]"
                >
                  <Link href={`/u/${kisi.username}`} className="shrink-0">
                    <Avatar src={kisi.avatarUrl} name={kisi.displayName} size="md" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/u/${kisi.username}`}
                      className="block truncate text-[14.5px] font-semibold hover:underline"
                    >
                      {kisi.displayName}
                    </Link>
                    <p className="truncate text-[13px] text-faint">
                      @{kisi.username}
                      {kisi.department ? ` · ${kisi.department}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={takipte ? "secondary" : "primary"}
                    loading={isBusy(kisi.id)}
                    onClick={() => toggleFollow(kisi)}
                    icon={takipte ? <CheckIcon width={14} height={14} /> : undefined}
                    className="shrink-0"
                  >
                    {takipte ? "Takiptesin" : "Takip et"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------------ topluluklar */}
      {communities.length > 0 && (
        <section className="surface rounded-[var(--radius-card)] p-4 sm:p-5">
          <h2 className="text-[17px] font-bold tracking-tight">Sana uygun topluluklar</h2>
          <p className="mt-1 text-[13.5px] text-muted">
            Katıldığın toplulukların gönderileri akışında görünür.
          </p>

          <ul className="mt-4 space-y-1">
            {communities.map((topluluk) => {
              const uye = joined.has(topluluk.id);
              return (
                <li
                  key={topluluk.id}
                  className="flex items-center gap-3 rounded-xl px-1 py-2 transition-colors hover:bg-[var(--bg-subtle)]"
                >
                  <Link href={`/topluluk/${topluluk.slug}`} className="shrink-0">
                    <Avatar
                      src={topluluk.avatarUrl}
                      name={topluluk.name}
                      size="md"
                      className="rounded-xl"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/topluluk/${topluluk.slug}`}
                      className="block truncate text-[14.5px] font-semibold hover:underline"
                    >
                      {topluluk.name}
                    </Link>
                    <p className="truncate text-[13px] text-faint">
                      {formatCount(topluluk.memberCount)} üye · {SCOPE_LABEL[topluluk.scope]}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={uye ? "secondary" : "primary"}
                    loading={isBusy(topluluk.id)}
                    onClick={() => toggleJoin(topluluk)}
                    icon={uye ? <CheckIcon width={14} height={14} /> : undefined}
                    className="shrink-0"
                  >
                    {uye ? "Üyesin" : "Katıl"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* --------------------------------------------------- alttaki eylem */}
      <div className="glass fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] px-4 py-3 sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-[620px] items-center gap-3">
          {secilen > 0 && (
            <span className="hidden text-[13.5px] text-muted sm:block">
              {followed.size > 0 && `${followed.size} kişi`}
              {followed.size > 0 && joined.size > 0 && " · "}
              {joined.size > 0 && `${joined.size} topluluk`}
            </span>
          )}
          <Button
            className="ml-auto w-full sm:w-auto"
            onClick={() => router.replace("/akis")}
          >
            {devamEtiketi}
          </Button>
        </div>
      </div>
    </div>
  );
}
