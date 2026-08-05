import { generateAnonymousAlias } from "@kampus/shared";
import { prisma } from "../db";
import { serializeUniversity, toMedia } from "../lib/serialize";

/** Prisma include şablonu — viewer'a özel alanlar dinamik eklenir. */
export function postInclude(viewerId: string | null) {
  return {
    author: {
      select: {
        id: true, username: true, displayName: true, avatarUrl: true, bio: true,
        department: true, classYear: true, karma: true, showDepartment: true,
        verifiedAt: true, createdAt: true,
        university: { select: { id: true, name: true, shortName: true, city: true, type: true } },
        badges: { select: { code: true } },
      },
    },
    community: { select: { id: true, slug: true, name: true, avatarUrl: true } },
    poll: {
      include: {
        options: { orderBy: { position: "asc" as const } },
        ...(viewerId
          ? { votes: { where: { userId: viewerId }, select: { optionId: true } } }
          : {}),
      },
    },
    ...(viewerId
      ? {
          likes: { where: { userId: viewerId }, select: { userId: true } },
          bookmarks: { where: { userId: viewerId }, select: { userId: true } },
        }
      : {}),
  };
}

type PostWithRelations = Awaited<
  ReturnType<typeof prisma.post.findFirstOrThrow<{ include: ReturnType<typeof postInclude> }>>
>;

export function serializePost(
  post: PostWithRelations,
  viewer: { id: string | null; role?: string } = { id: null },
) {
  const author = post.author;
  const showDept = author.showDepartment !== false;

  const poll = post.poll
    ? {
        id: post.poll.id,
        question: post.poll.question,
        endsAt: post.poll.endsAt.toISOString(),
        totalVotes: post.poll.options.reduce((sum, o) => sum + o.voteCount, 0),
        options: post.poll.options.map((o) => ({
          id: o.id,
          text: o.text,
          voteCount: o.voteCount,
        })),
        viewerVotedOptionId:
          (post.poll as { votes?: { optionId: string }[] }).votes?.[0]?.optionId ?? null,
      }
    : null;

  const isOwnPost = viewer.id === post.authorId;

  return {
    id: post.id,
    content: post.content,
    media: toMedia(post.media),
    isAnonymous: post.isAnonymous,
    anonymousAlias: post.isAnonymous ? post.anonymousAlias ?? generateAnonymousAlias(post.id) : null,
    // Anonim gönderide yazar kimliği hiçbir koşulda dışarı verilmez.
    author: post.isAnonymous
      ? null
      : {
          id: author.id,
          username: author.username,
          displayName: author.displayName,
          avatarUrl: author.avatarUrl,
          bio: author.bio,
          department: showDept ? author.department : null,
          classYear: showDept ? author.classYear : null,
          karma: author.karma,
          university: serializeUniversity(author.university),
          createdAt: author.createdAt.toISOString(),
          isVerifiedStudent: !!author.verifiedAt,
          badges: author.badges.map((b) => ({ code: b.code, label: b.code, icon: "🏅" })),
        },
    community: post.community,
    poll,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    createdAt: post.createdAt.toISOString(),
    editedAt: post.editedAt?.toISOString() ?? null,
    isPinned: post.isPinned,
    hashtags: post.hashtags,
    viewer: {
      hasLiked: ((post as { likes?: unknown[] }).likes?.length ?? 0) > 0,
      hasBookmarked: ((post as { bookmarks?: unknown[] }).bookmarks?.length ?? 0) > 0,
      canDelete: isOwnPost || viewer.role === "ADMIN" || viewer.role === "MODERATOR",
      isMine: isOwnPost,
    },
  };
}

/**
 * Sıcaklık puanı: beğeni ve yorumlar zamanla değer kaybeder.
 * (Reddit'in "hot" formülünün sadeleştirilmiş hali.)
 */
export function hotScore(likeCount: number, commentCount: number, createdAt: Date): number {
  const score = likeCount + commentCount * 2;
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const seconds = createdAt.getTime() / 1000 - 1_700_000_000;
  return Number((order + seconds / 45000).toFixed(6));
}

export async function refreshHotScore(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { likeCount: true, commentCount: true, createdAt: true },
  });
  if (!post) return;
  await prisma.post.update({
    where: { id: postId },
    data: { hotScore: hotScore(post.likeCount, post.commentCount, post.createdAt) },
  });
}

/** Kullanıcının engellediği + kendisini engelleyen kullanıcıların id listesi. */
export async function blockedUserIds(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return Array.from(
    new Set(blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId))),
  );
}

/** Kullanıcının görebileceği topluluk id'leri (gizli topluluk içeriğini gizlemek için). */
export async function visibleCommunityFilter(user: {
  id: string;
  universityId: string | null;
  role: string;
} | null) {
  if (user?.role === "ADMIN") return undefined;

  const memberOf = user
    ? (
        await prisma.communityMember.findMany({
          where: { userId: user.id },
          select: { communityId: true },
        })
      ).map((m) => m.communityId)
    : [];

  return {
    OR: [
      { communityId: null },
      { community: { visibility: "PUBLIC" as const, scope: "GLOBAL" as const } },
      ...(user?.universityId
        ? [
            {
              community: {
                visibility: "PUBLIC" as const,
                universityId: user.universityId,
              },
            },
          ]
        : []),
      ...(memberOf.length > 0 ? [{ communityId: { in: memberOf } }] : []),
    ],
  };
}
