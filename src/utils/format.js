import { PREVIEW_LENGTH } from '../config';

export const DEFAULT_AVATAR = 'default-avatar.png';

/**
 * The API stores only the uploaded file name (e.g. "1792571587852-me.png").
 * Files are served by the backend from /uploads (proxied by CRA in dev).
 */
export const avatarUrl = (user) => {
  const raw = user?.profile_picture;
  if (!raw || raw === DEFAULT_AVATAR) return null;
  if (/^(https?:|data:|blob:)/i.test(raw) || raw.startsWith('/')) return raw;
  return `/uploads/${encodeURIComponent(raw)}`;
};

export const getInitials = (name) => {
  const clean = String(name || '?').trim();
  return clean.slice(0, 2).toUpperCase();
};

const localeOf = (language) => (language === 'en' ? 'en-GB' : 'uk-UA');

export const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDate = (value, language) => {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString(localeOf(language), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDateTime = (value, language) => {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleString(localeOf(language), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const byteLength = (str) => new TextEncoder().encode(String(str || '')).length;

/**
 * Plain-text preview of a post body: code blocks and images are replaced with
 * short markers so the card height stays predictable.
 */
export const toPreviewText = (content, codeLabel, imageLabel, maxLength = PREVIEW_LENGTH) => {
  const text = String(content || '')
    .replace(/```[\s\S]*?```/g, ` [${codeLabel}] `)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ` [${imageLabel}] `)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
};

export const postAuthorId = (post) => Number(post?.author_id) || null;

const REACTION_WEIGHTS = {
  fire: 2,
  idea: 2,
  heart: 1,
  clap: 1,
};

const sumReactionBonus = (reactionEntry) => {
  const counts = reactionEntry?.counts;
  if (!counts || typeof counts !== 'object') return 0;
  return Object.entries(counts).reduce((sum, [id, count]) => {
    const weight = REACTION_WEIGHTS[id] || 1;
    return sum + (Number(count) || 0) * weight;
  }, 0);
};

/**
 * Automatically computes a user's live rating from:
 * 1. Base database rating (`user.rating`)
 * 2. Net likes minus dislikes across all of the user's posts
 * 3. Net likes minus dislikes across all of the user's comments
 * 4. Weighted community reactions on the user's posts and comments
 */
export const computeUserRating = (userId, postsState = {}, baseRating = 0) => {
  const targetId = Number(userId);
  if (!targetId) {
    return { total: Number(baseRating) || 0, likesScore: 0, reactionsBonus: 0 };
  }

  const {
    items = [],
    postLikesMap = {},
    previewCommentsByPost = {},
    currentPostComments = [],
    commentLikesMap = {},
    postReactions = {},
    commentReactions = {},
  } = postsState;

  let postsScore = 0;
  let reactionsBonus = 0;

  items.forEach((p) => {
    if (p && Number(p.author_id) === targetId) {
      postsScore += Number(postLikesMap[p.id] ?? p.likes_count ?? 0);
      reactionsBonus += sumReactionBonus(postReactions[p.id]);
    }
  });

  const seenCommentIds = new Set();
  const allComments = [
    ...Object.values(previewCommentsByPost).flat(),
    ...(Array.isArray(currentPostComments) ? currentPostComments : []),
  ];

  let commentsScore = 0;
  allComments.forEach((c) => {
    if (!c || !c.id || seenCommentIds.has(String(c.id))) return;
    seenCommentIds.add(String(c.id));
    if (Number(c.author_id) === targetId) {
      commentsScore += Number(commentLikesMap[c.id] ?? c.likes_count ?? 0);
      reactionsBonus += sumReactionBonus(commentReactions[c.id]);
    }
  });

  const likesScore = postsScore + commentsScore;
  const dbRating = Number(baseRating) || 0;
  const total = dbRating + likesScore + reactionsBonus;

  return { total, likesScore, reactionsBonus };
};
