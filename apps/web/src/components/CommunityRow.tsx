"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { Community } from "@/lib/types";
import { LockIcon } from "./icons";
import { Avatar, Button, formatCount, useToast } from "./ui";

const SCOPE_LABEL = {
  DEPARTMENT: "Bölüm",
  UNIVERSITY: "Üniversite",
  GLOBAL: "Genel",
} as const;

export function CommunityRow({
  community,
  onChange,
}: {
  community: Community;
  onChange?: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(community.viewer);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      if (state?.isMember) {
        await api.delete(`/communities/${community.id}/leave`);
        setState({ isMember: false, role: null, hasPendingRequest: false });
        toast.show(`${community.name} topluluğundan ayrıldın`, "info");
      } else {
        const result = await api.post<{ joined: boolean; pending?: boolean }>(
          `/communities/${community.id}/join`,
        );
        if (result.joined) {
          setState({ isMember: true, role: "MEMBER", hasPendingRequest: false });
          toast.show(`${community.name} topluluğuna katıldın 🎉`, "success");
        } else {
          setState({ isMember: false, role: null, hasPendingRequest: true });
          toast.show("Katılım isteğin gönderildi", "success");
        }
      }
      onChange?.();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "İşlem yapılamadı", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Link
      href={`/topluluk/${community.slug}`}
      className="surface flex items-start gap-3.5 rounded-[var(--radius-card)] p-4 transition-colors hover:bg-[var(--bg-subtle)]"
    >
      <Avatar src={community.avatarUrl} name={community.name} size="lg" className="rounded-2xl" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="truncate text-[16px] font-bold">{community.name}</h3>
          {community.visibility === "PRIVATE" && (
            <LockIcon width={14} height={14} className="shrink-0 text-faint" />
          )}
          <span className="rounded-md brand-soft-bg px-1.5 py-0.5 text-[11px] font-semibold brand-text">
            {SCOPE_LABEL[community.scope]}
          </span>
        </div>

        {community.description && (
          <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-muted">
            {community.description}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-faint">
          <span>{formatCount(community.memberCount)} üye</span>
          <span>·</span>
          <span>{formatCount(community.postCount)} gönderi</span>
          {community.university && (
            <>
              <span>·</span>
              <span className="truncate">{community.university.shortName}</span>
            </>
          )}
        </div>
      </div>

      <Button
        size="sm"
        variant={state?.isMember ? "secondary" : "primary"}
        loading={busy}
        onClick={toggle}
        disabled={state?.hasPendingRequest}
        className="shrink-0"
      >
        {state?.hasPendingRequest ? "Beklemede" : state?.isMember ? "Üyesin" : "Katıl"}
      </Button>
    </Link>
  );
}
