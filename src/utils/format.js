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
