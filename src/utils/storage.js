const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const userKey = (base, userId) => `${base}_u${userId}`;

export const loadSavedIds = (userId) =>
  userId ? read(userKey('usof_saved', userId), []).map(Number) : [];

export const storeSavedIds = (userId, ids) => {
  if (userId) write(userKey('usof_saved', userId), ids);
};

export const loadReactions = (userId) =>
  userId ? read(userKey('usof_reactions', userId), { posts: {}, comments: {} }) : { posts: {}, comments: {} };

export const storeReactions = (userId, reactions) => {
  if (userId) write(userKey('usof_reactions', userId), reactions);
};

export const loadSeenComments = (userId) => (userId ? read(userKey('usof_seen', userId), {}) : {});

export const storeSeenComments = (userId, map) => {
  if (userId) write(userKey('usof_seen', userId), map);
};

const STATS_KEY = 'usof_site_stats';

export const loadSiteStats = () =>
  read(STATS_KEY, { visits: 0, postViews: 0, viewsByPost: {}, firstVisit: null });

export const storeSiteStats = (stats) => write(STATS_KEY, stats);

export const registerVisit = () => {
  const stats = loadSiteStats();
  try {
    if (!sessionStorage.getItem('usof_visit_counted')) {
      stats.visits = (stats.visits || 0) + 1;
      stats.firstVisit = stats.firstVisit || new Date().toISOString();
      storeSiteStats(stats);
      sessionStorage.setItem('usof_visit_counted', '1');
    }
  } catch {}
  return stats;
};

const LEGACY_KEYS = [
  'usof_post_overrides',
  'usof_local_posts',
  'usof_deleted_posts',
  'usof_local_comments',
  'usof_comment_overrides',
  'usof_deleted_comments',
  'usof_profile_overrides',
  'usof_known_users',
  'usof_post_cat_overrides',
  'usof_comment_parents',
  'usof_user_votes',
  'usof_comment_votes',
  'usof_post_reactions',
  'usof_comment_reactions',
  'usof_saved_posts',
  'usof_user',
  'usof_user_overrides_by_id',
];

export const cleanupLegacyStorage = () => {
  try {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
    Object.keys(localStorage)
      .filter((key) => key.startsWith('usof_seen_comments_u_'))
      .forEach((key) => localStorage.removeItem(key));
  } catch {}
};
