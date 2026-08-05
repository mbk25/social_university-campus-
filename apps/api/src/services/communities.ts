import type { CommunityRole } from "@prisma/client";
import { prisma } from "../db";
import { forbidden, notFound } from "../lib/errors";
import { slugify } from "../lib/slug";
import { serializeUniversity } from "../lib/serialize";
import { getOrCreateCommunityConversation } from "./chat";

/** Kullanıcının bir topluluktaki rolü (üye değilse null). */
export async function memberRole(
  communityId: string,
  userId: string | null,
): Promise<CommunityRole | null> {
  if (!userId) return null;
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}

/** Kullanıcı bu topluluğa girebilir mi? (kapsam + gizlilik kuralları) */
export async function assertCanView(
  community: {
    id: string;
    scope: "DEPARTMENT" | "UNIVERSITY" | "GLOBAL";
    visibility: "PUBLIC" | "PRIVATE";
    universityId: string | null;
    department: string | null;
  },
  user: { id: string; universityId: string | null; department: string | null; role: string } | null,
) {
  if (user?.role === "ADMIN") return;

  if (community.visibility === "PRIVATE") {
    const role = await memberRole(community.id, user?.id ?? null);
    if (!role) throw forbidden("Bu topluluk gizli, içeriği görmek için üye olmalısınız");
  }

  if (community.scope === "GLOBAL") return;

  if (!user) throw forbidden("Bu topluluğu görüntülemek için giriş yapmalısınız");

  if (community.universityId && community.universityId !== user.universityId) {
    throw forbidden("Bu topluluk yalnızca kendi üniversitesinin öğrencilerine açık");
  }
}

/** Katılım hakkı: bölüm topluluğuna sadece o bölümün öğrencileri girer. */
export async function assertCanJoin(
  community: {
    id: string;
    scope: "DEPARTMENT" | "UNIVERSITY" | "GLOBAL";
    universityId: string | null;
    department: string | null;
  },
  user: { id: string; universityId: string | null; department: string | null; role: string },
) {
  if (user.role === "ADMIN") return;

  if (community.scope === "UNIVERSITY" || community.scope === "DEPARTMENT") {
    if (community.universityId !== user.universityId) {
      throw forbidden("Bu topluluğa yalnızca kendi üniversitesinin öğrencileri katılabilir");
    }
  }

  if (community.scope === "DEPARTMENT" && community.department !== user.department) {
    throw forbidden(
      `Bu topluluk "${community.department}" bölümü öğrencilerine özel. Bölümünü profilinden güncelleyebilirsin.`,
    );
  }
}

export async function joinCommunity(communityId: string, userId: string) {
  const created = await prisma.communityMember.upsert({
    where: { communityId_userId: { communityId, userId } },
    update: {},
    create: { communityId, userId, role: "MEMBER" },
    select: { role: true, joinedAt: true },
  });

  await prisma.community.update({
    where: { id: communityId },
    data: { memberCount: await prisma.communityMember.count({ where: { communityId } }) },
  });

  // Topluluk sohbetine de ekle.
  const conversation = await getOrCreateCommunityConversation(communityId).catch(() => null);
  if (conversation) {
    await prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: conversation.id, userId } },
      update: {},
      create: { conversationId: conversation.id, userId },
    });
  }

  return created;
}

export async function leaveCommunity(communityId: string, userId: string) {
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: { role: true },
  });
  if (!membership) throw notFound("Bu topluluğa üye değilsiniz");

  if (membership.role === "OWNER") {
    const otherOwners = await prisma.communityMember.count({
      where: { communityId, role: "OWNER", userId: { not: userId } },
    });
    if (otherOwners === 0) {
      throw forbidden(
        "Tek kurucu sizsiniz. Ayrılmadan önce başka birini kurucu yapın veya topluluğu arşivleyin.",
      );
    }
  }

  await prisma.communityMember.delete({
    where: { communityId_userId: { communityId, userId } },
  });
  await prisma.community.update({
    where: { id: communityId },
    data: { memberCount: await prisma.communityMember.count({ where: { communityId } }) },
  });

  const conversation = await prisma.conversation.findFirst({
    where: { communityId, type: "COMMUNITY" },
    select: { id: true },
  });
  if (conversation) {
    await prisma.conversationMember
      .delete({ where: { conversationId_userId: { conversationId: conversation.id, userId } } })
      .catch(() => undefined);
  }
}

