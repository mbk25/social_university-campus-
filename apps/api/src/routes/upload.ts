import path from "node:path";
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { badRequest } from "../lib/errors";
import { saveFile } from "../lib/storage";
import { requireUser } from "../plugins/auth";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "application/zip",
  "application/x-zip-compressed",
]);

/** Yükleme türüne göre boyut/format sınırları. */
const PRESETS = {
  avatar: { maxWidth: 512, maxHeight: 512, quality: 88, folder: "avatars" },
  cover: { maxWidth: 1600, maxHeight: 500, quality: 82, folder: "covers" },
  post: { maxWidth: 1600, maxHeight: 1600, quality: 85, folder: "posts" },
  message: { maxWidth: 1400, maxHeight: 1400, quality: 82, folder: "messages" },
} as const;

type PresetName = keyof typeof PRESETS;

function safeFileName(original: string): string {
  const ext = path.extname(original).slice(0, 10).toLowerCase().replace(/[^a-z0-9.]/g, "");
  const base = path
    .basename(original, path.extname(original))
    .replace(/[^\p{L}\p{N}._-]/gu, "-")
    .slice(0, 60);
  return `${base || "dosya"}${ext}`;
}

export default async function uploadRoutes(app: FastifyInstance) {
  // ------------------------------------------------------------ görsel yükle
  app.post("/image", { preHandler: app.authenticate }, async (request) => {
    requireUser(request);

    const file = await request.file();
    if (!file) throw badRequest("Dosya bulunamadı");

    const presetName = ((file.fields?.preset as { value?: string })?.value ?? "post") as PresetName;
    const preset = PRESETS[presetName] ?? PRESETS.post;

    if (!IMAGE_TYPES.has(file.mimetype)) {
      throw badRequest("Sadece JPG, PNG, WebP, GIF veya AVIF görseller yüklenebilir");
    }

    const buffer = await file.toBuffer();

    const isAnimated = file.mimetype === "image/gif";
    const outputName = `${nanoid(16)}.${isAnimated ? "gif" : "webp"}`;

    // GIF'lerde animasyonu koru, diğerlerini webp'ye çevirip küçült.
    const pipeline = sharp(buffer, { animated: isAnimated }).rotate().resize({
      width: preset.maxWidth,
      height: preset.maxHeight,
      fit: presetName === "avatar" ? "cover" : "inside",
      withoutEnlargement: true,
    });

    const output = isAnimated
      ? await pipeline.gif().toBuffer({ resolveWithObject: true })
      : await pipeline.webp({ quality: preset.quality }).toBuffer({ resolveWithObject: true });

    const saved = await saveFile({
      folder: preset.folder,
      filename: outputName,
      body: output.data,
      contentType: isAnimated ? "image/gif" : "image/webp",
    });

    return {
      url: saved.url,
      type: "IMAGE" as const,
      width: output.info.width,
      height: output.info.height,
      size: output.data.length,
      name: safeFileName(file.filename),
    };
  });

  // ------------------------------------------------------------ belge yükle (ders notu)
  app.post("/file", { preHandler: app.authenticate }, async (request) => {
    requireUser(request);

    const file = await request.file();
    if (!file) throw badRequest("Dosya bulunamadı");

    if (!DOCUMENT_TYPES.has(file.mimetype) && !IMAGE_TYPES.has(file.mimetype)) {
      throw badRequest("Bu dosya türü desteklenmiyor (PDF, Word, PowerPoint, Excel, ZIP, görsel)");
    }

    const buffer = await file.toBuffer();
    const original = safeFileName(file.filename);
    // Görünen ad ayrıca döndüğü için depolanan ad sadeleştirilir (adres kaçışı derdi olmasın).
    const stored = `${nanoid(16)}${path.extname(original).toLowerCase()}`;

    const saved = await saveFile({
      folder: "files",
      filename: stored,
      body: buffer,
      contentType: file.mimetype,
    });

    return {
      url: saved.url,
      type: IMAGE_TYPES.has(file.mimetype) ? ("IMAGE" as const) : ("FILE" as const),
      name: original,
      size: buffer.length,
    };
  });
}
