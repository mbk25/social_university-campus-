"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar, Button, EmptyState, Spinner } from "@/components/ui";
import { ShieldCheckIcon } from "@/components/icons";

type Overview = {
  totalUsers: number;
  newUsers: number;
  activeToday: number;
  openReports: number;
  totalPosts: number;
  newPosts: number;
  communities: number;
  recentUsers: Array<{
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    status: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
    isVerified: boolean;
    createdAt: string;
    university: string | null;
  }>;
};

const number = new Intl.NumberFormat("tr-TR");

function joinedAt(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ManagementPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await api.get<Overview>("/admin/overview");
      setOverview(result);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? "Bu sayfa için yönetim yetkin yok." : "Yönetim verileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "STUDENT") {
      setLoading(false);
      setError("Bu sayfa için yönetim yetkin yok.");
      return;
    }
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
  }, [load, user?.role]);

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Spinner size={28} className="brand-text" /></div>;
  }

  if (error || !overview) {
    return <EmptyState icon={<ShieldCheckIcon width={28} height={28} />} title="Yönetim ekranına erişilemiyor" description={error ?? undefined} />;
  }

  const stats = [
    ["Toplam kullanıcı", overview.totalUsers, "Doğrulanmış ve aktif hesaplar"],
    ["Bugün yeni kayıt", overview.newUsers, "Son 24 saatte katılanlar"],
    ["Bugün aktif", overview.activeToday, "Son 24 saatte uygulamayı kullananlar"],
    ["Açık şikayet", overview.openReports, "İncelenmeyi bekleyen şikayetler"],
    ["Toplam gönderi", overview.totalPosts, `Bugün ${number.format(overview.newPosts)} yeni gönderi`],
    ["Topluluklar", overview.communities, "Aktif topluluk sayısı"],
  ];

  return (
    <div className="mx-auto max-w-[820px] space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 brand-text"><ShieldCheckIcon width={20} height={20} /><span className="text-sm font-semibold">Yönetim</span></div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Kampus özeti</h1>
          <p className="mt-1 text-sm text-muted">Yeni kayıtlar otomatik olarak her dakika yenilenir.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>Yenile</Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(([label, value, description]) => (
          <div key={label} className="surface rounded-2xl p-4">
            <p className="text-[13px] font-medium text-muted">{label}</p>
            <p className="mt-1 text-2xl font-black">{number.format(value as number)}</p>
            <p className="mt-1 text-[12px] text-faint">{description}</p>
          </div>
        ))}
      </section>

      <section className="surface overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-bold">Son kayıt olanlar</h2>
            <p className="mt-0.5 text-[13px] text-muted">En yeni 20 hesap</p>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[12px] font-semibold text-emerald-500">Canlı takip</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {overview.recentUsers.map((account) => (
            <Link key={account.id} href={`/u/${account.username}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--bg-subtle)] sm:px-5">
              <Avatar src={account.avatarUrl} name={account.displayName} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5"><span className="truncate text-sm font-semibold">{account.displayName}</span>{account.isVerified && <ShieldCheckIcon width={14} height={14} className="shrink-0 brand-text" />}</span>
                <span className="block truncate text-[12.5px] text-faint">@{account.username}{account.university ? ` · ${account.university}` : ""}</span>
              </span>
              <span className="shrink-0 text-right text-[12px] text-faint">
                <span className={account.status === "ACTIVE" ? "text-emerald-500" : account.status === "PENDING_VERIFICATION" ? "text-amber-500" : "text-rose-500"}>{account.status === "ACTIVE" ? "Aktif" : account.status === "PENDING_VERIFICATION" ? "Doğrulama bekliyor" : "Pasif"}</span>
                <span className="mt-0.5 block">{joinedAt(account.createdAt)}</span>
              </span>
            </Link>
          ))}
          {overview.recentUsers.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">Henüz kayıt yok.</p>}
        </div>
      </section>
    </div>
  );
}
