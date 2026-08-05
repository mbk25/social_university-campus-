"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { KampusEvent } from "@/lib/types";
import { MapPinIcon, UsersIcon } from "./icons";
import { Avatar, Button, useToast } from "./ui";

export function EventCard({ event, onChange }: { event: KampusEvent; onChange?: () => void }) {
  const toast = useToast();
  const [attending, setAttending] = useState(!!event.viewer?.isAttending);
  const [count, setCount] = useState(event.attendeeCount);
  const [busy, setBusy] = useState(false);

  const start = new Date(event.startsAt);
  const isFull = !!event.capacity && count >= event.capacity && !attending;

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await (attending
        ? api.delete<{ attendeeCount: number }>(`/events/${event.id}/attend`)
        : api.post<{ attendeeCount: number }>(`/events/${event.id}/attend`));
      setAttending(!attending);
      setCount(result.attendeeCount);
      onChange?.();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "İşlem yapılamadı", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="surface overflow-hidden rounded-[var(--radius-card)]">
      <div className="flex gap-4 p-4">
        <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl brand-soft-bg py-2">
          <span className="text-[11px] font-bold uppercase brand-text">
            {start.toLocaleDateString("tr-TR", { month: "short" })}
          </span>
          <span className="text-[22px] font-black leading-none">{start.getDate()}</span>
          <span className="mt-0.5 text-[11px] text-muted">
            {start.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-bold leading-snug">{event.title}</h3>

          {event.description && (
            <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-muted">
              {event.description}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-faint">
            <span className="flex items-center gap-1">
              <MapPinIcon width={13} height={13} />
              {event.isOnline ? "Online" : event.location ?? "Konum belirtilmemiş"}
            </span>
            <span className="flex items-center gap-1">
              <UsersIcon width={13} height={13} />
              {count}
              {event.capacity ? `/${event.capacity}` : ""} katılımcı
            </span>
            {event.community && (
              <Link
                href={`/topluluk/${event.community.slug}`}
                className="font-medium brand-text hover:underline"
              >
                {event.community.name}
              </Link>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Avatar src={event.creator.avatarUrl} name={event.creator.displayName} size="xs" />
            <span className="text-[12.5px] text-muted">{event.creator.displayName} düzenliyor</span>
            <span className="flex-1" />
            <Button
              size="sm"
              variant={attending ? "secondary" : "primary"}
              loading={busy}
              disabled={isFull || event.isCancelled}
              onClick={toggle}
            >
              {event.isCancelled
                ? "İptal edildi"
                : isFull
                  ? "Kontenjan dolu"
                  : attending
                    ? "Katılıyorsun"
                    : "Katıl"}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
