import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { clearInvalidSession, openAuthModal, fetchUserById } from './authSlice';

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

const applyPostState = (rawPost, categoryOverrides = {}) => {
  if (!rawPost) return null;
  const postOverrides = loadFromStorage('usof_post_overrides', {});
  const ov = postOverrides[String(rawPost.id)];
  const catOv = categoryOverrides[rawPost.id] || ov?.categories;

  return {
    ...rawPost,
    title: ov?.title !== undefined ? ov.title : rawPost.title,
    content: ov?.content !== undefined ? ov.content : rawPost.content,
    status: ov?.status !== undefined ? ov.status : rawPost.status,
    categories: catOv !== undefined ? catOv : rawPost.categories,
  };
};

const applyCommentsState = (rawComments) => {
  if (!Array.isArray(rawComments)) return [];
  const deletedIds = loadFromStorage('usof_deleted_comments', []);
  const overrides = loadFromStorage('usof_comment_overrides', {});
  return rawComments
    .filter((c) => c && !deletedIds.includes(String(c.id)))
    .map((c) => {
      const ov = overrides[String(c.id)];
      if (!ov) return c;
      return {
        ...c,
        content: ov.content !== undefined ? ov.content : c.content,
        status: ov.status !== undefined ? ov.status : c.status,
      };
    });
};

const parseLikesResponse = (likesData, currentUserId) => {
  if (typeof likesData === 'number') {
    return { score: likesData, myVote: null };
  }
  if (!Array.isArray(likesData)) {
    return { score: null, myVote: null };
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

  return { score, myVote };
};

const initSiteStats = () => {
  const stats = loadFromStorage('usof_site_stats', {
    totalVisits: 1,
    totalPostViews: 0,
    postViewsById: {},
    lastVisit: new Date().toISOString(),
  });
  if (!sessionStorage.getItem('usof_visit_counted')) {
    stats.totalVisits = (stats.totalVisits || 0) + 1;
    stats.lastVisit = new Date().toISOString();
    saveToStorage('usof_site_stats', stats);
    sessionStorage.setItem('usof_visit_counted', '1');
  }
  return stats;
};

export const fetchPosts = createAsyncThunk(
  'posts/fetchPosts',
  async (append = false, { getState, rejectWithValue }) => {
    const { sortBy, order, statusFilter } = getState().posts;
    const { user, token } = getState().auth;

    const params = {
      page: 1,
      limit: 100,
      sortBy,
      order,
    };

    if (user?.role === 'admin' && statusFilter && statusFilter !== 'active') {
      params.status = statusFilter;
    }

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get('/api/posts', { params, headers });
      return { data: response.data, append };
    } catch (error) {
      try {
        const retryResponse = await axios.get('/api/posts');
        return { data: retryResponse.data, append };
      } catch (retryError) {
        return rejectWithValue(
          retryError.response?.data?.error ||
            error.response?.data?.error ||
            error.message ||
            'Помилка завантаження постів з БД'
        );
      }
    }
  }
);

export const fetchCategories = createAsyncThunk(
  'posts/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('/api/categories');
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || 'Помилка завантаження категорій'
      );
    }
  }
);

export const createCategory = createAsyncThunk(
  'posts/createCategory',
  async ({ title, description }, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token || user?.role !== 'admin') {
      return rejectWithValue('Тільки адміністратор може створювати категорії');
    }
    const cleanTitle = title.trim();
    const cleanDesc = description?.trim() || `Питання за темою ${cleanTitle}`;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(
        '/api/categories',
        { title: cleanTitle, description: cleanDesc },
        { headers }
      );
      const createdId =
        response.data?.categoryId || response.data?.id || Date.now();
      return {
        id: Number(createdId),
        title: cleanTitle,
        description: cleanDesc,
      };
    } catch {
      return {
        id: Date.now(),
        title: cleanTitle,
        description: cleanDesc,
      };
    }
  }
);

export const updateCategory = createAsyncThunk(
  'posts/updateCategory',
  async ({ categoryId, title, description }, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token || user?.role !== 'admin') {
      return rejectWithValue('Тільки адміністратор може редагувати категорії');
    }
    try {
      await axios.patch(
        `/api/categories/${categoryId}`,
        { title, description },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      // Fallback
    }
    return { categoryId, title, description };
  }
);

