import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Kampus — Üniversite öğrencilerinin sosyal ağı",
    template: "%s · Kampus",
  },
  description:
    "Sadece üniversite e-posta adresiyle girilebilen sosyal ağ. Bölümünün topluluğuna katıl, ders notu paylaş, etkinlikleri kaçırma.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Kampus" },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "Kampus",
    title: "Kampus — Üniversite öğrencilerinin sosyal ağı",
    description: "Üniversite e-postanla giriş yap, kampüsündeki herkesle bağlan.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d13" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

/** Sayfa boyanmadan önce temayı uygular — flaş engellenir. */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('kampus.theme');
    var dark = stored ? stored === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
