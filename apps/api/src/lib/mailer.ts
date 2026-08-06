import nodemailer from "nodemailer";
import { env, isDev } from "../env";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  tls: { rejectUnauthorized: !isDev },
});

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="tr">
<body style="margin:0;padding:0;background:#0b0d13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0d13;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#151823;border:1px solid #232838;border-radius:20px;overflow:hidden;">
        <tr><td style="padding:32px 32px 8px;">
          <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
            <span style="color:#7c5cff;">◆</span> Kampus
          </div>
        </td></tr>
        <tr><td style="padding:8px 32px 32px;">
          <h1 style="margin:16px 0 8px;font-size:20px;color:#fff;font-weight:700;">${title}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:20px 32px;background:#10131c;border-top:1px solid #232838;">
          <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">
            Bu e-postayı siz talep etmediyseniz görmezden gelebilirsiniz.<br/>
            Kampus — sadece üniversite öğrencilerine açık sosyal ağ.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** "Kampus <noreply@kampus.app>" -> { name, email } */
function parseFrom(value: string): { name?: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(value);
  if (match) return { name: match[1] || undefined, email: match[2] };
  return { email: value.trim() };
}

/**
 * Brevo'nun HTTPS uç noktası. Barındırma sağlayıcıları giden SMTP portlarını
 * sıklıkla kapattığı için, anahtar tanımlıysa tercih edilen yol budur.
 */
async function sendViaBrevoApi(to: string, subject: string, html: string, text: string) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: parseFrom(env.MAIL_FROM),
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Brevo API ${response.status}: ${await response.text()}`);
  }
}

async function send(to: string, subject: string, html: string, text: string) {
  try {
    if (env.BREVO_API_KEY) {
      await sendViaBrevoApi(to, subject, html, text);
      if (isDev) console.log(`📧 Mail gönderildi (Brevo API) -> ${to} (${subject})`);
      return;
    }

    const info = await transporter.sendMail({ from: env.MAIL_FROM, to, subject, html, text });
    if (isDev) {
      console.log(`📧 Mail gönderildi -> ${to} (${subject}) | messageId=${info.messageId}`);
      console.log("   Mailpit arayüzü: http://localhost:8025");
    }
  } catch (err) {
    if (!isDev) throw err;

    // Geliştirmede SMTP yoksa akış tıkanmasın; kodu konsola bas.
    // Windows konsolunda Türkçe karakterler bozulabildiği için banner salt ASCII.
    const code = /\b(\d{6})\b/.exec(text)?.[1];
    console.error(`\nMail gonderilemedi (${to}): ${(err as Error).message}`);
    if (code) {
      const line = "=".repeat(52);
      console.log(`\n${line}\n  DOGRULAMA KODU: ${code}\n  ${to}\n${line}\n`);
    } else {
      console.log(`   Icerik:\n${text}\n`);
    }
  }
}

export async function sendVerificationCode(to: string, code: string, displayName?: string) {
  const greeting = displayName ? `Merhaba ${displayName},` : "Merhaba,";
  const html = layout(
    "E-posta adresini doğrula",
    `<p style="margin:0 0 20px;font-size:15px;color:#9ca3af;line-height:1.6;">
       ${greeting} Kampus hesabını oluşturmak için aşağıdaki doğrulama kodunu gir.
       Kod <strong style="color:#e5e7eb;">10 dakika</strong> geçerlidir.
     </p>
     <div style="background:#0b0d13;border:1px solid #2d3348;border-radius:14px;padding:20px;text-align:center;margin:0 0 20px;">
       <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#a78bfa;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
         ${code}
       </div>
     </div>
     <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
       Kodu kimseyle paylaşma. Kampus ekibi senden asla bu kodu istemez.
     </p>`,
  );
  await send(to, `Kampus doğrulama kodun: ${code}`, html, `Kampus doğrulama kodun: ${code} (10 dakika geçerli)`);
}

export async function sendPasswordResetCode(to: string, code: string) {
  const html = layout(
    "Şifreni sıfırla",
    `<p style="margin:0 0 20px;font-size:15px;color:#9ca3af;line-height:1.6;">
       Şifreni sıfırlamak için aşağıdaki kodu kullan. Kod 10 dakika geçerlidir.
     </p>
     <div style="background:#0b0d13;border:1px solid #2d3348;border-radius:14px;padding:20px;text-align:center;">
       <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#a78bfa;font-family:ui-monospace,monospace;">
         ${code}
       </div>
     </div>`,
  );
  await send(to, `Kampus şifre sıfırlama kodu: ${code}`, html, `Şifre sıfırlama kodun: ${code}`);
}

export async function sendWelcome(to: string, displayName: string, universityName: string | null) {
  const html = layout(
    `Aramıza hoş geldin, ${displayName}! 🎓`,
    `<p style="margin:0 0 16px;font-size:15px;color:#9ca3af;line-height:1.6;">
       ${universityName ? `<strong style="color:#e5e7eb;">${universityName}</strong> öğrencisi olarak doğrulandın.` : "Hesabın doğrulandı."}
       Artık kampüsündeki toplulukları keşfedebilir, bölümünün topluluğuna katılabilir,
       ders notu paylaşabilir ve etkinliklere katılabilirsin.
     </p>
     <a href="${env.WEB_PUBLIC_URL}/kesfet"
        style="display:inline-block;background:#7c5cff;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:600;font-size:15px;">
       Toplulukları keşfet
     </a>`,
  );
  await send(to, "Kampus'e hoş geldin 🎓", html, `Hoş geldin ${displayName}!`);
}
