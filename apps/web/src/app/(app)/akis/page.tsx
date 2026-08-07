"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Composer } from "@/components/Composer";
import { Feed, type FeedHandle } from "@/components/Feed";
import { useAuth } from "@/lib/auth";
import { Button, cx } from "@/components/ui";

const TABS = [
  { key: "HOME", label: "Sana Özel" },
  { key: "UNIVERSITY", label: "Üniversitem" },
  { key: "DEPARTMENT", label: "Bölümüm" },
  { key: "EXPLORE", label: "Popüler" },
] as const;

export default function HomePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("HOME");
  const feedRef = useRef<FeedHandle | null>(null);

  const onReady = useCallback((handle: FeedHandle) => {
    feedRef.current = handle;
  }, []);

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-3">
      <div className="glass sticky top-[57px] z-20 -mx-3 flex gap-1 overflow-x-auto border-b border-[var(--border)] px-3 py-2 no-scrollbar sm:top-0 sm:mx-0 sm:rounded-t-[var(--radius-card)] sm:px-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              "relative shrink-0 rounded-lg px-3.5 py-2 text-[14px] font-semibold transition-colors",
              tab === t.key
                ? "brand-text"
                : "text-muted hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]",
            )}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute inset-x-3 -bottom-2 h-[3px] rounded-full bg-[var(--brand)]" />
            )}
          </button>
        ))}
      </div>

      <Composer onPosted={(post) => feedRef.current?.prepend(post)} />

      {tab === "DEPARTMENT" && !user?.department && (
        <div className="surface rounded-[var(--radius-card)] p-4 text-sm">
          <p className="text-muted">
            Bölüm akışını görmek için profilinde bölümünü seçmelisin.
          </p>
          <Link href="/ayarlar">
            <Button size="sm" className="mt-3">
              Bölümümü seç
            </Button>
          </Link>
        </div>
      )}

      <Feed
        query={`tab=${tab}`}
        onReady={onReady}
        emptyTitle={
          tab === "HOME"
            ? "Akışın henüz boş"
            : tab === "UNIVERSITY"
              ? "Üniversitenden henüz paylaşım yok"
              : tab === "DEPARTMENT"
                ? "Bölümünden henüz paylaşım yok"
                : "Popüler gönderi yok"
        }
        emptyDescription={
          tab === "HOME"
            ? "Topluluklara katıl ve insanları takip et — akışın dolmaya başlasın."
            : "İlk paylaşımı sen yap, kampüsteki sohbeti başlat."
        }
        emptyAction={
          tab === "HOME" ? (
            // Boş akış, hesabı yeni açılmış birinin ilk gördüğü şey olabiliyor —
            // onu kişi ve topluluk önerilerine yolla, çıplak listeye değil.
            <Link href="/hosgeldin">
              <Button>Kimleri takip edeceğini gör</Button>
            </Link>
          ) : undefined
        }
      />
    </div>
  );
}
