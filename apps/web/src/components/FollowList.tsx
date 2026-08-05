"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { ArrowLeftIcon, UsersIcon } from "./icons";
import { Avatar, EmptyState, Skeleton } from "./ui";

export function FollowList({
  username,
  kind,
}: {
  username: string;
  kind: "followers" | "following";
}) {
  const router = useRouter();
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ items: User[] }>(`/users/${username}/${kind}?limit=50`)
      .then((d) => setItems(d.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [username, kind]);

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-4">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-[14px] font-medium text-muted hover:text-[var(--text)]"
      >
        <ArrowLeftIcon width={18} height={18} /> Geri
      </button>

      <h1 className="text-[24px] font-black tracking-tight">
        @{username} · {kind === "followers" ? "Takipçiler" : "Takip edilenler"}
      </h1>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<UsersIcon width={26} height={26} />}
          title={kind === "followers" ? "Henüz takipçi yok" : "Henüz kimseyi takip etmiyor"}
        />
      ) : (
        <div className="surface divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)]">
          {items.map((u) => (
            <Link
              key={u.id}
              href={`/u/${u.username}`}
              className="flex items-center gap-3 p-3.5 transition-colors hover:bg-[var(--bg-subtle)]"
            >
              <Avatar src={u.avatarUrl} name={u.displayName} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{u.displayName}</span>
                <span className="block truncate text-[12.5px] text-faint">
                  @{u.username}
                  {u.department ? ` · ${u.department}` : ""}
                </span>
                {u.bio && <span className="mt-0.5 line-clamp-1 block text-[13px] text-muted">{u.bio}</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
