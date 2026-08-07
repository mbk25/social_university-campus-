"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getSocket } from "@/lib/socket";
import type { Notification } from "@/lib/types";
import {
  BellIcon,
  BookIcon,
  CalendarIcon,
  ChatIcon,
  CompassIcon,
  HomeIcon,
  LogoutIcon,
  MaskIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  UsersIcon,
} from "./icons";
import { Avatar, Button, Modal, Spinner, cx } from "./ui";
import { Composer } from "./Composer";

interface NavItem {
  href: string;
  label: string;
  icon: (p: { width?: number; height?: number; filled?: boolean }) => React.ReactNode;
  badge?: "notifications" | "messages";
  mobile?: boolean;
}

const NAV: NavItem[] = [
  { href: "/akis", label: "Ana Sayfa", icon: HomeIcon, mobile: true },
  { href: "/kesfet", label: "Keşfet", icon: CompassIcon, mobile: true },
  { href: "/topluluklar", label: "Topluluklar", icon: UsersIcon, mobile: true },
  { href: "/mesajlar", label: "Mesajlar", icon: ChatIcon, badge: "messages", mobile: true },
  { href: "/bildirimler", label: "Bildirimler", icon: BellIcon, badge: "notifications" },
  { href: "/etkinlikler", label: "Etkinlikler", icon: CalendarIcon },
  { href: "/notlar", label: "Ders Notları", icon: BookIcon },
  { href: "/itiraflar", label: "İtiraflar", icon: MaskIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout, unreadNotifications, unreadMessages, setCounts } = useAuth();
  const [dark, setDark] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("kampus.theme", next ? "dark" : "light");
    setDark(next);
  }, []);

  // Okunmamış sayaçları + canlı bildirimler
  useEffect(() => {
    if (!user) return;

    const load = () =>
      api
        .get<{ notifications: number; messages: number }>("/notifications/unread-count")
        .then((data) => setCounts(data))
        .catch(() => undefined);

    void load();
    const interval = setInterval(load, 60_000);

    const socket = getSocket();
    const onNotification = (n: Notification) => {
      setCounts({ notifications: unreadNotifications + 1 });
      if ("Notification" in window && window.Notification.permission === "granted") {
        new window.Notification("Kampus", { body: n.text, icon: "/icon.svg" });
      }
    };
    const onConversation = () => void load();

    socket?.on("notification:new", onNotification);
    socket?.on("conversation:updated", onConversation);

    return () => {
      clearInterval(interval);
      socket?.off("notification:new", onNotification);
      socket?.off("conversation:updated", onConversation);
    };
    // unreadNotifications kasıtlı olarak bağımlılık değil: her bildirimde
    // yeniden abone olmamak için sayaç fonksiyonel biçimde artırılıyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, setCounts]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={28} className="brand-text" />
      </div>
    );
  }

  const badgeFor = (item: NavItem) =>
    item.badge === "notifications" ? unreadNotifications : item.badge === "messages" ? unreadMessages : 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1280px] gap-6 px-0 sm:px-4">
      {/* ---------------------------------------------------------- Sol menü */}
      <aside className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col py-4 lg:flex xl:w-[248px]">
        <Link href="/akis" className="mb-5 flex items-center gap-2.5 px-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#8f74ff] to-[#5836c9] text-lg font-black text-white">
            K
          </span>
          <span className="hidden text-[19px] font-black tracking-tight xl:block">Kampus</span>
        </Link>

        <nav className="flex-1 space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            const badge = badgeFor(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "group relative flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
                  active
                    ? "brand-soft-bg brand-text font-semibold"
                    : "text-muted hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]",
                )}
                title={item.label}
              >
                <span className="relative">
                  <Icon width={22} height={22} filled={active} />
                  {badge > 0 && (
                    <span className="absolute -right-1.5 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                <span className="hidden xl:block">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 pt-3">
          <Button
            onClick={() => setComposeOpen(true)}
            fullWidth
            size="lg"
            className="hidden xl:flex"
            icon={<PlusIcon width={18} height={18} />}
          >
            Paylaş
          </Button>
          <button
            onClick={() => setComposeOpen(true)}
            className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand)] text-white xl:hidden"
            aria-label="Paylaş"
          >
            <PlusIcon width={20} height={20} />
          </button>

          {user && (
            <div className="mt-2 border-t border-[var(--border)] pt-3">
              <Link
                href={`/u/${user.username}`}
                className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--bg-subtle)]"
              >
                <Avatar src={user.avatarUrl} name={user.displayName} size="sm" />
                <span className="hidden min-w-0 flex-1 xl:block">
                  <span className="block truncate text-[14px] font-semibold">{user.displayName}</span>
                  <span className="block truncate text-[12.5px] text-faint">@{user.username}</span>
                </span>
              </Link>
              <div className="mt-1 flex items-center gap-1 px-1">
                <IconAction onClick={toggleTheme} label="Tema">
                  {dark ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
                </IconAction>
                <IconAction onClick={() => router.push("/ayarlar")} label="Ayarlar">
                  <SettingsIcon width={18} height={18} />
                </IconAction>
                <IconAction onClick={() => void logout()} label="Çıkış">
                  <LogoutIcon width={18} height={18} />
                </IconAction>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------- İçerik alanı */}
      <div className="min-w-0 flex-1 pb-20 lg:pb-8">
        {/* Mobil üst çubuk */}
        <header className="glass sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 lg:hidden">
          <Link href="/akis" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#8f74ff] to-[#5836c9] text-base font-black text-white">
              K
            </span>
            <span className="text-[17px] font-black tracking-tight">Kampus</span>
          </Link>
          <div className="flex items-center gap-1">
            <IconAction onClick={() => setSearchOpen(true)} label="Ara">
              <SearchIcon width={20} height={20} />
            </IconAction>
            <IconAction onClick={toggleTheme} label="Tema">
              {dark ? <SunIcon width={20} height={20} /> : <MoonIcon width={20} height={20} />}
            </IconAction>
            <Link href="/bildirimler" className="relative">
              <IconAction label="Bildirimler">
                <BellIcon width={20} height={20} />
              </IconAction>
              {unreadNotifications > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
              )}
            </Link>
          </div>
        </header>

        <main className="px-3 py-4 sm:px-0">{children}</main>
      </div>

      {/* --------------------------------------------------------- Sağ sütun */}
      <aside className="sticky top-0 hidden h-screen w-[320px] shrink-0 flex-col gap-4 overflow-y-auto py-4 no-scrollbar xl:flex">
        <SearchBar />
        <RightRail />
      </aside>

      {/* ------------------------------------------------------- Mobil menü */}
      <nav className="glass fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[var(--border)] px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 lg:hidden">
        {NAV.filter((i) => i.mobile).map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          const badge = badgeFor(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10.5px] font-medium transition-colors",
                active ? "brand-text" : "text-faint",
              )}
            >
              <span className="relative">
                <Icon width={23} height={23} filled={active} />
                {badge > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
        {user && (
          <Link
            href={`/u/${user.username}`}
            className={cx(
              "relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10.5px] font-medium transition-colors",
              pathname === `/u/${user.username}` ? "brand-text" : "text-faint",
            )}
            aria-label="Profil"
          >
            <Avatar src={user.avatarUrl} name={user.displayName} size="xs" />
            Profil
          </Link>
        )}
        <button
          onClick={() => setComposeOpen(true)}
          className="mx-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-lg"
          aria-label="Paylaş"
        >
          <PlusIcon width={22} height={22} />
        </button>
      </nav>

      <Modal open={composeOpen} onClose={() => setComposeOpen(false)} title="Yeni gönderi">
        <Composer autoFocus onPosted={() => setComposeOpen(false)} />
      </Modal>

      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Ara">
        <SearchBar autoFocus onNavigate={() => setSearchOpen(false)} />
      </Modal>
    </div>
  );
}

