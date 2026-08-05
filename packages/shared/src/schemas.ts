import { z } from "zod";

const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "api", "www", "app", "kampus", "moderator",
  "mod", "support", "destek", "help", "yardim", "about", "hakkinda", "login",
  "kayit", "register", "signup", "signin", "settings", "ayarlar", "me", "explore",
  "kesfet", "search", "ara", "notifications", "bildirimler", "messages", "mesajlar",
  "null", "undefined", "system", "sistem", "official", "resmi",
]);

export const usernameSchema = z
  .string()
  .min(3, "Kullanıcı adı en az 3 karakter olmalı")
  .max(24, "Kullanıcı adı en fazla 24 karakter olabilir")
  .regex(/^[a-z0-9_]+$/, "Sadece küçük harf, rakam ve alt çizgi kullanılabilir")
  .refine((v) => !/^_|_$/.test(v), "Kullanıcı adı alt çizgi ile başlayamaz/bitemez")
  .refine((v) => !RESERVED_USERNAMES.has(v), "Bu kullanıcı adı kullanılamaz");

export const passwordSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı")
  .max(128, "Şifre çok uzun")
  .regex(/[a-zA-ZğüşöçıİĞÜŞÖÇ]/, "Şifre en az bir harf içermeli")
  .regex(/[0-9]/, "Şifre en az bir rakam içermeli");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Geçerli bir e-posta adresi girin")
  .max(254);

// ------------------------------------------------------------------ auth
export const registerStartSchema = z.object({
  email: emailSchema,
});

export const registerCompleteSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, "Doğrulama kodu 6 haneli olmalı"),
  username: usernameSchema,
  displayName: z.string().trim().min(2, "İsim en az 2 karakter").max(50),
  password: passwordSchema,
  department: z.string().trim().min(2).max(80),
  classYear: z.number().int().min(1).max(8),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "Kullanım koşullarını kabul etmelisiniz" }),
  }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Şifre gerekli"),
});

export const resendCodeSchema = z.object({ email: emailSchema });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/),
  password: passwordSchema,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

// ------------------------------------------------------------------ user
export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(50).optional(),
  bio: z.string().trim().max(280).optional(),
  department: z.string().trim().min(2).max(80).optional(),
  classYear: z.number().int().min(1).max(8).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  interests: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  isPrivate: z.boolean().optional(),
  showDepartment: z.boolean().optional(),
});

// ------------------------------------------------------------------ community
export const communityScopeSchema = z.enum(["DEPARTMENT", "UNIVERSITY", "GLOBAL"]);
export const communityVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);

export const createCommunitySchema = z.object({
  name: z.string().trim().min(3, "Topluluk adı en az 3 karakter").max(50),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Sadece küçük harf, rakam ve tire"),
  description: z.string().trim().max(500).optional(),
  scope: communityScopeSchema,
  /** scope=DEPARTMENT ise zorunlu */
  department: z.string().trim().max(80).optional(),
  visibility: communityVisibilitySchema.default("PUBLIC"),
  avatarUrl: z.string().url().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
}).refine(
  (v) => v.scope !== "DEPARTMENT" || !!v.department,
  { message: "Bölüm topluluğu için bölüm seçilmeli", path: ["department"] },
);

export const updateCommunitySchema = z.object({
  name: z.string().trim().min(3).max(50).optional(),
  description: z.string().trim().max(500).optional(),
  visibility: communityVisibilitySchema.optional(),
  avatarUrl: z.string().url().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
  rules: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
});

// ------------------------------------------------------------------ post
export const mediaItemSchema = z.object({
  url: z.string().url(),
  type: z.enum(["IMAGE", "VIDEO", "FILE"]),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  name: z.string().max(200).optional(),
  size: z.number().int().nonnegative().optional(),
});

