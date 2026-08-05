import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Arka plan ışıkları */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="aurora h-[420px] w-[420px] bg-[#7c5cff]"
          style={{ top: "-120px", left: "-80px" }}
        />
        <div
          className="aurora h-[380px] w-[380px] bg-[#14c8a8]"
          style={{ bottom: "-140px", right: "-60px", animationDelay: "3s" }}
        />
        <div
          className="aurora h-[300px] w-[300px] bg-[#ff5cae]"
          style={{ top: "40%", right: "20%", animationDelay: "6s", opacity: 0.25 }}
        />
      </div>

      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/giris" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#8f74ff] to-[#5836c9] text-lg font-black text-white">
            K
          </span>
          <span className="text-[19px] font-black tracking-tight">Kampus</span>
        </Link>
        <Link
          href="/kurallar"
          className="text-[13.5px] font-medium text-muted transition-colors hover:text-[var(--text)]"
        >
          Topluluk kuralları
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-6 sm:px-8">{children}</main>

      <footer className="px-5 py-6 text-center text-[12.5px] text-faint sm:px-8">
        Kampus · Sadece doğrulanmış üniversite öğrencilerine açıktır
      </footer>
    </div>
  );
}
