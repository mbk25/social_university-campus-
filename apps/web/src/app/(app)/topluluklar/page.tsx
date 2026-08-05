"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Community } from "@/lib/types";
import { CommunityRow } from "@/components/CommunityRow";
import { CreateCommunityModal } from "@/components/CreateCommunityModal";
import { PlusIcon, SearchIcon, UsersIcon } from "@/components/icons";
import { Button, EmptyState, Skeleton, cx } from "@/components/ui";

const FILTERS = [
  { key: "SUGGESTED", label: "Sana uygun" },
  { key: "MINE", label: "Üye olduklarım" },
  { key: "ALL", label: "Tümü" },
] as const;

const SCOPES = [
  { key: "ALL", label: "Hepsi" },
  { key: "DEPARTMENT", label: "Bölüm" },
  { key: "UNIVERSITY", label: "Üniversite" },
  { key: "GLOBAL", label: "Genel" },
] as const;

export default function CommunitiesPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("SUGGESTED");
  const [scope, setScope] = useState<(typeof SCOPES)[number]["key"]>("ALL");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter, scope, limit: "40" });
      if (query.trim()) params.set("q", query.trim());
      const data = await api.get<{ items: Community[] }>(`/communities?${params}`);
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter, scope, query]);

  useEffect(() => {
    const t = setTimeout(() => void load(), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-black tracking-tight">Topluluklar</h1>
          <p className="mt-1 text-[14px] text-muted">
            {user?.university?.shortName
              ? `${user.university.shortName} ve tüm Türkiye'den öğrenci toplulukları`
              : "Bölümüne ve ilgi alanına göre toplulukları keşfet"}
          </p>
        </div>
        <Button icon={<PlusIcon width={17} height={17} />} onClick={() => setCreateOpen(true)}>
          <span className="hidden sm:inline">Topluluk kur</span>
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
          placeholder="Topluluk ara..."
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] py-2.5 pl-10 pr-4 text-[15px] outline-none focus-ring focus:border-[var(--brand)]"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cx(
              "rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors",
              filter === f.key ? "bg-[var(--brand)] text-white" : "surface-subtle text-muted",
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="mx-1 w-px self-stretch bg-[var(--border)]" />
        {SCOPES.map((s) => (
          <button
            key={s.key}
            onClick={() => setScope(s.key)}
            className={cx(
              "rounded-full px-3.5 py-1.5 text-[13.5px] font-medium transition-colors",
              scope === s.key
                ? "border border-[var(--brand)] brand-text"
                : "surface-subtle text-muted",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="surface flex gap-3 rounded-[var(--radius-card)] p-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<UsersIcon width={26} height={26} />}
          title={query ? "Sonuç bulunamadı" : "Henüz topluluk yok"}
          description={
            filter === "MINE"
              ? "Henüz bir topluluğa üye değilsin. Sana uygun sekmesine göz at."
              : "İlk topluluğu sen kur ve kampüsündeki insanları bir araya getir."
          }
          action={
            <Button onClick={() => setCreateOpen(true)} icon={<PlusIcon width={17} height={17} />}>
              Topluluk kur
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((community) => (
            <CommunityRow key={community.id} community={community} onChange={load} />
          ))}
        </div>
      )}

      <CreateCommunityModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}