export const deleteCategory = createAsyncThunk(
  'posts/deleteCategory',
  async (categoryId, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token || user?.role !== 'admin') {
      return rejectWithValue('Тільки адміністратор може видаляти категорії');
    }
    try {
      await axios.delete(`/api/categories/${categoryId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Fallback
    }
    return categoryId;
  }
);

export const fetchPostPreviewComments = createAsyncThunk(
  'posts/fetchPostPreviewComments',
  async (postId, { getState }) => {
    const { user, token } = getState().auth;
    const currentUserId = user?.id || user?.userId;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const [commentsRes, categoriesRes, likesRes] = await Promise.all([
        axios
          .get(`/api/posts/${postId}/comments`, { headers })
          .catch(() => ({ data: [] })),
        axios
          .get(`/api/posts/${postId}/categories`, { headers })
          .catch(() => ({ data: [] })),
        axios
          .get(`/api/posts/${postId}/like`, { headers })
          .catch(() => ({ data: null })),
      ]);

      const comments = applyCommentsState(
        Array.isArray(commentsRes.data) ? commentsRes.data : []
      );
      const categories = Array.isArray(categoriesRes.data)
        ? categoriesRes.data
        : [];
      const { score: likesScore, myVote } = parseLikesResponse(
        likesRes.data,
        currentUserId
      );

      return { postId, comments, categories, likesScore, myVote };
    } catch {
      return {
        postId,
        comments: [],
        categories: [],
        likesScore: null,
        myVote: null,
      };
    }
  }
);

export const fetchPostDetails = createAsyncThunk(
  'posts/fetchPostDetails',
  async (postId, { getState, rejectWithValue }) => {
    const { user, token } = getState().auth;
    const currentUserId = user?.id || user?.userId;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const [postRes, categoriesRes, commentsRes, postLikesRes] =
        await Promise.all([
          axios.get(`/api/posts/${postId}`, { headers }),
          axios
            .get(`/api/posts/${postId}/categories`, { headers })
            .catch(() => ({ data: [] })),
          axios
            .get(`/api/posts/${postId}/comments`, { headers })
            .catch(() => ({ data: [] })),
          axios
            .get(`/api/posts/${postId}/like`, { headers })
            .catch(() => ({ data: null })),
        ]);

      const comments = applyCommentsState(
        Array.isArray(commentsRes.data) ? commentsRes.data : []
      );
      const { score: postLikesScore, myVote: myPostVote } = parseLikesResponse(
        postLikesRes.data,
        currentUserId
      );

      const commentLikesScores = {};
      const commentMyVotes = {};

      await Promise.all(
        comments.map(async (c) => {
          if (!c.id) return;
          try {
            const cLikeRes = await axios.get(`/api/comments/${c.id}/like`, {
              headers,
            });
            const { score, myVote } = parseLikesResponse(
              cLikeRes.data,
              currentUserId
            );
            if (score !== null) {
              commentLikesScores[c.id] = score;
            }
            if (myVote) {
              commentMyVotes[c.id] = myVote;
            }
          } catch {
            // Ignore
          }
        })
      );

      return {
        post: postRes.data,
        categories: Array.isArray(categoriesRes.data) ? categoriesRes.data : [],
        comments,
        postLikesScore,
        myPostVote,
        commentLikesScores,
        commentMyVotes,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || 'Питання не знайдено в базі даних'
      );
    }
  }
);

export const silentFetchPostDetails = createAsyncThunk(
  'posts/silentFetchPostDetails',
  async (postId, { getState }) => {
    const { user, token } = getState().auth;
    const currentUserId = user?.id || user?.userId;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const [postRes, categoriesRes, commentsRes, postLikesRes] =
        await Promise.all([
          axios.get(`/api/posts/${postId}`, { headers }),
          axios
            .get(`/api/posts/${postId}/categories`, { headers })
            .catch(() => ({ data: [] })),
          axios
            .get(`/api/posts/${postId}/comments`, { headers })
            .catch(() => ({ data: [] })),
          axios
            .get(`/api/posts/${postId}/like`, { headers })
            .catch(() => ({ data: null })),
        ]);

      const comments = applyCommentsState(
        Array.isArray(commentsRes.data) ? commentsRes.data : []
      );
      const { score: postLikesScore, myVote: myPostVote } = parseLikesResponse(
        postLikesRes.data,
        currentUserId
      );

      const commentLikesScores = {};
      const commentMyVotes = {};

      await Promise.all(
        comments.map(async (c) => {
          if (!c.id) return;
          try {
            const cLikeRes = await axios.get(`/api/comments/${c.id}/like`, {
              headers,
            });
            const { score, myVote } = parseLikesResponse(
              cLikeRes.data,
              currentUserId
            );
            if (score !== null) commentLikesScores[c.id] = score;
            if (myVote) commentMyVotes[c.id] = myVote;
          } catch {
            // Ignore
          }
        })
      );

      return {
        post: postRes.data,
        categories: Array.isArray(categoriesRes.data) ? categoriesRes.data : [],
        comments,
        postLikesScore,
        myPostVote,
        commentLikesScores,
        commentMyVotes,
      };
    } catch {
      return null;
    }
  }
);

export const checkIncomingComments = createAsyncThunk(
  'posts/checkIncomingComments',
  async (_, { getState, dispatch }) => {
    const { user, token, usersMap } = getState().auth;
    const currentUserId = user?.id || user?.userId;
    if (!currentUserId) return null;

    const { items, currentPost } = getState().posts;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const myPostsMap = new Map();
    items.forEach((p) => {
      const aid = p.author_id || p.user_id || p.author?.id;
      if (
        Number(aid) === Number(currentUserId) ||
        (user?.login && p.author_login === user.login) ||
        (user?.dbLogin && p.author_login === user.dbLogin)
      ) {
        myPostsMap.set(Number(p.id), p);
      }
    });
    if (currentPost) {
      const aid =
        currentPost.author_id || currentPost.user_id || currentPost.author?.id;
      if (
        Number(aid) === Number(currentUserId) ||
        (user?.login && currentPost.author_login === user.login) ||
        (user?.dbLogin && currentPost.author_login === user.dbLogin)
      ) {
        myPostsMap.set(Number(currentPost.id), currentPost);
      }
    }

    const myPosts = Array.from(myPostsMap.values());
    if (myPosts.length === 0) return null;

    const storageKey = `usof_seen_comments_u_${currentUserId}`;
    const seenMap = loadFromStorage(storageKey, {});

    let newestAlert = null;
    const updatedPreviews = {};

    const resolveCommentAuthorLogin = async (aid, fallbackLogin) => {
      if (!aid) return fallbackLogin || 'User';
      const overrideMap = loadFromStorage('usof_user_overrides_by_id', {});
      if (overrideMap[String(aid)]?.login) {
        return overrideMap[String(aid)].login;
      }
      if (usersMap[aid]?.login) {
        return usersMap[aid].login;
      }
      try {
        const res = await dispatch(fetchUserById(aid));
        if (res.payload?.login) return res.payload.login;
      } catch {
        // Ignore
      }
      return fallbackLogin || `user_${aid}`;
    };

    await Promise.all(
      myPosts.map(async (post) => {
        try {
          const res = await axios.get(`/api/posts/${post.id}/comments`, {
            headers,
          });
          const comments = applyCommentsState(
            Array.isArray(res.data) ? res.data : []
          );
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
                Number(c.author_id || c.user_id) !== Number(currentUserId)
            );

            seenMap[post.id] = comments.map((c) => String(c.id));

            if (newCommentsFromOthers.length > 0) {
              const latest =
                newCommentsFromOthers[newCommentsFromOthers.length - 1];
              const aid = latest.author_id || latest.user_id;
              const resolvedLogin = await resolveCommentAuthorLogin(
                aid,
                latest.author_login
              );
              newestAlert = {
                id: `${post.id}_${latest.id}_${Date.now()}`,
                postId: post.id,
                postTitle: post.title,
                commentId: latest.id,
                authorId: aid,
                authorLogin: resolvedLogin,
                content: latest.content,
                publishDate: new Date().toISOString(),
              };
            }
          }
        } catch {
          // Ignore network errors
        }
      })
    );

    saveToStorage(storageKey, seenMap);

    return { updatedPreviews, newestAlert };
  }
);

export const createNewPost = createAsyncThunk(
  'posts/createNewPost',
  async (
    { title, content, categories },
    { getState, dispatch, rejectWithValue }
  ) => {
    const { token, user } = getState().auth;
    if (!token) {
      dispatch(openAuthModal('login'));
      return rejectWithValue('Необхідна авторизація для створення питання');
    }

    const allCategories = getState().posts.categories;
    const validCatIds = (categories || [])
      .map((id) => Number(id))
      .filter((id) => allCategories.some((c) => Number(c.id) === id));

    const finalCatIds =
      validCatIds.length > 0
        ? validCatIds
        : allCategories[0]?.id
        ? [Number(allCategories[0].id)]
        : [1];

    const selectedCategoryObjects = allCategories.filter((c) =>
      finalCatIds.includes(Number(c.id))
    );

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(
        '/api/posts',
        { title, content, categories: finalCatIds },
        { headers }
      );
      const createdId = response.data?.postId || response.data?.id;

      let serverPost = null;
      if (createdId) {
        try {
          const getRes = await axios.get(`/api/posts/${createdId}`, {
            headers,
          });
          serverPost = getRes.data;
        } catch {
          serverPost = null;
        }
      }

      const currentUserId = user?.id || user?.userId;
      if (currentUserId && createdId) {
        const storageKey = `usof_seen_comments_u_${currentUserId}`;
        const seenMap = loadFromStorage(storageKey, {});
        seenMap[createdId] = [];
        saveToStorage(storageKey, seenMap);
      }

      const immediateServerPost = {
        ...(serverPost || {}),
        id: createdId,
        author_id: currentUserId || serverPost?.author_id,
        author_login:
          user?.login || user?.full_name || serverPost?.author_login,
        title: serverPost?.title || title,
        content: serverPost?.content || content,
        status: serverPost?.status || 'active',
        publish_date: new Date().toISOString(),
        likes_count: 0,
        comments_count: 0,
        categories: selectedCategoryObjects,
      };

      return { createdPost: immediateServerPost };
    } catch (error) {
      const errStatus = error.response?.status;
      if (errStatus === 500 || errStatus === 401 || errStatus === 403) {
        dispatch(clearInvalidSession());
        dispatch(openAuthModal('login'));
        return rejectWithValue(
          'Ваша сесія застаріла (користувача не знайдено в БД). Будь ласка, увійдіть заново!'
        );
      }

      return rejectWithValue(
        error.response?.data?.error || 'Помилка створення питання'
      );
    }
  }
);

export const updateExistingPost = createAsyncThunk(
  'posts/updateExistingPost',
  async (
    { postId, title, content, status, categories },
    { getState, rejectWithValue }
  ) => {
    const { token } = getState().auth;
    if (!token) {
      return rejectWithValue('Необхідна авторизація');
    }

    const {
      currentPost,
      items,
      categories: allCategories,
    } = getState().posts;
    const existingPost =
      (currentPost && String(currentPost.id) === String(postId)
        ? currentPost
        : null) ||
      items.find((p) => String(p.id) === String(postId)) ||
      {};

    const finalTitle = title !== undefined ? title : existingPost.title || '';
    const finalContent =
      content !== undefined ? content : existingPost.content || '';
    const finalStatus =
      status !== undefined ? status : existingPost.status || 'active';

    const selectedCategoryObjects =
      categories && categories.length > 0
        ? allCategories.filter((c) => categories.includes(Number(c.id)))
        : undefined;

    const postOverrides = loadFromStorage('usof_post_overrides', {});
    const existingOv = postOverrides[String(postId)] || {};
    postOverrides[String(postId)] = {
      ...existingOv,
      title: finalTitle,
      content: finalContent,
      status: finalStatus,
      categories: selectedCategoryObjects ?? existingOv.categories,
    };
    saveToStorage('usof_post_overrides', postOverrides);

    const headers = { Authorization: `Bearer ${token}` };
    try {
      await axios.patch(
        `/api/posts/${postId}`,
        {
          title: finalTitle,
          content: finalContent,
          status: finalStatus,
          ...(categories && categories.length > 0 ? { categories } : {}),
        },
        { headers }
      );
    } catch {
      try {
        await axios.patch(
          `/api/posts/${postId}`,
          status !== undefined && title === undefined
            ? { status: finalStatus }
            : { title: finalTitle, content: finalContent },
          { headers }
        );
      } catch {
        // Saved in usof_post_overrides
      }
    }

    return {
      postId,
      title: finalTitle,
      content: finalContent,
      status: finalStatus,
      categories: selectedCategoryObjects,
    };
  }
);

export const deleteExistingPost = createAsyncThunk(
  'posts/deleteExistingPost',
  async (postId, { getState, rejectWithValue }) => {
    const { token } = getState().auth;
    if (!token) {
      return rejectWithValue('Необхідна авторизація');
    }

    const deletedPosts = loadFromStorage('usof_deleted_posts', []);
    if (!deletedPosts.includes(String(postId))) {
      deletedPosts.push(String(postId));
      saveToStorage('usof_deleted_posts', deletedPosts);
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`/api/posts/${postId}`, { headers });
    } catch {
      // Saved in usof_deleted_posts
    }
    return postId;
  }
);

export const createComment = createAsyncThunk(
  'posts/createComment',
  async (
    { postId, content, parentCommentId = null },
    { getState, rejectWithValue }
  ) => {
    const { token } = getState().auth;
    if (!token) {
      return rejectWithValue('Необхідна авторизація');
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(
        `/api/posts/${postId}/comments`,
        { content },
        { headers }
      );
      const commentsRes = await axios.get(`/api/posts/${postId}/comments`, {
        headers,
      });
      const rawServerComments = Array.isArray(commentsRes.data)
        ? commentsRes.data
        : [];
      const newId =
        response.data?.commentId ||
        response.data?.id ||
        rawServerComments[rawServerComments.length - 1]?.id;

      return {
        postId,
        serverComments: applyCommentsState(rawServerComments),
        newCommentId: newId,
        parentCommentId,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || 'Помилка додавання коментаря'
      );
    }
  }
);

export const updateComment = createAsyncThunk(
  'posts/updateComment',
  async (
    { postId, commentId, content, status },
    { getState, rejectWithValue }
  ) => {
    const { token } = getState().auth;
    if (!token) {
      return rejectWithValue('Необхідна авторизація');
    }

    const existingComment = getState().posts.currentPostComments.find(
      (c) => String(c.id) === String(commentId)
    );
    const finalContent =
      content !== undefined ? content : existingComment?.content || '';
    const finalStatus =
      status !== undefined ? status : existingComment?.status || 'active';

    const overrides = loadFromStorage('usof_comment_overrides', {});
    overrides[String(commentId)] = {
      content: finalContent,
      status: finalStatus,
    };
    saveToStorage('usof_comment_overrides', overrides);

    const headers = { Authorization: `Bearer ${token}` };
    try {
      await axios.patch(
        `/api/comments/${commentId}`,
        status !== undefined && content === undefined
          ? { status: finalStatus }
          : { content: finalContent, status: finalStatus },
        { headers }
      );
    } catch {
      try {
        await axios.patch(
          `/api/comments/${commentId}`,
          { content: finalContent, status: finalStatus },
          { headers }
        );
      } catch {
        // Saved in usof_comment_overrides
      }
    }

    return {
      postId,
      commentId,
      content: finalContent,
      status: finalStatus,
    };
  }
);

export const deleteComment = createAsyncThunk(
  'posts/deleteComment',
  async ({ postId, commentId }, { getState, rejectWithValue }) => {
    const { token } = getState().auth;
    if (!token) {
      return rejectWithValue('Необхідна авторизація');
    }

    const deletedIds = loadFromStorage('usof_deleted_comments', []);
    if (!deletedIds.includes(String(commentId))) {
      deletedIds.push(String(commentId));
      saveToStorage('usof_deleted_comments', deletedIds);
    }

    try {
      await axios.delete(`/api/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Saved in usof_deleted_comments
    }

    return { postId, commentId };
  }
);

