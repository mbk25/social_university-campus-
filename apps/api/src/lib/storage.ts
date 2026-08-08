import fs from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../env";

/**
 * Dosya depolama.
 *
 * S3_BUCKET tanımlıysa nesne depolamaya (Cloudflare R2, AWS S3, Backblaze B2…),
 * tanımlı değilse yerel diske yazar. Geliştirmede disk yeterli; production'da
 * sunucu diski her dağıtımda sıfırlandığı için nesne depolama şart.
 */

export const usesObjectStorage = !!env.S3_BUCKET;

let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT || undefined,
      // R2 ve B2 gibi S3 uyumlu servisler path-style adresleme ister.
      forcePathStyle: !!env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export interface SaveFileInput {
  /** avatars, covers, posts, messages, files */
  folder: string;
  filename: string;
  body: Buffer;
  contentType: string;
}

export async function saveFile(input: SaveFileInput): Promise<{ url: string; key: string }> {
  const key = `${input.folder}/${input.filename}`;

  if (usesObjectStorage) {
    await s3().send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
        // Dosya adları benzersiz (nanoid) olduğu için kalıcı önbellek güvenli.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    const base = (env.S3_PUBLIC_URL || "").replace(/\/+$/, "");
    return { url: `${base}/${key}`, key };
  }

  const dir = path.join(env.UPLOAD_DIR, input.folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, input.filename), input.body);

  return { url: `${env.API_PUBLIC_URL}/uploads/${key}`, key };
}

export interface StoredFile {
  body: Readable;
  contentType?: string;
  contentLength?: number;
  cacheControl?: string;
  etag?: string;
}

/**
 * Nesne depolamadan bir dosyayı okur.
 *
 * Neden gerek duyuluyor: R2'nin `r2.dev` alan adı Türkiye'deki ağlarda
 * engelleniyor, dolayısıyla tarayıcı dosyaya doğrudan ulaşamıyor. Sunucu
 * ulaşabildiği için dosyayı buradan okuyup kendimiz servis ediyoruz
 * (bkz. app.ts içindeki /media/* rotası). Bucket'a özel bir alan adı
 * bağlandığında bu yola gerek kalmayacak.
 *
 * Dosya yoksa null döner.
 */
export async function getFile(key: string): Promise<StoredFile | null> {
  if (!usesObjectStorage) return null;

  try {
    const out = await s3().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    if (!out.Body) return null;

    return {
      body: out.Body as Readable,
      contentType: out.ContentType,
      contentLength: out.ContentLength,
      cacheControl: out.CacheControl,
      etag: out.ETag,
    };
  } catch (err) {
    const ad = (err as { name?: string }).name;
    if (ad === "NoSuchKey" || ad === "NotFound") return null;
    throw err;
  }
}

/** Sunucu açılışında yapılandırmanın tutarlı olduğunu kontrol eder. */
export function assertStorageConfigured(): void {
  if (!usesObjectStorage) return;

  const missing: string[] = [];
  if (!env.S3_ACCESS_KEY_ID) missing.push("S3_ACCESS_KEY_ID");
  if (!env.S3_SECRET_ACCESS_KEY) missing.push("S3_SECRET_ACCESS_KEY");
  if (!env.S3_PUBLIC_URL) missing.push("S3_PUBLIC_URL");

  if (missing.length > 0) {
    throw new Error(
      `S3_BUCKET tanımlı ama şunlar eksik: ${missing.join(", ")}. ` +
        "Nesne depolamayı kullanmayacaksanız S3_BUCKET değerini boş bırakın.",
    );
  }
}
