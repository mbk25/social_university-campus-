import { ImageResponse } from "next/og";

/**
 * Link WhatsApp / Instagram / X'te paylaşıldığında görünen kart.
 * Next.js bu dosyayı derleme sırasında /opengraph-image olarak yayınlar ve
 * og:image etiketini kendisi ekler.
 */
export const alt = "Kampus — Üniversite öğrencilerinin sosyal ağı";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: "#0b0d13",
          backgroundImage:
            "radial-gradient(circle at 12% 8%, rgba(124,92,255,0.55) 0%, transparent 45%)," +
            "radial-gradient(circle at 92% 92%, rgba(20,200,168,0.38) 0%, transparent 45%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 76,
              height: 76,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 22,
              background: "linear-gradient(135deg, #8f74ff 0%, #5836c9 100%)",
              fontSize: 46,
              fontWeight: 900,
              color: "#ffffff",
            }}
          >
            K
          </div>
          <div style={{ fontSize: 46, fontWeight: 900, color: "#f2f4f8", letterSpacing: -1 }}>
            Kampus
          </div>
        </div>

        <div
          style={{
            marginTop: 44,
            fontSize: 78,
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 1.05,
            letterSpacing: -2.5,
            maxWidth: 900,
          }}
        >
          Kampüsün kendi sosyal ağı
        </div>

        <div
          style={{
            marginTop: 30,
            fontSize: 34,
            color: "#9aa1b4",
            lineHeight: 1.35,
            maxWidth: 860,
          }}
        >
          Sadece üniversite e-postasıyla girilir. Bot yok, reklam yok,
          tanımadığın kimse yok.
        </div>

        <div
          style={{
            marginTop: 46,
            display: "flex",
            alignItems: "center",
            alignSelf: "flex-start",
            padding: "14px 28px",
            borderRadius: 999,
            background: "rgba(124,92,255,0.18)",
            border: "1px solid rgba(143,116,255,0.45)",
            fontSize: 27,
            fontWeight: 600,
            color: "#cbbfff",
          }}
        >
          Sadece doğrulanmış öğrenciler
        </div>
      </div>
    ),
    size,
  );
}
