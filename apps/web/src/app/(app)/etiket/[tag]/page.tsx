"use client";

import { useParams } from "next/navigation";
import { Feed } from "@/components/Feed";
import { FireIcon } from "@/components/icons";

export default function HashtagPage() {
  const { tag } = useParams<{ tag: string }>();
  const decoded = decodeURIComponent(tag);

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-4">
      <header className="surface flex items-center gap-3 rounded-[var(--radius-card)] p-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl brand-soft-bg brand-text">
          <FireIcon width={20} height={20} />
        </span>
        <div>
          <h1 className="text-[22px] font-black tracking-tight">#{decoded}</h1>
          <p className="text-[13px] text-muted">Bu etiketi kullanan gönderiler</p>
        </div>
      </header>

      <Feed
        query={`tab=HASHTAG&hashtag=${encodeURIComponent(decoded)}`}
        emptyTitle="Bu etiketle gönderi yok"
        emptyDescription={`İlk #${decoded} gönderisini sen paylaş.`}
      />
    </div>
  );
}