/**
 * Yeni kullanıcıyı üniversitesinin genel topluluğuna ve bölüm topluluğuna ekler.
 * Topluluklar yoksa otomatik oluşturulur — böylece platform ilk günden dolu görünür.
 */
export async function autoJoinDefaultCommunities(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      universityId: true,
      department: true,
      university: { select: { id: true, name: true, shortName: true } },
    },
  });
  if (!user?.university) return;

  const uni = user.university;

  // 1) Üniversite geneli topluluk
  const uniSlug = slugify(`${uni.shortName}-genel`);
  const uniCommunity = await prisma.community.upsert({
    where: { slug: uniSlug },
    update: {},
    create: {
      slug: uniSlug,
      name: `${uni.name} — Genel`,
      description: `${uni.name} öğrencilerinin ortak alanı. Duyurular, sorular, kampüs sohbeti.`,
      scope: "UNIVERSITY",
      visibility: "PUBLIC",
      universityId: uni.id,
      tags: ["kampüs", "genel"],
      rules: [
        "Saygılı ol, kişisel saldırıda bulunma.",
        "Ticari reklam ve spam paylaşma.",
        "Kişisel bilgi (telefon, adres) paylaşma.",
      ],
      createdById: userId,
    },
    select: { id: true },
  });
  await joinCommunity(uniCommunity.id, userId);

  // 2) Bölüm topluluğu
  if (user.department) {
    const deptSlug = slugify(`${uni.shortName}-${user.department}`);
    const deptCommunity = await prisma.community.upsert({
      where: { slug: deptSlug },
      update: {},
      create: {
        slug: deptSlug,
        name: `${uni.shortName} ${user.department}`,
        description: `${uni.name} ${user.department} bölümü öğrencileri. Ders notları, sınav takvimi, staj ve kariyer.`,
        scope: "DEPARTMENT",
        visibility: "PUBLIC",
        universityId: uni.id,
        department: user.department,
        tags: ["bölüm", "ders"],
        createdById: userId,
      },
      select: { id: true },
    });
    await joinCommunity(deptCommunity.id, userId);
  }
}

export const COMMUNITY_INCLUDE = {
  university: { select: { id: true, name: true, shortName: true, city: true, type: true } },
} as const;

type CommunityRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  scope: "DEPARTMENT" | "UNIVERSITY" | "GLOBAL";
  visibility: "PUBLIC" | "PRIVATE";
  department: string | null;
  tags: string[];
  rules?: string[];
  memberCount: number;
  postCount: number;
  createdAt: Date;
  university?: {
    id: string;
    name: string;
    shortName: string;
    city: string;
    type: "STATE" | "FOUNDATION" | "OTHER";
  } | null;
};

export function serializeCommunity(
  community: CommunityRow,
  viewer?: { role: CommunityRole | null; hasPendingRequest?: boolean },
) {
  return {
    id: community.id,
    slug: community.slug,
    name: community.name,
    description: community.description,
    avatarUrl: community.avatarUrl,
    coverUrl: community.coverUrl,
    scope: community.scope,
    visibility: community.visibility,
    department: community.department,
    university: serializeUniversity(community.university ?? null),
    tags: community.tags,
    rules: community.rules ?? [],
    memberCount: community.memberCount,
    postCount: community.postCount,
    createdAt: community.createdAt.toISOString(),
    ...(viewer
      ? {
          viewer: {
            isMember: !!viewer.role,
            role: viewer.role,
            hasPendingRequest: !!viewer.hasPendingRequest,
          },
        }
      : {}),
  };
}