function IconAction({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-lg p-2 text-muted transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
    >
      {children}
    </button>
  );
}

function SearchBar({
  autoFocus,
  onNavigate,
}: {
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{
    users: { id: string; username: string; displayName: string; avatarUrl: string | null; department: string | null }[];
    communities: { id: string; slug: string; name: string; avatarUrl: string | null; memberCount: number }[];
  } | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      api
        .get<typeof results>(`/search/quick?q=${encodeURIComponent(query.trim())}`)
        .then(setResults)
        .catch(() => setResults(null));
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  function go(href: string) {
    setQuery("");
    setResults(null);
    onNavigate?.();
    router.push(href);
  }

  return (
    <div className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) go(`/ara?q=${encodeURIComponent(query.trim())}`);
        }}
      >
        <SearchIcon
          width={18}
          height={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kişi, topluluk, gönderi ara..."
          className="w-full rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] py-2.5 pl-10 pr-4 text-[14px] outline-none transition-colors focus-ring focus:border-[var(--brand)]"
        />
      </form>

      {results && (results.users.length > 0 || results.communities.length > 0) && (
        <div className="surface absolute inset-x-0 top-12 z-30 overflow-hidden rounded-2xl py-1.5">
          {results.users.map((u) => (
            <button
              key={u.id}
              onClick={() => go(`/u/${u.username}`)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--bg-subtle)]"
            >
              <Avatar src={u.avatarUrl} name={u.displayName} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold">{u.displayName}</span>
                <span className="block truncate text-[12px] text-faint">
                  @{u.username}
                  {u.department ? ` · ${u.department}` : ""}
                </span>
              </span>
            </button>
          ))}
          {results.communities.map((c) => (
            <button
              key={c.id}
              onClick={() => go(`/topluluk/${c.slug}`)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--bg-subtle)]"
            >
              <Avatar src={c.avatarUrl} name={c.name} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold">{c.name}</span>
                <span className="block text-[12px] text-faint">{c.memberCount} üye</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RightRail() {
  const [data, setData] = useState<{
    trending: { tag: string; postCount: number }[];
    suggestedCommunities: {
      id: string;
      slug: string;
      name: string;
      avatarUrl: string | null;
      memberCount: number;
      scope: string;
      department: string | null;
    }[];
  } | null>(null);
  const [people, setPeople] = useState<
    { id: string; username: string; displayName: string; avatarUrl: string | null; department: string | null }[]
  >([]);

  useEffect(() => {
    api.get<typeof data>("/feed/trending").then(setData).catch(() => undefined);
    api
      .get<{ items: typeof people }>("/users/me/suggestions")
      .then((d) => setPeople(d.items.slice(0, 4)))
      .catch(() => undefined);
  }, []);

  return (
    <>
      {data && data.trending.length > 0 && (
        <section className="surface rounded-[var(--radius-card)] p-4">
          <h2 className="mb-3 text-[15px] font-bold">Gündem</h2>
          <ul className="space-y-1">
            {data.trending.slice(0, 6).map((t, i) => (
              <li key={t.tag}>
                <Link
                  href={`/etiket/${encodeURIComponent(t.tag)}`}
                  className="-mx-2 flex items-baseline gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--bg-subtle)]"
                >
                  <span className="w-4 text-[13px] font-bold text-faint">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">#{t.tag}</span>
                    <span className="text-[12px] text-faint">{t.postCount} gönderi</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {people.length > 0 && (
        <section className="surface rounded-[var(--radius-card)] p-4">
          <h2 className="mb-3 text-[15px] font-bold">Tanıyor olabilirsin</h2>
          <ul className="space-y-2.5">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5">
                <Link href={`/u/${p.username}`}>
                  <Avatar src={p.avatarUrl} name={p.displayName} size="sm" />
                </Link>
                <Link href={`/u/${p.username}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold hover:underline">
                    {p.displayName}
                  </span>
                  <span className="block truncate text-[12px] text-faint">
                    {p.department ?? `@${p.username}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && data.suggestedCommunities.length > 0 && (
        <section className="surface rounded-[var(--radius-card)] p-4">
          <h2 className="mb-3 text-[15px] font-bold">Sana uygun topluluklar</h2>
          <ul className="space-y-2.5">
            {data.suggestedCommunities.map((c) => (
              <li key={c.id} className="flex items-center gap-2.5">
                <Avatar src={c.avatarUrl} name={c.name} size="sm" />
                <Link href={`/topluluk/${c.slug}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold hover:underline">
                    {c.name}
                  </span>
                  <span className="block text-[12px] text-faint">{c.memberCount} üye</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/topluluklar"
            className="mt-3 block text-[13px] font-semibold brand-text hover:underline"
          >
            Tümünü gör →
          </Link>
        </section>
      )}

      <p className="px-2 text-[12px] leading-relaxed text-faint">
        Kampus · Sadece doğrulanmış üniversite öğrencilerine açıktır.
        <br />
        <Link href="/kurallar" className="hover:underline">
          Topluluk kuralları
        </Link>
        {" · "}
        <Link href="/gizlilik" className="hover:underline">
          Gizlilik
        </Link>
      </p>
    </>
  );
}