export const votePost = createAsyncThunk(
  'posts/votePost',
  async ({ postId, type }, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token) {
      return rejectWithValue('Необхідна авторизація');
    }

    const currentUserId = user?.id || user?.userId;
    const currentVote = getState().posts.userVotes[postId] || null;
    const nextVote = currentVote === type ? null : type;

    try {
      const headers = { Authorization: `Bearer ${token}` };
      if (currentVote === type) {
        await axios.delete(`/api/posts/${postId}/like`, { headers });
      } else {
        if (currentVote) {
          try {
            await axios.delete(`/api/posts/${postId}/like`, { headers });
          } catch {
            // Ignore
          }
        }
        await axios.post(`/api/posts/${postId}/like`, { type }, { headers });
      }

      const likesRes = await axios.get(`/api/posts/${postId}/like`, {
        headers,
      });
      const parsed = parseLikesResponse(likesRes.data, currentUserId);

      return {
        postId,
        nextVote,
        serverScore: parsed.score,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || 'Помилка голосування'
      );
    }
  }
);

export const voteComment = createAsyncThunk(
  'posts/voteComment',
  async ({ commentId, type }, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token) {
      return rejectWithValue('Необхідна авторизація');
    }

    const currentUserId = user?.id || user?.userId;
    const currentVote = getState().posts.commentVotes[commentId] || null;
    const nextVote = currentVote === type ? null : type;

    try {
      const headers = { Authorization: `Bearer ${token}` };
      if (currentVote === type) {
        await axios.delete(`/api/comments/${commentId}/like`, { headers });
      } else {
        if (currentVote) {
          try {
            await axios.delete(`/api/comments/${commentId}/like`, { headers });
          } catch {
            // Ignore
          }
        }
        await axios.post(
          `/api/comments/${commentId}/like`,
          { type },
          { headers }
        );
      }

      const likesRes = await axios.get(`/api/comments/${commentId}/like`, {
        headers,
      });
      const parsed = parseLikesResponse(likesRes.data, currentUserId);

      return {
        commentId,
        nextVote,
        serverScore: parsed.score,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || 'Помилка оцінювання коментаря'
      );
    }
  }
);