export const createPostSchema = z.object({
  content: z.string().trim().max(2000),
  communityId: z.string().cuid().nullable().optional(),
  media: z.array(mediaItemSchema).max(4).optional(),
  isAnonymous: z.boolean().default(false),
  poll: z
    .object({
      question: z.string().trim().min(3).max(140),
      options: z.array(z.string().trim().min(1).max(60)).min(2).max(6),
      endsInHours: z.number().int().min(1).max(24 * 14).default(24),
    })
    .optional(),
}).refine(
  (v) => v.content.length > 0 || (v.media?.length ?? 0) > 0 || !!v.poll,
  { message: "Gönderi boş olamaz", path: ["content"] },
);

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, "Yorum boş olamaz").max(1000),
  parentId: z.string().cuid().nullable().optional(),
});

// ------------------------------------------------------------------ chat
export const sendMessageSchema = z.object({
  content: z.string().trim().max(4000),
  attachments: z.array(mediaItemSchema).max(4).optional(),
  replyToId: z.string().cuid().nullable().optional(),
  /** Aynı mesajın iki kez kaydedilmesini engeller. */
  clientNonce: z.string().max(64).optional(),
}).refine(
  (v) => v.content.length > 0 || (v.attachments?.length ?? 0) > 0,
  { message: "Mesaj boş olamaz", path: ["content"] },
);

export const createConversationSchema = z.object({
  type: z.enum(["DIRECT", "GROUP"]).default("DIRECT"),
  memberIds: z.array(z.string().cuid()).min(1).max(50),
  title: z.string().trim().max(60).optional(),
});

// ------------------------------------------------------------------ event
export const createEventSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(200).optional(),
  isOnline: z.boolean().default(false),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  capacity: z.number().int().positive().max(100000).optional(),
  coverUrl: z.string().url().nullable().optional(),
  communityId: z.string().cuid().nullable().optional(),
}).refine((v) => !v.endsAt || v.endsAt > v.startsAt, {
  message: "Bitiş tarihi başlangıçtan sonra olmalı",
  path: ["endsAt"],
});

// ------------------------------------------------------------------ note (ders notu)
export const createNoteSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(1000).optional(),
  courseCode: z.string().trim().max(20).optional(),
  courseName: z.string().trim().min(2).max(120),
  department: z.string().trim().max(80).optional(),
  /** Not tüm üniversitelerle mi yoksa sadece kendi üniversitenle mi paylaşılsın */
  visibility: z.enum(["UNIVERSITY", "GLOBAL"]).default("UNIVERSITY"),
  files: z.array(mediaItemSchema).min(1, "En az bir dosya yükleyin").max(10),
});

export const rateNoteSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

// ------------------------------------------------------------------ confession (itiraf)
export const createConfessionSchema = z.object({
  content: z.string().trim().min(10, "En az 10 karakter").max(1000),
  /** UNIVERSITY = sadece kendi üniversiten görür */
  scope: z.enum(["UNIVERSITY", "GLOBAL"]).default("UNIVERSITY"),
  topic: z.string().trim().max(30).optional(),
});

// ------------------------------------------------------------------ misc
export const reportSchema = z.object({
  targetType: z.enum(["POST", "COMMENT", "USER", "COMMUNITY", "MESSAGE", "CONFESSION", "NOTE"]),
  targetId: z.string().min(1),
  reason: z.enum([
    "SPAM",
    "HARASSMENT",
    "HATE_SPEECH",
    "SEXUAL_CONTENT",
    "VIOLENCE",
    "MISINFORMATION",
    "IMPERSONATION",
    "OTHER",
  ]),
  details: z.string().trim().max(500).optional(),
});

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const searchSchema = z.object({
  q: z.string().trim().min(1).max(100),
  type: z.enum(["ALL", "USERS", "COMMUNITIES", "POSTS", "EVENTS", "NOTES"]).default("ALL"),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

// ------------------------------------------------------------------ türler
export type RegisterStartInput = z.infer<typeof registerStartSchema>;
export type RegisterCompleteInput = z.infer<typeof registerCompleteSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type CreateConfessionInput = z.infer<typeof createConfessionSchema>;
export type MediaItem = z.infer<typeof mediaItemSchema>;
