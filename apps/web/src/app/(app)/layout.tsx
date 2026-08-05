"use client";

import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useRequireAuth();

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={28} className="brand-text" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
