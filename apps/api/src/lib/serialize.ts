import type { MediaAsset } from "@kampus/shared";
import { BADGES } from "@kampus/shared";

/** Prisma `Json` alanını güvenli biçimde MediaAsset[] haline getirir. */
export function toMedia(value: unknown): MediaAsset[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is MediaAsset =>
      !!item && typeof item === "object" && typeof (item as MediaAsset).url === "string",
  );
}

type UniversityRow = {
  id: string;
  name: string;
  shortName: string;
  city: string;
  type: "STATE" | "FOUNDATION" | "OTHER";
} | null;

export function serializeUniversity(uni: UniversityRow) {
  if (!uni) return null;
  return {
    id: uni.id,
    name: uni.name,
    shortName: uni.shortName,
    city: uni.city,
    type: uni.type,
  };
}

export interface UserRow {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  department?: string | null;
  showDepartment?: boolean;
  classYear?: number | null;
  karma?: number;
  isStudentAddress?: boolean;
  verifiedAt?: Date | null;
  createdAt?: Date;
  university?: UniversityRow;
  educations?: Array<{
    id: string;
    department: string;
    classYear: number;
    university: UniversityRow;
  }>;
  badges?: { code: string }[];
}

export function serializeUser(
  user: UserRow,
  viewer?: {
    isFollowing?: boolean;
    isFollowedBy?: boolean;
    isBlocked?: boolean;
    viewerId?: string | null;
  },
  counts?: { posts: number; followers: number; following: number; communities: number },
) {
  const showDept = user.showDepartment !== false;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    coverUrl: user.coverUrl ?? null,
    bio: user.bio ?? null,
    department: showDept ? user.department ?? null : null,
    classYear: showDept ? user.classYear ?? null : null,
    karma: user.karma ?? 0,
    university: serializeUniversity(user.university ?? null),
    ...(showDept && user.educations
      ? {
          educations: user.educations.map((education) => ({
            id: education.id,
            department: education.department,
            classYear: education.classYear,
            university: serializeUniversity(education.university),
          })),
        }
      : {}),
    createdAt: (user.createdAt ?? new Date()).toISOString(),
    isVerifiedStudent: !!user.verifiedAt,
    badges: (user.badges ?? []).map((b) => ({
      code: b.code,
      label: BADGES[b.code]?.label ?? b.code,
      icon: BADGES[b.code]?.icon ?? "🏅",
    })),
    ...(counts ? { counts } : {}),
    ...(viewer
      ? {
          viewer: {
            isFollowing: !!viewer.isFollowing,
            isFollowedBy: !!viewer.isFollowedBy,
            isBlocked: !!viewer.isBlocked,
            isSelf: viewer.viewerId === user.id,
          },
        }
      : {}),
  };
}

/** Anonim gönderi/itiraf yazarını asla dışarı sızdırmayan minimal profil. */
export function serializeMiniUser(user: {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

/** Zaman + id tabanlı imleç (cursor) — kararlı sayfalama sağlar. */
export function encodeCursor(date: Date, id: string): string {
  return Buffer.from(`${date.getTime()}:${id}`).toString("base64url");
}

export function decodeCursor(cursor?: string): { date: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const [ts, id] = Buffer.from(cursor, "base64url").toString("utf8").split(":");
    const time = Number(ts);
    if (!Number.isFinite(time) || !id) return null;
    return { date: new Date(time), id };
  } catch {
    return null;
  }
}
