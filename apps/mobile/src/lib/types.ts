export interface University {
  id: string;
  name: string;
  shortName: string;
  city: string;
  type: "STATE" | "FOUNDATION" | "OTHER";
}

export interface Education {
  id: string;
  department: string;
  classYear: number;
  university: University;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  department: string | null;
  classYear: number | null;
  isPrivate: boolean;
  showDepartment: boolean;
  karma: number;
  university: University | null;
  educations?: Education[];
  createdAt: string;
  isVerifiedStudent: boolean;
  badges?: { code: string; label: string; icon: string }[];
  counts?: { posts: number; followers: number; following: number; communities: number };
  viewer?: { isFollowing: boolean; isFollowedBy: boolean; isBlocked: boolean; isSelf: boolean };
}

export type MiniUser = Pick<User, "id" | "username" | "displayName" | "avatarUrl">;

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  scope: "DEPARTMENT" | "UNIVERSITY" | "GLOBAL";
  visibility: "PUBLIC" | "PRIVATE";
  department: string | null;
  university: University | null;
  tags: string[];
  rules: string[];
  memberCount: number;
  postCount: number;
  createdAt: string;
  viewer?: { isMember: boolean; role: string | null; hasPendingRequest: boolean };
}

export interface MediaAsset {
  url: string;
  type: "IMAGE" | "VIDEO" | "FILE";
  width?: number;
  height?: number;
  name?: string;
  size?: number;
}

export interface Post {
  id: string;
  content: string;
  media: MediaAsset[];
  author: User | null;
  isAnonymous: boolean;
  anonymousAlias: string | null;
  community: { id: string; slug: string; name: string; avatarUrl: string | null } | null;
  poll: {
    id: string;
    question: string;
    endsAt: string;
    totalVotes: number;
    options: { id: string; text: string; voteCount: number }[];
    viewerVotedOptionId: string | null;
  } | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  editedAt: string | null;
  isPinned: boolean;
  hashtags: string[];
  viewer: { hasLiked: boolean; hasBookmarked: boolean; canDelete: boolean; isMine: boolean };
}

export interface Comment {
  id: string;
  postId: string;
  parentId: string | null;
  content: string;
  author: User;
  likeCount: number;
  replyCount: number;
  createdAt: string;
  viewer: { hasLiked: boolean; canDelete: boolean };
  replies?: Comment[];
}

export interface Message {
  id: string;
  conversationId: string;
  sender: MiniUser;
  content: string;
  attachments: MediaAsset[];
  replyTo: { id: string; content: string; senderName: string } | null;
  createdAt: string;
  isDeleted: boolean;
  isMine?: boolean;
  pending?: boolean;
}

export interface Conversation {
  id: string;
  type: "DIRECT" | "GROUP" | "COMMUNITY";
  title: string | null;
  avatarUrl: string | null;
  peerUsername: string | null;
  community: { id: string; slug: string; name: string } | null;
  members: MiniUser[];
  lastMessage: Message | null;
  unreadCount: number;
  updatedAt: string;
}

export interface Notification {
  id: string;
  type: string;
  actor: MiniUser | null;
  text: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface KampusEvent {
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
  isCancelled: boolean;
  creator: MiniUser;
  community: { id: string; slug: string; name: string } | null;
  viewer?: { isAttending: boolean; canEdit: boolean };
}

export interface Confession {
  id: string;
  content: string;
  alias: string;
  topic: string | null;
  scope: "UNIVERSITY" | "GLOBAL";
  university: University | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  viewer: { hasLiked: boolean; isMine: boolean };
}
