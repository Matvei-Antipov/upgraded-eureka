import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { toApiError } from '../api/client';
import {
  fetchUserById,
  loginUser,
  logoutUser,
  updateUserProfile,
  uploadUserAvatar,
  adminCreateUser,
  adminDeleteUser,
  handleSessionExpired,
} from './authSlice';
import {
  DEFAULT_PAGE_SIZE,
  FETCH_ALL_LIMIT,
} from '../config';
import { buildCommentContent, parseCommentContent } from '../utils/comments';
import {
  registerVisit,
  storeSiteStats,
} from '../utils/storage';

export const REACTION_TYPES = [
  { id: 'fire', emoji: '🔥', label: 'Гаряче', labelEn: 'Hot', weight: 2 },
  { id: 'idea', emoji: '💡', label: 'Ідея', labelEn: 'Idea', weight: 2 },
  { id: 'heart', emoji: '❤️', label: 'Корисно', labelEn: 'Helpful', weight: 1 },
  { id: 'clap', emoji: '👏', label: 'Браво', labelEn: 'Bravo', weight: 1 },
];

const loadFromStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveToStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
};

const pendingPreviewIds = new Set();

const parseLikesResponse = (likesData, currentUserId) => {
  if (typeof likesData === 'number') {
    return { score: likesData, myVote: null, list: [] };
  }
  if (!Array.isArray(likesData)) {
    return { score: null, myVote: null, list: [] };
  }
  let myVote = null;
  const score = likesData.reduce((acc, item) => {
    const isDislike = item?.type === 'dislike';
    if (
      currentUserId &&
      Number(item?.author_id || item?.user_id) === Number(currentUserId)
    ) {
      myVote = isDislike ? 'dislike' : 'like';
    }
    return isDislike ? acc - 1 : acc + 1;
  }, 0);

  return { score, myVote, list: likesData };
};

export const checkApiHealth = createAsyncThunk('posts/checkApiHealth', async () => {
  try {
    await api.get('');
    return true;
  } catch {
    return false;
  }
});

export const fetchPosts = createAsyncThunk(
  'posts/fetchPosts',
  async (append = false, { getState, rejectWithValue }) => {
    const {
      sortBy,
      order,
      categoryId,
      statusFilter,
      startDate,
      endDate,
    } = getState().posts;
    const { user } = getState().auth;
    const isAdmin = user?.role === 'admin';

    const baseParams = {
      page: 1,
      limit: FETCH_ALL_LIMIT,
      sortBy,
      order: String(order || 'DESC').toUpperCase(),
    };

    if (categoryId) baseParams.category = categoryId;
    if (startDate) baseParams.startDate = `${startDate} 00:00:00`;
    if (endDate) baseParams.endDate = `${endDate} 23:59:59`;

    try {
      if (isAdmin && statusFilter === 'all') {
        const [activeRes, inactiveRes] = await Promise.all([
          api.get('/posts', { params: { ...baseParams, status: 'active' } }),
          api
            .get('/posts', { params: { ...baseParams, status: 'inactive' } })
            .catch(() => ({ data: [] })),
        ]);
        const activeList = Array.isArray(activeRes.data) ? activeRes.data : [];
        const inactiveList = Array.isArray(inactiveRes.data) ? inactiveRes.data : [];
        const byId = new Map();
        [...activeList, ...inactiveList].forEach((p) => {
          if (p?.id) byId.set(Number(p.id), p);
        });
        return { data: Array.from(byId.values()), append };
      }

      const params = { ...baseParams };
      if (isAdmin && statusFilter === 'inactive') {
        params.status = 'inactive';
      } else {
        params.status = 'active';
      }

      const response = await api.get('/posts', { params });
      return { data: response.data, append };
    } catch (error) {
      return rejectWithValue(toApiError(error, 'errorLoadingPosts'));
    }
  }
);

