/**
 * Central place for UI parameters that must be "easily changeable"
 * (see Usof frontend PDF: pagination and preview parameters).
 */

// Pagination
export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
export const DEFAULT_PAGE_SIZE = 10;

// Maximum number of posts requested at once when the feed has to be
// filtered on the client (text search, admin "all statuses" view, stats).
export const FETCH_ALL_LIMIT = 1000;

// Post preview in the feed: number of characters shown before "…".
export const PREVIEW_LENGTH = 220;

// Profile page: how many of the user's posts are shown per "Show more" step.
export const PROFILE_POSTS_STEP = 10;

// Search input debounce.
export const SEARCH_DEBOUNCE_MS = 400;

// How often the app checks for new comments under the current user's posts.
export const COMMENT_POLL_INTERVAL_MS = 30000;

// Toast lifetime.
export const TOAST_DURATION_MS = 3500;

// Avatar upload limits.
export const MAX_AVATAR_SIZE_MB = 5;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Inline images inside post content are stored as base64 in a MySQL TEXT
// column (64 KB), so each embedded image must stay small.
export const MAX_INLINE_IMAGE_CHARS = 40000;

// MySQL TEXT column limit in bytes (posts.content / comments.content).
export const MAX_TEXT_BYTES = 65000;
