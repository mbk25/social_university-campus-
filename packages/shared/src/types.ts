/** API'nin döndüğü nesnelerin istemci tarafındaki karşılıkları. */

export interface PublicUniversity {
  id: string;
  name: string;
  shortName: string;
  city: string;
  type: "STATE" | "FOUNDATION" | "OTHER";
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  department: string | null;
  classYear: number | null;
  karma: number;
  university: PublicUniversity | null;
  createdAt: string;
  isVerifiedStudent: boolean;
  badges?: { code: string; label: string; icon: string }[];
  counts?: { posts: number; followers: number; following: number; communities: number };
  /** İsteği yapan kullanıcıya göre */
  viewer?: { isFollowing: boolean; isFollowedBy: boolean; isBlocked: boolean; isSelf: boolean };
}

export interface PublicCommunity {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  scope: "DEPARTMENT" | "UNIVERSITY" | "GLOBAL";
  visibility: "PUBLIC" | "PRIVATE";
  department: string | null;
  university: PublicUniversity | null;
  tags: string[];
  rules?: string[];
  memberCount: number;
  postCount: number;
  createdAt: string;
  viewer?: { isMember: boolean; role: "OWNER" | "MODERATOR" | "MEMBER" | null; hasPendingRequest: boolean };
}

export interface MediaAsset {
  url: string;
  type: "IMAGE" | "VIDEO" | "FILE";
  width?: number;
  height?: number;
  name?: string;
  size?: number;
}

export interface PollOptionView {
  id: string;
  text: string;
  voteCount: number;
}

export interface PollView {
  id: string;
  question: string;
  endsAt: string;
  totalVotes: number;
  options: PollOptionView[];
  viewerVotedOptionId: string | null;
}

export interface PublicPost {
  id: string;
  content: string;
  media: MediaAsset[];
  author: PublicUser | null; // isAnonymous ise null
  isAnonymous: boolean;
  anonymousAlias: string | null;
  community: Pick<PublicCommunity, "id" | "slug" | "name" | "avatarUrl"> | null;
  poll: PollView | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  editedAt: string | null;
  isPinned: boolean;
  viewer?: { hasLiked: boolean; hasBookmarked: boolean; canDelete: boolean };
}

export interface PublicComment {
  id: string;
  postId: string;
  parentId: string | null;
  content: string;
  author: PublicUser | null;
  likeCount: number;
  replyCount: number;
  createdAt: string;
  viewer?: { hasLiked: boolean; canDelete: boolean };
  replies?: PublicComment[];
}

export interface PublicMessage {
  id: string;
  conversationId: string;
  sender: Pick<PublicUser, "id" | "username" | "displayName" | "avatarUrl"> | null;
  content: string;
  attachments: MediaAsset[];
  replyTo: { id: string; content: string; senderName: string } | null;
  createdAt: string;
  isDeleted: boolean;
  isMine?: boolean;
}

export interface PublicConversation {
  id: string;
  type: "DIRECT" | "GROUP" | "COMMUNITY";
  title: string | null;
  avatarUrl: string | null;
  community: Pick<PublicCommunity, "id" | "slug" | "name"> | null;
  members: Pick<PublicUser, "id" | "username" | "displayName" | "avatarUrl">[];
  lastMessage: PublicMessage | null;
  unreadCount: number;
  updatedAt: string;
}

export type NotificationType =
  | "FOLLOW"
  | "POST_LIKE"
  | "COMMENT"
  | "COMMENT_LIKE"
  | "COMMENT_REPLY"
  | "MENTION"
  | "COMMUNITY_INVITE"
  | "COMMUNITY_JOIN_REQUEST"
  | "COMMUNITY_JOIN_APPROVED"
  | "COMMUNITY_POST"
  | "EVENT_REMINDER"
  | "EVENT_NEW"
  | "MESSAGE"
  | "BADGE_EARNED"
  | "SYSTEM";

export interface PublicNotification {
  id: string;
  type: NotificationType;
  actor: Pick<PublicUser, "id" | "username" | "displayName" | "avatarUrl"> | null;
  text: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface PublicEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  isOnline: boolean;
  startsAt: string;
  endsAt: string | null;
  coverUrl: string | null;
  capacity: number | null;
  attendeeCount: number;
  creator: Pick<PublicUser, "id" | "username" | "displayName" | "avatarUrl">;
  community: Pick<PublicCommunity, "id" | "slug" | "name"> | null;
  university: PublicUniversity | null;
  viewer?: { isAttending: boolean; canEdit: boolean };
}

export interface PublicNote {
  id: string;
  title: string;
  description: string | null;
  courseCode: string | null;
  courseName: string;
  department: string | null;
  files: MediaAsset[];
  uploader: Pick<PublicUser, "id" | "username" | "displayName" | "avatarUrl">;
  university: PublicUniversity | null;
  downloadCount: number;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
  viewer?: { myRating: number | null; canDelete: boolean };
}

export interface PublicConfession {
  id: string;
  content: string;
  alias: string;
  topic: string | null;
  scope: "UNIVERSITY" | "GLOBAL";
  university: PublicUniversity | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  viewer?: { hasLiked: boolean; isMine: boolean };
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: PublicUser;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

/** Socket.IO olay isimleri (sunucu ve istemci ortak kullanır). */
export const SOCKET_EVENTS = {
  // istemci -> sunucu
  JOIN_CONVERSATION: "conversation:join",
  LEAVE_CONVERSATION: "conversation:leave",
  SEND_MESSAGE: "message:send",
  TYPING: "typing",
  MARK_READ: "conversation:read",
  // sunucu -> istemci
  MESSAGE_NEW: "message:new",
  MESSAGE_DELETED: "message:deleted",
  TYPING_UPDATE: "typing:update",
  NOTIFICATION_NEW: "notification:new",
  PRESENCE_UPDATE: "presence:update",
  CONVERSATION_UPDATED: "conversation:updated",
  POST_LIVE: "post:live",
  ERROR: "error",
} as const;