export const fetchCategories = createAsyncThunk(
  'posts/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/categories');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const fetchCategoryById = createAsyncThunk(
  'posts/fetchCategoryById',
  async (categoryId, { rejectWithValue }) => {
    if (!categoryId) return null;
    try {
      const response = await api.get(`/categories/${categoryId}`);
      return response.data || null;
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const fetchCommentById = createAsyncThunk(
  'posts/fetchCommentById',
  async (commentId, { rejectWithValue }) => {
    if (!commentId) return null;
    try {
      const response = await api.get(`/comments/${commentId}`);
      return response.data || null;
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const createCategory = createAsyncThunk(
  'posts/createCategory',
  async ({ title, description }, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token || user?.role !== 'admin') {
      return rejectWithValue(toApiError(null, 'authRequiredToast'));
    }
    const cleanTitle = title.trim();
    const cleanDesc = description?.trim() || '';
    try {
      const response = await api.post('/categories', {
        title: cleanTitle,
        description: cleanDesc,
      });
      const createdId = response.data?.categoryId || response.data?.id;
      return {
        id: Number(createdId),
        title: cleanTitle,
        description: cleanDesc,
      };
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const updateCategory = createAsyncThunk(
  'posts/updateCategory',
  async ({ categoryId, title, description }, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token || user?.role !== 'admin') {
      return rejectWithValue(toApiError(null, 'authRequiredToast'));
    }
    try {
      await api.patch(`/categories/${categoryId}`, { title, description });
      return { categoryId, title, description };
    } catch (error) {
      if (
        error.response?.status === 404 &&
        String(error.response?.data?.error || '').includes('no changes')
      ) {
        return { categoryId, title, description };
      }
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const deleteCategory = createAsyncThunk(
  'posts/deleteCategory',
  async (categoryId, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token || user?.role !== 'admin') {
      return rejectWithValue(toApiError(null, 'authRequiredToast'));
    }
    try {
      await api.delete(`/categories/${categoryId}`);
      return categoryId;
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const fetchPostPreviewComments = createAsyncThunk(
  'posts/fetchPostPreviewComments',
  async (postId, { getState }) => {
    const { user } = getState().auth;
    const currentUserId = user?.id;
    try {
      const [commentsRes, categoriesRes, likesRes] = await Promise.all([
        api.get(`/posts/${postId}/comments`).catch(() => ({ data: [] })),
        api.get(`/posts/${postId}/categories`).catch(() => ({ data: [] })),
        api.get(`/posts/${postId}/like`).catch(() => ({ data: null })),
      ]);

      const comments = Array.isArray(commentsRes.data) ? commentsRes.data : [];
      const categories = Array.isArray(categoriesRes.data) ? categoriesRes.data : [];
      const {
        score: likesScore,
        myVote,
        list: likesList,
      } = parseLikesResponse(likesRes.data, currentUserId);

      const commentLikesScores = {};
      const commentMyVotes = {};
      await Promise.all(
        comments.slice(0, 10).map(async (c) => {
          if (!c?.id) return;
          try {
            const cLikeRes = await api.get(`/comments/${c.id}/like`);
            const parsed = parseLikesResponse(cLikeRes.data, currentUserId);
            if (parsed.score !== null) {
              commentLikesScores[c.id] = parsed.score;
            }
            commentMyVotes[c.id] = parsed.myVote || null;
          } catch {
            // ignore preview comment like fetch error
          }
        })
      );

      return {
        postId,
        comments,
        categories,
        likesScore,
        myVote,
        likesList,
        commentLikesScores,
        commentMyVotes,
      };
    } finally {
      pendingPreviewIds.delete(String(postId));
    }
  },
  {
    condition: (postId, { getState }) => {
      if (!postId) return false;
      const key = String(postId);
      const { previewCommentsByPost } = getState().posts;
      if (previewCommentsByPost[key] !== undefined || pendingPreviewIds.has(key)) {
        return false;
      }
      pendingPreviewIds.add(key);
      return true;
    },
  }
);

const loadFullPostBundle = async (postId, currentUserId) => {
  const [postRes, categoriesRes, commentsRes, postLikesRes] = await Promise.all([
    api.get(`/posts/${postId}`),
    api.get(`/posts/${postId}/categories`).catch(() => ({ data: [] })),
    api.get(`/posts/${postId}/comments`).catch(() => ({ data: [] })),
    api.get(`/posts/${postId}/like`).catch(() => ({ data: null })),
  ]);

  const comments = Array.isArray(commentsRes.data) ? commentsRes.data : [];
  const {
    score: postLikesScore,
    myVote: myPostVote,
    list: postLikesList,
  } = parseLikesResponse(postLikesRes.data, currentUserId);

  const commentLikesScores = {};
  const commentMyVotes = {};
  const commentLikesLists = {};

  await Promise.all(
    comments.map(async (c) => {
      if (!c.id) return;
      try {
        const cLikeRes = await api.get(`/comments/${c.id}/like`);
        const { score, myVote, list } = parseLikesResponse(
          cLikeRes.data,
          currentUserId
        );
        if (score !== null) {
          commentLikesScores[c.id] = score;
        }
        commentMyVotes[c.id] = myVote || null;
        commentLikesLists[c.id] = list;
      } catch {
        // Ignore single comment like error
      }
    })
  );

  return {
    post: postRes.data,
    categories: Array.isArray(categoriesRes.data) ? categoriesRes.data : [],
    comments,
    postLikesScore,
    myPostVote,
    postLikesList,
    commentLikesScores,
    commentMyVotes,
    commentLikesLists,
  };
};

export const fetchPostDetails = createAsyncThunk(
  'posts/fetchPostDetails',
  async (postId, { getState, rejectWithValue }) => {
    const currentUserId = getState().auth.user?.id;
    try {
      return await loadFullPostBundle(postId, currentUserId);
    } catch (error) {
      return rejectWithValue(toApiError(error, 'notFoundTitle'));
    }
  }
);

export const silentFetchPostDetails = createAsyncThunk(
  'posts/silentFetchPostDetails',
  async (postId, { getState }) => {
    const currentUserId = getState().auth.user?.id;
    try {
      return await loadFullPostBundle(postId, currentUserId);
    } catch {
      return null;
    }
  }
);

export const checkIncomingComments = createAsyncThunk(
  'posts/checkIncomingComments',
  async (_, { getState, dispatch }) => {
    const { user, usersMap } = getState().auth;
    const currentUserId = user?.id;
    if (!currentUserId) return null;

    const { items, currentPost } = getState().posts;

    const myPostsMap = new Map();
    items.forEach((p) => {
      if (Number(p.author_id) === Number(currentUserId)) {
        myPostsMap.set(Number(p.id), p);
      }
    });
    if (currentPost && Number(currentPost.author_id) === Number(currentUserId)) {
      myPostsMap.set(Number(currentPost.id), currentPost);
    }

    const myPosts = Array.from(myPostsMap.values()).slice(0, 10);
    if (myPosts.length === 0) return null;

    const storageKey = `usof_seen_u${currentUserId}`;
    const seenMap = loadFromStorage(storageKey, {});

    let newestAlert = null;
    const updatedPreviews = {};

    const resolveCommentAuthorLogin = async (aid) => {
      if (!aid) return 'User';
      if (usersMap[String(aid)]?.login) {
        return usersMap[String(aid)].login;
      }
      try {
        const res = await dispatch(fetchUserById(aid));
        if (res.payload?.login) return res.payload.login;
      } catch {
        // Ignore
      }
      return `user_${aid}`;
    };

    await Promise.all(
      myPosts.map(async (post) => {
        try {
          const res = await api.get(`/posts/${post.id}/comments`);
          const comments = Array.isArray(res.data) ? res.data : [];
          updatedPreviews[post.id] = comments;

          const seenForPost = Array.isArray(seenMap[post.id])
            ? seenMap[post.id]
            : null;

          if (seenForPost === null) {
            seenMap[post.id] = comments.map((c) => String(c.id));
          } else {
            const knownSet = new Set(seenForPost.map(String));
            const newCommentsFromOthers = comments.filter(
              (c) =>
                !knownSet.has(String(c.id)) &&
                Number(c.author_id) !== Number(currentUserId)
            );

            seenMap[post.id] = comments.map((c) => String(c.id));

            if (newCommentsFromOthers.length > 0) {
              const latest =
                newCommentsFromOthers[newCommentsFromOthers.length - 1];
              const aid = latest.author_id;
              const resolvedLogin = await resolveCommentAuthorLogin(aid);
              const { text: cleanContent } = parseCommentContent(latest.content);
              newestAlert = {
                id: `${post.id}_${latest.id}_${Date.now()}`,
                postId: post.id,
                postTitle: post.title,
                commentId: latest.id,
                authorId: aid,
                authorLogin: resolvedLogin,
                content: cleanContent,
                publishDate: new Date().toISOString(),
              };
            }
          }
        } catch {
          // Ignore network errors during background poll
        }
      })
    );

    saveToStorage(storageKey, seenMap);
    return { updatedPreviews, newestAlert };
  }
);

export const createNewPost = createAsyncThunk(
  'posts/createNewPost',
  async ({ title, content, categories }, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token || !user) {
      return rejectWithValue(toApiError(null, 'authRequiredToast'));
    }

    const allCategories = getState().posts.categories;
    const validCatIds = (categories || [])
      .map((id) => Number(id))
      .filter((id) => allCategories.some((c) => Number(c.id) === id));

    if (validCatIds.length === 0) {
      return rejectWithValue(toApiError(null, 'selectAtLeastOneCategoryError'));
    }

    const selectedCategoryObjects = allCategories.filter((c) =>
      validCatIds.includes(Number(c.id))
    );

    try {
      const response = await api.post('/posts', {
        title,
        content,
        categories: validCatIds,
      });
      const createdId = response.data?.postId || response.data?.id;

      let serverPost = null;
      if (createdId) {
        try {
          const getRes = await api.get(`/posts/${createdId}`);
          serverPost = getRes.data;
        } catch {
          serverPost = null;
        }
      }

      if (user?.id && createdId) {
        const storageKey = `usof_seen_u${user.id}`;
        const seenMap = loadFromStorage(storageKey, {});
        seenMap[createdId] = [];
        saveToStorage(storageKey, seenMap);
      }

      const immediateServerPost = {
        ...(serverPost || {}),
        id: createdId,
        author_id: user.id,
        title: serverPost?.title || title,
        content: serverPost?.content || content,
        status: serverPost?.status || 'active',
        publish_date: serverPost?.publish_date || new Date().toISOString(),
        likes_count: 0,
        categories: selectedCategoryObjects,
      };

      return { createdPost: immediateServerPost };
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const updateExistingPost = createAsyncThunk(
  'posts/updateExistingPost',
  async ({ postId, title, content, status }, { getState, rejectWithValue }) => {
    const { token } = getState().auth;
    if (!token) {
      return rejectWithValue(toApiError(null, 'authRequiredToast'));
    }

    const payload = {};
    if (title !== undefined) payload.title = title;
    if (content !== undefined) payload.content = content;
    if (status !== undefined) payload.status = status;

    try {
      await api.patch(`/posts/${postId}`, payload);
      return { postId, ...payload };
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const deleteExistingPost = createAsyncThunk(
  'posts/deleteExistingPost',
  async (postId, { getState, rejectWithValue }) => {
    const { token } = getState().auth;
    if (!token) {
      return rejectWithValue(toApiError(null, 'authRequiredToast'));
    }

    try {
      await api.delete(`/posts/${postId}`);
      return postId;
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const createComment = createAsyncThunk(
  'posts/createComment',
  async ({ postId, content, parentCommentId = null }, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token || !user) {
      return rejectWithValue(toApiError(null, 'authRequiredToast'));
    }

    const encodedContent = buildCommentContent(content, parentCommentId);

    try {
      const response = await api.post(`/posts/${postId}/comments`, {
        content: encodedContent,
      });
      const commentsRes = await api.get(`/posts/${postId}/comments`);
      const serverComments = Array.isArray(commentsRes.data)
        ? commentsRes.data
        : [];
      const newId =
        response.data?.commentId ||
        response.data?.id ||
        serverComments[serverComments.length - 1]?.id;

      return {
        postId,
        serverComments,
        newCommentId: newId,
      };
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const updateComment = createAsyncThunk(
  'posts/updateComment',
  async ({ postId, commentId, content, status }, { getState, rejectWithValue }) => {
    const { token } = getState().auth;
    if (!token) {
      return rejectWithValue(toApiError(null, 'authRequiredToast'));
    }

    const existingComment = getState().posts.currentPostComments.find(
      (c) => String(c.id) === String(commentId)
    );

    const payload = {};
    if (content !== undefined) {
      const { parentId } = parseCommentContent(existingComment?.content);
      payload.content = buildCommentContent(content, parentId);
    }
    if (status !== undefined) {
      payload.status = status;
    }

    try {
      await api.patch(`/comments/${commentId}`, payload);
      return {
        postId,
        commentId,
        content: payload.content ?? existingComment?.content,
        status: payload.status ?? existingComment?.status,
      };
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const deleteComment = createAsyncThunk(
  'posts/deleteComment',
  async ({ postId, commentId }, { getState, rejectWithValue }) => {
    const { token } = getState().auth;
    if (!token) {
      return rejectWithValue(toApiError(null, 'authRequiredToast'));
    }

    try {
      await api.delete(`/comments/${commentId}`);
      return { postId, commentId };
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const votePost = createAsyncThunk(
  'posts/votePost',
  async ({ postId, type }, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token || !user) {
      return rejectWithValue(toApiError(null, 'authRequiredToast'));
    }
    const currentUserId = user.id;
    const currentVote = getState().posts.userVotes[postId] || null;

    try {
      if (currentVote === type) {
        await api.delete(`/posts/${postId}/like`);
      } else {
        // Backend `Like.createOrUpdate` updates an existing vote in place
        await api.post(`/posts/${postId}/like`, { type });
      }

      const likesRes = await api.get(`/posts/${postId}/like`);
      const parsed = parseLikesResponse(likesRes.data, currentUserId);

      return {
        postId,
        nextVote: parsed.myVote,
        serverScore: parsed.score,
        likesList: parsed.list,
      };
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const voteComment = createAsyncThunk(
  'posts/voteComment',
  async ({ commentId, type }, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token || !user) {
      return rejectWithValue(toApiError(null, 'authRequiredToast'));
    }
    const currentUserId = user.id;
    const currentVote = getState().posts.commentVotes[commentId] || null;

    try {
      if (currentVote === type) {
        await api.delete(`/comments/${commentId}/like`);
      } else {
        await api.post(`/comments/${commentId}/like`, { type });
      }

      const likesRes = await api.get(`/comments/${commentId}/like`);
      const parsed = parseLikesResponse(likesRes.data, currentUserId);

      return {
        commentId,
        nextVote: parsed.myVote,
        serverScore: parsed.score,
        likesList: parsed.list,
      };
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const adminRemoveUserLike = createAsyncThunk(
  'posts/adminRemoveUserLike',
  async ({ postId, commentId, targetUserId }, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token || user?.role !== 'admin') {
      return rejectWithValue(toApiError(null, 'authRequiredToast'));
    }
    const currentUserId = user.id;
    const endpoint = postId
      ? `/posts/${postId}/like`
      : `/comments/${commentId}/like`;

    try {
      await api.delete(endpoint, { params: { user_id: targetUserId } });
      const likesRes = await api.get(endpoint);
      const parsed = parseLikesResponse(likesRes.data, currentUserId);
      return {
        postId: postId || null,
        commentId: commentId || null,
        nextVote: parsed.myVote,
        serverScore: parsed.score,
        likesList: parsed.list,
      };
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

const makeToast = (key, type = 'success', detail = null) => ({
  id: Date.now() + Math.random(),
  key,
  detail,
  type,
});

const postsSlice = createSlice({
  name: 'posts',
  initialState: {
    items: [],
    categories: [],
    previewCommentsByPost: {},
    previewCategoriesByPost: {},
    postLikesMap: {},
    commentLikesMap: {},
    postLikesListMap: {},
    commentLikesListMap: {},
    status: 'idle',
    error: null,
    apiConnected: true,
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    paginationMode: 'pages',
    sortBy: 'date',
    order: 'DESC',
    categoryId: null,
    statusFilter: 'active',
    startDate: '',
    endDate: '',
    searchQuery: '',
    viewMode: 'all',
    selectedPostId: null,
    currentPost: null,
    currentPostCategories: [],
    currentPostComments: [],
    postDetailsStatus: 'idle',
    postDetailsError: null,
    isAskModalOpen: false,
    editingPost: null,
    notification: null,
    commentAlert: null,
    highlightedCommentId: null,
    userVotes: {},
    commentVotes: {},
    postReactions: loadFromStorage('usof_post_reactions_v2', {}),
    commentReactions: loadFromStorage('usof_comment_reactions_v2', {}),
    savedPostsByUser: loadFromStorage('usof_saved_by_user_v2', {}),
    siteStats: registerVisit(),
  },
  reducers: {
    showNotification: (state, action) => {
      if (typeof action.payload === 'string') {
        state.notification = makeToast(action.payload, 'success');
      } else {
        state.notification = makeToast(
          action.payload?.key || action.payload?.message || 'actionFailedError',
          action.payload?.type || 'success',
          action.payload?.detail || null
        );
      }
    },
    clearNotification: (state) => {
      state.notification = null;
    },
    clearCommentAlert: (state) => {
      state.commentAlert = null;
    },
    setHighlightedCommentId: (state, action) => {
      state.highlightedCommentId = action.payload;
    },
    openAskModal: (state, action) => {
      state.editingPost = action.payload || null;
      state.isAskModalOpen = true;
    },
    closeAskModal: (state) => {
      state.isAskModalOpen = false;
      state.editingPost = null;
    },
    setPaginationMode: (state, action) => {
      state.paginationMode = action.payload;
      state.page = 1;
    },
    openPostPage: (state, action) => {
      const postId = Number(action.payload);
      state.selectedPostId = postId;

      state.siteStats.postViews = (state.siteStats.postViews || 0) + 1;
      state.siteStats.viewsByPost = {
        ...(state.siteStats.viewsByPost || {}),
        [postId]: (state.siteStats.viewsByPost?.[postId] || 0) + 1,
      };
      storeSiteStats(state.siteStats);

      try {
        const url = new URL(window.location.href);
        url.searchParams.set('post', String(postId));
        window.history.replaceState({}, '', url.toString());
      } catch {
        // ignore history errors
      }
    },
    closePostPage: (state) => {
      state.selectedPostId = null;
      state.currentPost = null;
      state.currentPostCategories = [];
      state.currentPostComments = [];
      state.postDetailsStatus = 'idle';
      state.postDetailsError = null;
      state.highlightedCommentId = null;

      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('post')) {
          url.searchParams.delete('post');
          window.history.replaceState({}, '', url.toString());
        }
      } catch {
        // ignore
      }
    },
    setViewMode: (state, action) => {
      const mode = action.payload;
      state.viewMode = mode;
      state.selectedPostId = null;
      state.page = 1;
      if (mode === 'popular') {
        state.sortBy = 'likes';
        state.order = 'DESC';
      } else if (mode === 'new' || mode === 'all') {
        state.sortBy = 'date';
        state.order = 'DESC';
      }
    },
    setSortBy: (state, action) => {
      state.sortBy = action.payload;
      if (action.payload === 'likes') {
        state.viewMode = 'popular';
      } else if (state.viewMode === 'popular') {
        state.viewMode = 'all';
      }
      state.page = 1;
    },
    setOrder: (state, action) => {
      state.order = String(action.payload || 'DESC').toUpperCase();
      state.page = 1;
    },
    setCategoryId: (state, action) => {
      const val = action.payload;
      state.categoryId =
        val === null || val === '' || val === 'all' ? null : Number(val);
      state.selectedPostId = null;
      if (state.viewMode === 'saved' || state.viewMode === 'stats') {
        state.viewMode = 'all';
      }
      state.page = 1;
    },
    setStatusFilter: (state, action) => {
      state.statusFilter = action.payload;
      state.page = 1;
    },
    setStartDate: (state, action) => {
      state.startDate = action.payload;
      state.page = 1;
    },
    setEndDate: (state, action) => {
      state.endDate = action.payload;
      state.page = 1;
    },
    clearDateFilter: (state) => {
      state.startDate = '';
      state.endDate = '';
      state.page = 1;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
      state.page = 1;
    },
    setPage: (state, action) => {
      state.page = Math.max(1, Number(action.payload) || 1);
    },
    setLimit: (state, action) => {
      state.limit = Number(action.payload) || DEFAULT_PAGE_SIZE;
      state.page = 1;
    },
    toggleReaction: (state, action) => {
      const { postId, reactionId, userId = 'guest' } = action.payload;
      const existing = state.postReactions[postId] || {
        counts: {},
        byUser: {},
      };
      const userList = existing.byUser?.[userId] || [];
      const isSelected = userList.includes(reactionId);
      const currentCount = existing.counts?.[reactionId] || 0;

      const updatedCounts = {
        ...existing.counts,
        [reactionId]: isSelected
          ? Math.max(0, currentCount - 1)
          : currentCount + 1,
      };
      const updatedUserList = isSelected
        ? userList.filter((id) => id !== reactionId)
        : [...userList, reactionId];

      state.postReactions[postId] = {
        counts: updatedCounts,
        byUser: { ...(existing.byUser || {}), [userId]: updatedUserList },
      };

      saveToStorage('usof_post_reactions_v2', state.postReactions);
      state.notification = makeToast(
        isSelected ? 'reactionRemovedToast' : 'reactionAddedToast',
        'success'
      );
    },
    toggleCommentReaction: (state, action) => {
      const { commentId, reactionId, userId = 'guest' } = action.payload;
      const existing = state.commentReactions[commentId] || {
        counts: {},
        byUser: {},
      };
      const userList = existing.byUser?.[userId] || [];
      const isSelected = userList.includes(reactionId);
      const currentCount = existing.counts?.[reactionId] || 0;

      const updatedCounts = {
        ...existing.counts,
        [reactionId]: isSelected
          ? Math.max(0, currentCount - 1)
          : currentCount + 1,
      };
      const updatedUserList = isSelected
        ? userList.filter((id) => id !== reactionId)
        : [...userList, reactionId];

      state.commentReactions[commentId] = {
        counts: updatedCounts,
        byUser: { ...(existing.byUser || {}), [userId]: updatedUserList },
      };

      saveToStorage('usof_comment_reactions_v2', state.commentReactions);
      state.notification = makeToast(
        isSelected ? 'reactionRemovedToast' : 'reactionAddedToast',
        'success'
      );
    },
    toggleSavePost: (state, action) => {
      const { post, userId = 'guest' } = action.payload?.post
        ? action.payload
        : { post: action.payload, userId: 'guest' };
      if (!post || !post.id) return;

      const bucketKey = String(userId || 'guest');
      const currentBucket = { ...(state.savedPostsByUser[bucketKey] || {}) };
      const wasSaved = Boolean(currentBucket[post.id]);

      if (wasSaved) {
        delete currentBucket[post.id];
      } else {
        currentBucket[post.id] = post;
      }

      state.savedPostsByUser[bucketKey] = currentBucket;
      saveToStorage('usof_saved_by_user_v2', state.savedPostsByUser);

      state.notification = makeToast(
        wasSaved ? 'postUnsavedToast' : 'postSavedToast',
        'success'
      );
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkApiHealth.fulfilled, (state, action) => {
        state.apiConnected = action.payload;
      })
      .addCase(fetchPosts.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.apiConnected = true;
        const { data: payload } = action.payload;
        const fetchedItems = Array.isArray(payload)
          ? payload
          : payload?.posts || payload?.data || [];

        const seenIds = new Set();
        const unique = [];
        fetchedItems.forEach((p) => {
          if (p && !seenIds.has(String(p.id))) {
            seenIds.add(String(p.id));
            unique.push(p);
          }
        });
        state.items = unique;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
        if (action.payload?.network) {
          state.apiConnected = false;
        }
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload;
        state.apiConnected = true;
      })
      .addCase(fetchCategoryById.fulfilled, (state, action) => {
        const cat = action.payload;
        if (!cat?.id) return;
        const exists = state.categories.some(
          (c) => Number(c.id) === Number(cat.id)
        );
        if (exists) {
          state.categories = state.categories.map((c) =>
            Number(c.id) === Number(cat.id) ? { ...c, ...cat } : c
          );
        } else {
          state.categories.push(cat);
        }
      })
      .addCase(fetchCommentById.fulfilled, (state, action) => {
        const c = action.payload;
        if (!c?.id) return;
        state.currentPostComments = state.currentPostComments.map((item) =>
          Number(item.id) === Number(c.id) ? { ...item, ...c } : item
        );
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        state.categories.push(action.payload);
        state.notification = makeToast('categoryCreatedToast', 'success');
      })
      .addCase(createCategory.rejected, (state, action) => {
        state.notification = makeToast(
          action.payload?.key || 'actionFailedError',
          'error',
          action.payload?.detail
        );
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        const { categoryId, title, description } = action.payload;
        state.categories = state.categories.map((c) =>
          String(c.id) === String(categoryId)
            ? { ...c, title, description }
            : c
        );
        state.notification = makeToast('categoryUpdatedToast', 'success');
      })
      .addCase(updateCategory.rejected, (state, action) => {
        state.notification = makeToast(
          action.payload?.key || 'actionFailedError',
          'error',
          action.payload?.detail
        );
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        const catId = action.payload;
        state.categories = state.categories.filter(
          (c) => String(c.id) !== String(catId)
        );
        if (String(state.categoryId) === String(catId)) {
          state.categoryId = null;
        }
        state.notification = makeToast('categoryDeletedToast', 'success');
      })
      .addCase(deleteCategory.rejected, (state, action) => {
        state.notification = makeToast(
          action.payload?.key || 'actionFailedError',
          'error',
          action.payload?.detail
        );
      })
      .addCase(fetchPostPreviewComments.fulfilled, (state, action) => {
        const {
          postId,
          comments,
          categories,
          likesScore,
          myVote,
          likesList,
          commentLikesScores,
          commentMyVotes,
        } = action.payload;
        state.previewCommentsByPost[postId] = comments;
        state.previewCategoriesByPost[postId] = Array.isArray(categories)
          ? categories
          : [];

        if (Array.isArray(likesList)) {
          state.postLikesListMap[postId] = likesList;
        }

        if (likesScore !== null && likesScore !== undefined) {
          state.postLikesMap[postId] = likesScore;
          if (myVote) {
            state.userVotes[postId] = myVote;
          } else {
            delete state.userVotes[postId];
          }
        }

        if (commentLikesScores) {
          state.commentLikesMap = {
            ...state.commentLikesMap,
            ...commentLikesScores,
          };
        }
        if (commentMyVotes) {
          Object.entries(commentMyVotes).forEach(([cid, v]) => {
            if (v) {
              state.commentVotes[cid] = v;
            } else {
              delete state.commentVotes[cid];
            }
          });
        }
      })
      .addCase(fetchPostDetails.pending, (state) => {
        state.postDetailsStatus = 'loading';
        state.postDetailsError = null;
      })
      .addCase(fetchPostDetails.fulfilled, (state, action) => {
        state.postDetailsStatus = 'succeeded';
        const post = action.payload.post;
        const postId = post?.id;
        state.currentPost = post;
        state.currentPostCategories = action.payload.categories;
        state.currentPostComments = action.payload.comments;
        if (postId) {
          state.previewCommentsByPost[postId] = action.payload.comments;
          state.previewCategoriesByPost[postId] = action.payload.categories;
          if (Array.isArray(action.payload.postLikesList)) {
            state.postLikesListMap[postId] = action.payload.postLikesList;
          }
        }

        if (
          action.payload.postLikesScore !== null &&
          action.payload.postLikesScore !== undefined &&
          postId
        ) {
          state.postLikesMap[postId] = action.payload.postLikesScore;
          if (action.payload.myPostVote) {
            state.userVotes[postId] = action.payload.myPostVote;
          } else {
            delete state.userVotes[postId];
          }
        }

        if (action.payload.commentLikesScores) {
          state.commentLikesMap = {
            ...state.commentLikesMap,
            ...action.payload.commentLikesScores,
          };
        }
        if (action.payload.commentLikesLists) {
          state.commentLikesListMap = {
            ...state.commentLikesListMap,
            ...action.payload.commentLikesLists,
          };
        }
        if (action.payload.commentMyVotes) {
          Object.entries(action.payload.commentMyVotes).forEach(([cid, v]) => {
            if (v) {
              state.commentVotes[cid] = v;
            } else {
              delete state.commentVotes[cid];
            }
          });
        }
      })
      .addCase(fetchPostDetails.rejected, (state, action) => {
        state.postDetailsStatus = 'failed';
        state.postDetailsError = action.payload;
      })
      .addCase(silentFetchPostDetails.fulfilled, (state, action) => {
        if (!action.payload || !action.payload.post) return;
        const post = action.payload.post;
        const postId = post.id;
        if (String(state.selectedPostId) !== String(postId)) return;

        state.currentPost = {
          ...state.currentPost,
          ...post,
        };
        state.currentPostComments = action.payload.comments;
        state.previewCommentsByPost[postId] = action.payload.comments;

        if (Array.isArray(action.payload.postLikesList)) {
          state.postLikesListMap[postId] = action.payload.postLikesList;
        }
        if (
          action.payload.postLikesScore !== null &&
          action.payload.postLikesScore !== undefined
        ) {
          state.postLikesMap[postId] = action.payload.postLikesScore;
        }
        if (action.payload.commentLikesScores) {
          state.commentLikesMap = {
            ...state.commentLikesMap,
            ...action.payload.commentLikesScores,
          };
        }
        if (action.payload.commentLikesLists) {
          state.commentLikesListMap = {
            ...state.commentLikesListMap,
            ...action.payload.commentLikesLists,
          };
        }
      })
      .addCase(checkIncomingComments.fulfilled, (state, action) => {
        if (!action.payload) return;
        const { updatedPreviews, newestAlert } = action.payload;
        if (updatedPreviews) {
          Object.entries(updatedPreviews).forEach(([pid, comments]) => {
            state.previewCommentsByPost[pid] = comments;
            if (String(state.selectedPostId) === String(pid)) {
              state.currentPostComments = comments;
            }
          });
        }
        if (newestAlert) {
          state.commentAlert = newestAlert;
        }
      })
      .addCase(createNewPost.fulfilled, (state, action) => {
        const { createdPost } = action.payload;
        if (createdPost) {
          if (createdPost.categories && createdPost.categories.length > 0) {
            state.previewCategoriesByPost[createdPost.id] =
              createdPost.categories;
          }
          const filtered = state.items.filter(
            (p) => String(p.id) !== String(createdPost.id)
          );
          state.items = [createdPost, ...filtered];
          state.previewCommentsByPost[createdPost.id] = [];

          state.selectedPostId = createdPost.id;
          state.currentPost = createdPost;
          state.currentPostCategories = createdPost.categories || [];
          state.currentPostComments = [];
          state.postDetailsStatus = 'succeeded';
          state.postDetailsError = null;
        }
        state.isAskModalOpen = false;
        state.editingPost = null;
        state.notification = makeToast('postCreatedToast', 'success');
      })
      .addCase(createNewPost.rejected, (state, action) => {
        state.notification = makeToast(
          action.payload?.key || 'actionFailedError',
          'error',
          action.payload?.detail
        );
      })
      .addCase(updateExistingPost.fulfilled, (state, action) => {
        const { postId, title, content, status } = action.payload;

        const updateItem = (item) => {
          if (String(item.id) !== String(postId)) return item;
          return {
            ...item,
            title: title ?? item.title,
            content: content ?? item.content,
            status: status ?? item.status,
          };
        };

        state.items = state.items.map(updateItem);

        if (
          state.currentPost &&
          String(state.currentPost.id) === String(postId)
        ) {
          state.currentPost = updateItem(state.currentPost);
        }

        state.isAskModalOpen = false;
        state.editingPost = null;
        state.notification = makeToast('postUpdatedToast', 'success');
      })
      .addCase(updateExistingPost.rejected, (state, action) => {
        state.notification = makeToast(
          action.payload?.key || 'actionFailedError',
          'error',
          action.payload?.detail
        );
      })
      .addCase(deleteExistingPost.fulfilled, (state, action) => {
        const postId = String(action.payload);
        state.items = state.items.filter((p) => String(p.id) !== postId);

        Object.keys(state.savedPostsByUser).forEach((uid) => {
          if (state.savedPostsByUser[uid]?.[postId]) {
            delete state.savedPostsByUser[uid][postId];
          }
        });
        saveToStorage('usof_saved_by_user_v2', state.savedPostsByUser);

        if (String(state.selectedPostId) === postId) {
          state.selectedPostId = null;
          state.currentPost = null;
        }

        state.notification = makeToast('postDeletedToast', 'success');
      })
      .addCase(deleteExistingPost.rejected, (state, action) => {
        state.notification = makeToast(
          action.payload?.key || 'actionFailedError',
          'error',
          action.payload?.detail
        );
      })
      .addCase(createComment.fulfilled, (state, action) => {
        const { postId, serverComments } = action.payload;

        if (serverComments) {
          state.currentPostComments = serverComments;
          state.previewCommentsByPost[postId] = serverComments;
        }

        state.notification = makeToast('commentCreatedToast', 'success');
      })
      .addCase(createComment.rejected, (state, action) => {
        state.notification = makeToast(
          action.payload?.key || 'actionFailedError',
          'error',
          action.payload?.detail
        );
      })
      .addCase(updateComment.fulfilled, (state, action) => {
        const { postId, commentId, content, status } = action.payload;
        const updater = (c) =>
          String(c.id) === String(commentId)
            ? {
                ...c,
                content: content ?? c.content,
                status: status ?? c.status,
              }
            : c;

        state.currentPostComments = state.currentPostComments.map(updater);
        if (state.previewCommentsByPost[postId]) {
          state.previewCommentsByPost[postId] =
            state.previewCommentsByPost[postId].map(updater);
        }
        state.notification = makeToast('commentUpdatedToast', 'success');
      })
      .addCase(updateComment.rejected, (state, action) => {
        state.notification = makeToast(
          action.payload?.key || 'actionFailedError',
          'error',
          action.payload?.detail
        );
      })
      .addCase(deleteComment.fulfilled, (state, action) => {
        const { postId, commentId } = action.payload;
        state.currentPostComments = state.currentPostComments.filter(
          (c) => String(c.id) !== String(commentId)
        );
        if (state.previewCommentsByPost[postId]) {
          state.previewCommentsByPost[postId] = state.previewCommentsByPost[
            postId
          ].filter((c) => String(c.id) !== String(commentId));
        }

        state.notification = makeToast('commentDeletedToast', 'success');
      })
      .addCase(deleteComment.rejected, (state, action) => {
        state.notification = makeToast(
          action.payload?.key || 'actionFailedError',
          'error',
          action.payload?.detail
        );
      })
      .addCase(votePost.fulfilled, (state, action) => {
        const { postId, nextVote, serverScore, likesList } = action.payload;
        if (!nextVote) {
          delete state.userVotes[postId];
        } else {
          state.userVotes[postId] = nextVote;
        }

        if (serverScore !== null && serverScore !== undefined) {
          state.postLikesMap[postId] = serverScore;
        }
        if (Array.isArray(likesList)) {
          state.postLikesListMap[postId] = likesList;
        }
        state.notification = makeToast(
          nextVote === 'like'
            ? 'voteLikedToast'
            : nextVote === 'dislike'
            ? 'voteDislikedToast'
            : 'voteRemovedToast',
          'success'
        );
      })
      .addCase(votePost.rejected, (state, action) => {
        state.notification = makeToast(
          action.payload?.key || 'actionFailedError',
          'error',
          action.payload?.detail
        );
      })
      .addCase(voteComment.fulfilled, (state, action) => {
        const { commentId, nextVote, serverScore, likesList } = action.payload;
        if (!nextVote) {
          delete state.commentVotes[commentId];
        } else {
          state.commentVotes[commentId] = nextVote;
        }

        if (serverScore !== null && serverScore !== undefined) {
          state.commentLikesMap[commentId] = serverScore;
        }
        if (Array.isArray(likesList)) {
          state.commentLikesListMap[commentId] = likesList;
        }
        state.notification = makeToast(
          nextVote === 'like'
            ? 'voteLikedToast'
            : nextVote === 'dislike'
            ? 'voteDislikedToast'
            : 'voteRemovedToast',
          'success'
        );
      })
      .addCase(voteComment.rejected, (state, action) => {
        state.notification = makeToast(
          action.payload?.key || 'actionFailedError',
          'error',
          action.payload?.detail
        );
      })
      .addCase(adminRemoveUserLike.fulfilled, (state, action) => {
        const { postId, commentId, nextVote, serverScore, likesList } =
          action.payload;
        if (postId) {
          if (!nextVote) {
            delete state.userVotes[postId];
          } else {
            state.userVotes[postId] = nextVote;
          }
          if (serverScore !== null && serverScore !== undefined) {
            state.postLikesMap[postId] = serverScore;
          }
          if (Array.isArray(likesList)) {
            state.postLikesListMap[postId] = likesList;
          }
        } else if (commentId) {
          if (!nextVote) {
            delete state.commentVotes[commentId];
          } else {
            state.commentVotes[commentId] = nextVote;
          }
          if (serverScore !== null && serverScore !== undefined) {
            state.commentLikesMap[commentId] = serverScore;
          }
          if (Array.isArray(likesList)) {
            state.commentLikesListMap[commentId] = likesList;
          }
        }
        state.notification = makeToast('voteRemovedToast', 'success');
      })
      .addCase(loginUser.fulfilled, (state) => {
        state.userVotes = {};
        state.commentVotes = {};
        state.notification = makeToast('loginSuccessToast', 'success');
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.userVotes = {};
        state.commentVotes = {};
        if (state.statusFilter !== 'active') {
          state.statusFilter = 'active';
        }
        state.notification = makeToast('logoutSuccessToast', 'success');
      })
      .addCase(handleSessionExpired, (state) => {
        state.userVotes = {};
        state.commentVotes = {};
        state.notification = makeToast('sessionExpiredToast', 'error');
      })
      .addCase(updateUserProfile.fulfilled, (state) => {
        state.notification = makeToast('profileSavedToast', 'success');
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.notification = makeToast(
          action.payload?.key || 'actionFailedError',
          'error',
          action.payload?.detail
        );
      })
      .addCase(uploadUserAvatar.fulfilled, (state) => {
        state.notification = makeToast('avatarUpdatedToast', 'success');
      })
      .addCase(uploadUserAvatar.rejected, (state, action) => {
        state.notification = makeToast(
          action.payload?.key || 'actionFailedError',
          'error',
          action.payload?.detail
        );
      })
      .addCase(adminCreateUser.fulfilled, (state) => {
        state.notification = makeToast('userCreatedToast', 'success');
      })
      .addCase(adminCreateUser.rejected, (state, action) => {
        state.notification = makeToast(
          action.payload?.key || 'registerFailedError',
          'error',
          action.payload?.detail
        );
      })
      .addCase(adminDeleteUser.fulfilled, (state) => {
        state.notification = makeToast('userDeletedToast', 'success');
      })
      .addCase(adminDeleteUser.rejected, (state, action) => {
        state.notification = makeToast(
          action.payload?.key || 'actionFailedError',
          'error',
          action.payload?.detail
        );
      });
  },
});

export const {
  showNotification,
  clearNotification,
  clearCommentAlert,
  setHighlightedCommentId,
  openAskModal,
  closeAskModal,
  setPaginationMode,
  openPostPage,
  closePostPage,
  setViewMode,
  setSortBy,
  setOrder,
  setCategoryId,
  setStatusFilter,
  setStartDate,
  setEndDate,
  clearDateFilter,
  setSearchQuery,
  setPage,
  setLimit,
  toggleReaction,
  toggleCommentReaction,
  toggleSavePost,
} = postsSlice.actions;

export default postsSlice.reducer;
