"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { tokens } from "@/lib/api";

/**
 * Tanıtım sayfası herkese açık ve statik. Oturumu olan biri "/" adresine
 * gelirse akışına yollanır — token'a bakmak yeterli, /auth/me beklenmez.
 */
export function LandingRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (tokens.access() || tokens.refresh()) router.replace("/akis");
  }, [router]);

  return null;
}
