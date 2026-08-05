"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { Community, KampusEvent } from "@/lib/types";
import { EventCard } from "@/components/EventCard";
import { CalendarIcon, PlusIcon } from "@/components/icons";
import {
  Button,
  EmptyState,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
  cx,
  useToast,
} from "@/components/ui";

const SCOPES = [
  { key: "ALL", label: "Tümü" },
  { key: "UNIVERSITY", label: "Üniversitem" },
  { key: "ATTENDING", label: "Katılacaklarım" },
  { key: "MINE", label: "Düzenlediklerim" },
] as const;

export default function EventsPage() {
  const [scope, setScope] = useState<(typeof SCOPES)[number]["key"]>("ALL");
  const [when, setWhen] = useState<"UPCOMING" | "PAST">("UPCOMING");
  const [items, setItems] = useState<KampusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ items: KampusEvent[] }>(
        `/events?scope=${scope}&when=${when}&limit=30`,
      );
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [scope, when]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-[680px] space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-black tracking-tight">Etkinlikler</h1>
          <p className="mt-1 text-[14px] text-muted">
            Kampüs etkinlikleri, atölyeler, kulüp buluşmaları
          </p>
        </div>
        <Button icon={<PlusIcon width={17} height={17} />} onClick={() => setCreateOpen(true)}>
          <span className="hidden sm:inline">Etkinlik oluştur</span>
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            onClick={() => setScope(s.key)}
            className={cx(
              "rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors",
              scope === s.key ? "bg-[var(--brand)] text-white" : "surface-subtle text-muted",
            )}
          >
            {s.label}
          </button>
        ))}
        <span className="mx-1 w-px self-stretch bg-[var(--border)]" />
        <button
          onClick={() => setWhen(when === "UPCOMING" ? "PAST" : "UPCOMING")}
          className="rounded-full surface-subtle px-3.5 py-1.5 text-[13.5px] font-medium text-muted"
        >
          {when === "UPCOMING" ? "Yaklaşan" : "Geçmiş"}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon width={26} height={26} />}
          title={when === "PAST" ? "Geçmiş etkinlik yok" : "Yaklaşan etkinlik yok"}
          description="İlk etkinliği sen düzenle — kampüsünde bir şeyler olsun."
          action={
            <Button onClick={() => setCreateOpen(true)} icon={<PlusIcon width={17} height={17} />}>
              Etkinlik oluştur
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((event) => (
            <EventCard key={event.id} event={event} onChange={load} />
          ))}
        </div>
      )}

      <CreateEventModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}

function CreateEventModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [capacity, setCapacity] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [communities, setCommunities] = useState<Community[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    api
      .get<{ items: Community[] }>("/communities?filter=MINE&limit=50")
      .then((d) =>
        setCommunities(
          d.items.filter((c) => c.viewer?.role === "OWNER" || c.viewer?.role === "MODERATOR"),
        ),
      )
      .catch(() => undefined);
  }, [open]);

  async function submit() {
    setBusy(true);
    setErrors({});
    try {
      await api.post("/events", {
        title: title.trim(),
        description: description.trim() || undefined,
        location: isOnline ? undefined : location.trim() || undefined,
        isOnline,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        capacity: capacity ? Number(capacity) : undefined,
        communityId: communityId || null,
      });
      toast.show("Etkinlik oluşturuldu 🎉", "success");
      onCreated();
      onClose();
      setTitle("");
      setDescription("");
      setStartsAt("");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? { _: err.message });
        if (!err.fields) toast.show(err.message, "error");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Etkinlik oluştur">
      <div className="space-y-4">
        <Input
          label="Etkinlik adı"
          placeholder="Örn. Kariyer Günleri: CV Atölyesi"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
        />
        <Textarea
          label="Açıklama"
          rows={3}
          maxLength={2000}
          placeholder="Ne yapılacak, kimler katılmalı, ne getirmeli?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <label className="flex cursor-pointer items-center gap-2.5 text-[14px]">
          <input
            type="checkbox"
            checked={isOnline}
            onChange={(e) => setIsOnline(e.target.checked)}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          Online etkinlik
        </label>

        {!isOnline && (
          <Input
            label="Konum"
            placeholder="Örn. Mühendislik Fakültesi B Blok, Amfi 2"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="datetime-local"
            label="Başlangıç"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            error={errors.startsAt}
          />
          <Input
            type="datetime-local"
            label="Bitiş (isteğe bağlı)"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            error={errors.endsAt}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="number"
            label="Kontenjan (isteğe bağlı)"
            placeholder="Sınırsız"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <Select
            label="Topluluk"
            value={communityId}
            onChange={(e) => setCommunityId(e.target.value)}
            hint={communities.length === 0 ? "Yönetici olduğun topluluk yok" : undefined}
          >
            <option value="">Üniversite geneli</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        {errors._ && <p className="text-[13px] text-rose-500">{errors._}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            fullWidth
            loading={busy}
            onClick={submit}
            disabled={title.trim().length < 3 || !startsAt}
          >
            Oluştur
          </Button>
        </div>
      </div>
    </Modal>
  );
}