const postsSlice = createSlice({
  name: 'posts',
  initialState: {
    items: [],
    categoryOverrides: loadFromStorage('usof_post_cat_overrides', {}),
    categories: [],
    previewCommentsByPost: {},
    previewCategoriesByPost: {},
    postLikesMap: {},
    commentLikesMap: {},
    postVoteFromServer: {},
    commentVoteFromServer: {},
    status: 'idle',
    error: null,
    page: 1,
    limit: 10,
    totalPages: 1,
    paginationMode: 'pages',
    // Пункт 1 PDF: по умолчанию посты отсортированы по убывающей дате добавления
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
    userVotes: loadFromStorage('usof_user_votes', {}),
    commentVotes: loadFromStorage('usof_comment_votes', {}),
    postReactions: loadFromStorage('usof_post_reactions', {}),
    commentReactions: loadFromStorage('usof_comment_reactions', {}),
    savedPosts: loadFromStorage('usof_saved_posts', {}),
    commentParents: loadFromStorage('usof_comment_parents', {}),
    siteStats: initSiteStats(),
  },
  reducers: {
    showNotification: (state, action) => {
      state.notification = {
        id: Date.now(),
        message: action.payload?.message || action.payload,
        type: action.payload?.type || 'success',
      };
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
      const postId = action.payload;
      state.selectedPostId = postId;

      state.siteStats.totalPostViews =
        (state.siteStats.totalPostViews || 0) + 1;
      state.siteStats.postViewsById = {
        ...state.siteStats.postViewsById,
        [postId]: (state.siteStats.postViewsById?.[postId] || 0) + 1,
      };
      saveToStorage('usof_site_stats', state.siteStats);
    },
    closePostPage: (state) => {
      state.selectedPostId = null;
      state.currentPost = null;
      state.currentPostCategories = [];
      state.currentPostComments = [];
      state.postDetailsStatus = 'idle';
      state.postDetailsError = null;
      state.highlightedCommentId = null;
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
      state.order = action.payload;
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
      state.limit = Number(action.payload);
      state.page = 1;
    },
    toggleReaction: (state, action) => {
      const { postId, reactionId } = action.payload;
      const existing = state.postReactions[postId] || {
        counts: {},
        userSelected: [],
      };

      const isSelected = existing.userSelected.includes(reactionId);
      const currentCount = existing.counts[reactionId] || 0;

      const updatedCounts = {
        ...existing.counts,
        [reactionId]: isSelected
          ? Math.max(0, currentCount - 1)
          : currentCount + 1,
      };

      const updatedSelected = isSelected
        ? existing.userSelected.filter((id) => id !== reactionId)
        : [...existing.userSelected, reactionId];

      state.postReactions[postId] = {
        counts: updatedCounts,
        userSelected: updatedSelected,
      };

      saveToStorage('usof_post_reactions', state.postReactions);
    },
    toggleCommentReaction: (state, action) => {
      const { commentId, reactionId } = action.payload;
      const existing = state.commentReactions[commentId] || {
        counts: {},
        userSelected: [],
      };

      const isSelected = existing.userSelected.includes(reactionId);
      const currentCount = existing.counts[reactionId] || 0;

      const updatedCounts = {
        ...existing.counts,
        [reactionId]: isSelected
          ? Math.max(0, currentCount - 1)
          : currentCount + 1,
      };

      const updatedSelected = isSelected
        ? existing.userSelected.filter((id) => id !== reactionId)
        : [...existing.userSelected, reactionId];

      state.commentReactions[commentId] = {
        counts: updatedCounts,
        userSelected: updatedSelected,
      };

      saveToStorage('usof_comment_reactions', state.commentReactions);
    },
    toggleSavePost: (state, action) => {
      const post = action.payload;
      if (!post || !post.id) return;

      if (state.savedPosts[post.id]) {
        delete state.savedPosts[post.id];
      } else {
        state.savedPosts[post.id] = post;
      }

      saveToStorage('usof_saved_posts', state.savedPosts);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPosts.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const { data: payload, append } = action.payload;
        let fetchedItems = [];

        if (Array.isArray(payload)) {
          fetchedItems = payload;
        } else if (payload && Array.isArray(payload.posts)) {
          fetchedItems = payload.posts;
          state.totalPages = payload.totalPages || payload.pages || 1;
        } else if (payload && Array.isArray(payload.data)) {
          fetchedItems = payload.data;
          state.totalPages = payload.totalPages || 1;
        }

        const deletedPosts = loadFromStorage('usof_deleted_posts', []);
        const mappedServer = fetchedItems
          .filter((p) => p && !deletedPosts.includes(String(p.id)))
          .map((p) => applyPostState(p, state.categoryOverrides));

        if (append && state.page > 1) {
          const existingIds = new Set(state.items.map((p) => String(p.id)));
          const uniqueNew = mappedServer.filter(
            (p) => !existingIds.has(String(p.id))
          );
          state.items = [...state.items, ...uniqueNew];
        } else {
          state.items = mappedServer;
        }
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        const payload = action.payload;
        if (Array.isArray(payload)) {
          state.categories = payload;
        } else if (payload && Array.isArray(payload.categories)) {
          state.categories = payload.categories;
        } else if (payload && Array.isArray(payload.data)) {
          state.categories = payload.data;
        }
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        const newCat = action.payload;
        state.categories.push(newCat);
        state.notification = {
          id: Date.now(),
          message: `Категорію «${newCat.title}» успішно створено!`,
          type: 'success',
        };
      })
      .addCase(createCategory.rejected, (state, action) => {
        state.notification = {
          id: Date.now(),
          message: action.payload || 'Помилка створення категорії',
          type: 'error',
        };
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        const { categoryId, title, description } = action.payload;
        state.categories = state.categories.map((c) =>
          String(c.id) === String(categoryId)
            ? { ...c, title, description }
            : c
        );
        state.notification = {
          id: Date.now(),
          message: `Категорію «${title}» успішно оновлено!`,
          type: 'success',
        };
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        const catId = action.payload;
        state.categories = state.categories.filter(
          (c) => String(c.id) !== String(catId)
        );
        if (String(state.categoryId) === String(catId)) {
          state.categoryId = null;
        }
        state.notification = {
          id: Date.now(),
          message: 'Категорію успішно видалено!',
          type: 'success',
        };
      })
      .addCase(fetchPostPreviewComments.fulfilled, (state, action) => {
        const { postId, comments, categories, likesScore, myVote } =
          action.payload;
        state.previewCommentsByPost[postId] = comments;

        if (state.categoryOverrides[postId]) {
          state.previewCategoriesByPost[postId] =
            state.categoryOverrides[postId];
        } else {
          state.previewCategoriesByPost[postId] = Array.isArray(categories)
            ? categories
            : [];
        }

        if (likesScore !== null && likesScore !== undefined) {
          state.postLikesMap[postId] = likesScore;
          state.postVoteFromServer[postId] = true;
          if (myVote) {
            state.userVotes[postId] = myVote;
          } else {
            delete state.userVotes[postId];
          }
          saveToStorage('usof_user_votes', state.userVotes);
        }
      })
      .addCase(fetchPostDetails.pending, (state) => {
        state.postDetailsStatus = 'loading';
        state.postDetailsError = null;
      })
      .addCase(fetchPostDetails.fulfilled, (state, action) => {
        state.postDetailsStatus = 'succeeded';
        const rawPost = action.payload.post;
        const post = applyPostState(rawPost, state.categoryOverrides);
        const postId = post?.id;
        state.currentPost = post;
        state.currentPostCategories =
          state.categoryOverrides[postId] ||
          post?.categories ||
          action.payload.categories;
        state.currentPostComments = action.payload.comments;
        if (postId) {
          state.previewCommentsByPost[postId] = action.payload.comments;
        }

        if (
          action.payload.postLikesScore !== null &&
          action.payload.postLikesScore !== undefined &&
          postId
        ) {
          state.postLikesMap[postId] = action.payload.postLikesScore;
          state.postVoteFromServer[postId] = true;
          if (action.payload.myPostVote) {
            state.userVotes[postId] = action.payload.myPostVote;
          } else {
            delete state.userVotes[postId];
          }
          saveToStorage('usof_user_votes', state.userVotes);
        }

        if (action.payload.commentLikesScores) {
          state.commentLikesMap = {
            ...state.commentLikesMap,
            ...action.payload.commentLikesScores,
          };
          Object.keys(action.payload.commentLikesScores).forEach((cid) => {
            state.commentVoteFromServer[cid] = true;
          });
        }
        if (action.payload.commentMyVotes) {
          state.commentVotes = {
            ...state.commentVotes,
            ...action.payload.commentMyVotes,
          };
          saveToStorage('usof_comment_votes', state.commentVotes);
        }
      })
      .addCase(fetchPostDetails.rejected, (state, action) => {
        state.postDetailsStatus = 'failed';
        state.postDetailsError = action.payload;
      })
      .addCase(silentFetchPostDetails.fulfilled, (state, action) => {
        if (!action.payload || !action.payload.post) return;
        const post = applyPostState(
          action.payload.post,
          state.categoryOverrides
        );
        const postId = post.id;
        if (String(state.selectedPostId) !== String(postId)) return;

        state.currentPost = {
          ...state.currentPost,
          ...post,
        };
        state.currentPostComments = action.payload.comments;
        state.previewCommentsByPost[postId] = action.payload.comments;

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
            state.items = state.items.map((item) =>
              String(item.id) === String(pid)
                ? { ...item, comments_count: comments.length }
                : item
            );
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
            state.categoryOverrides[createdPost.id] = createdPost.categories;
            saveToStorage('usof_post_cat_overrides', state.categoryOverrides);
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
        state.notification = {
          id: Date.now(),
          message: 'Питання успішно опубліковано!',
          type: 'success',
        };
      })
      .addCase(createNewPost.rejected, (state, action) => {
        state.isAskModalOpen = false;
        state.editingPost = null;
        state.notification = {
          id: Date.now(),
          message: action.payload || 'Помилка створення питання',
          type: 'error',
        };
      })
      .addCase(updateExistingPost.fulfilled, (state, action) => {
        const { postId, title, content, status, categories } = action.payload;

        if (categories && categories.length > 0) {
          state.previewCategoriesByPost[postId] = categories;
          state.categoryOverrides[postId] = categories;
          saveToStorage('usof_post_cat_overrides', state.categoryOverrides);
        }

        const updateItem = (item) => {
          if (String(item.id) !== String(postId)) return item;
          return {
            ...item,
            title: title ?? item.title,
            content: content ?? item.content,
            status: status ?? item.status,
            categories: categories ?? item.categories,
          };
        };

        state.items = state.items.map(updateItem);

        if (
          state.currentPost &&
          String(state.currentPost.id) === String(postId)
        ) {
          state.currentPost = updateItem(state.currentPost);
          if (categories && categories.length > 0) {
            state.currentPostCategories = categories;
          }
        }

        if (state.savedPosts[postId]) {
          state.savedPosts[postId] = updateItem(state.savedPosts[postId]);
          saveToStorage('usof_saved_posts', state.savedPosts);
        }

        state.isAskModalOpen = false;
        state.editingPost = null;
        state.notification = {
          id: Date.now(),
          message: 'Питання успішно відредаговано та збережено!',
          type: 'success',
        };
      })
      .addCase(updateExistingPost.rejected, (state, action) => {
        state.notification = {
          id: Date.now(),
          message: action.payload || 'Помилка редагування питання',
          type: 'error',
        };
      })
      .addCase(deleteExistingPost.fulfilled, (state, action) => {
        const postId = String(action.payload);
        state.items = state.items.filter((p) => String(p.id) !== postId);

        if (state.savedPosts[postId]) {
          delete state.savedPosts[postId];
          saveToStorage('usof_saved_posts', state.savedPosts);
        }

        if (String(state.selectedPostId) === postId) {
          state.selectedPostId = null;
          state.currentPost = null;
        }

        state.notification = {
          id: Date.now(),
          message: 'Питання успішно видалено!',
          type: 'success',
        };
      })
      .addCase(createComment.fulfilled, (state, action) => {
        const { postId, serverComments, newCommentId, parentCommentId } =
          action.payload;

        if (parentCommentId && newCommentId) {
          state.commentParents[newCommentId] = parentCommentId;
          saveToStorage('usof_comment_parents', state.commentParents);
        }

        if (serverComments) {
          state.currentPostComments = serverComments;
          state.previewCommentsByPost[postId] = serverComments;
          state.items = state.items.map((item) =>
            String(item.id) === String(postId)
              ? { ...item, comments_count: serverComments.length }
              : item
          );
        }

        state.notification = {
          id: Date.now(),
          message: 'Відповідь успішно додано!',
          type: 'success',
        };
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
        state.notification = {
          id: Date.now(),
          message: 'Коментар успішно оновлено!',
          type: 'success',
        };
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

        const remainingCount = state.currentPostComments.length;
        state.items = state.items.map((item) =>
          String(item.id) === String(postId)
            ? { ...item, comments_count: remainingCount }
            : item
        );

        state.notification = {
          id: Date.now(),
          message: 'Коментар успішно видалено!',
          type: 'success',
        };
      })
      .addCase(votePost.fulfilled, (state, action) => {
        const { postId, nextVote, serverScore } = action.payload;
        if (nextVote === null) {
          delete state.userVotes[postId];
        } else {
          state.userVotes[postId] = nextVote;
        }
        saveToStorage('usof_user_votes', state.userVotes);

        if (serverScore !== null && serverScore !== undefined) {
          state.postLikesMap[postId] = serverScore;
          state.postVoteFromServer[postId] = true;
        }
      })
      .addCase(voteComment.fulfilled, (state, action) => {
        const { commentId, nextVote, serverScore } = action.payload;
        if (nextVote === null) {
          delete state.commentVotes[commentId];
        } else {
          state.commentVotes[commentId] = nextVote;
        }
        saveToStorage('usof_comment_votes', state.commentVotes);

        if (serverScore !== null && serverScore !== undefined) {
          state.commentLikesMap[commentId] = serverScore;
          state.commentVoteFromServer[commentId] = true;
        }
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