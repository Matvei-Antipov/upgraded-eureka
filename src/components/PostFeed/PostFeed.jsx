import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchPosts,
  fetchPostPreviewComments,
  openAskModal,
  openPostPage,
  setViewMode,
  setSortBy,
  setCategoryId,
  setOrder,
  setStatusFilter,
  setStartDate,
  setEndDate,
  clearDateFilter,
  setPage,
  setLimit,
  setPaginationMode,
  votePost,
  toggleReaction,
  toggleSavePost,
  showNotification,
  REACTION_TYPES,
} from '../../store/postsSlice';
import {
  openAuthModal,
  fetchAllUsers,
  fetchUserById,
  openUserProfile,
} from '../../store/authSlice';
import { translations } from '../../i18n/translations';
import './PostFeed.css';

const PostFeed = () => {
  const dispatch = useDispatch();
  const { user, language, usersMap } = useSelector((state) => state.auth);
  const {
    items: posts,
    categories,
    previewCommentsByPost,
    previewCategoriesByPost,
    postLikesMap,
    postVoteFromServer,
    commentLikesMap,
    commentVoteFromServer,
    status: postStatus,
    error,
    page,
    limit,
    paginationMode,
    sortBy,
    order,
    categoryId,
    statusFilter,
    startDate,
    endDate,
    searchQuery,
    viewMode,
    userVotes,
    commentVotes,
    postReactions,
    savedPosts,
    siteStats,
  } = useSelector((state) => state.posts);

  const t = translations[language] || translations.uk;
  const isAdmin = user?.role === 'admin';

  const [activeSharePostId, setActiveSharePostId] = useState(null);
  const [activeReactionPickerPostId, setActiveReactionPickerPostId] =
    useState(null);
  const [customPageInput, setCustomPageInput] = useState('1');
  const [infiniteVisibleCount, setInfiniteVisibleCount] = useState(3);

  const shareMenuRef = useRef(null);
  const reactionMenuRef = useRef(null);
  const requestedUserIdsRef = useRef(new Set());

  useEffect(() => {
    if (!isAdmin && statusFilter !== 'active') {
      dispatch(setStatusFilter('active'));
    }
  }, [isAdmin, statusFilter, dispatch]);

  useEffect(() => {
    dispatch(fetchAllUsers());
  }, [dispatch]);

  useEffect(() => {
    posts.forEach((post) => {
      const aid = post.author_id || post.user_id;
      if (aid && !usersMap[aid] && !requestedUserIdsRef.current.has(aid)) {
        requestedUserIdsRef.current.add(aid);
        dispatch(fetchUserById(aid));
      }
      const previewComments = previewCommentsByPost[post.id];
      if (Array.isArray(previewComments)) {
        previewComments.forEach((c) => {
          const cAid = c.author_id || c.user_id;
          if (
            cAid &&
            !usersMap[cAid] &&
            !requestedUserIdsRef.current.has(cAid)
          ) {
            requestedUserIdsRef.current.add(cAid);
            dispatch(fetchUserById(cAid));
          }
        });
      }
    });
  }, [dispatch, posts, previewCommentsByPost, usersMap]);

  useEffect(() => {
    dispatch(fetchPosts(false));
  }, [dispatch, statusFilter]);

  useEffect(() => {
    setCustomPageInput(String(page));
  }, [page]);

  useEffect(() => {
    if (paginationMode === 'infinite') {
      setInfiniteVisibleCount(3);
    }
  }, [paginationMode, categoryId, viewMode, sortBy, order]);

  // Завантажуємо категорії, лайки та коментарі для всіх постів
  useEffect(() => {
    posts.forEach((post) => {
      if (
        post.id &&
        (previewCommentsByPost[post.id] === undefined ||
          previewCategoriesByPost[post.id] === undefined)
      ) {
        dispatch(fetchPostPreviewComments(post.id));
      }
    });
  }, [dispatch, posts, previewCommentsByPost, previewCategoriesByPost]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        shareMenuRef.current &&
        !shareMenuRef.current.contains(event.target)
      ) {
        setActiveSharePostId(null);
      }
      if (
        reactionMenuRef.current &&
        !reactionMenuRef.current.contains(event.target)
      ) {
        setActiveReactionPickerPostId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const requireAuth = () => {
    if (!user) {
      dispatch(showNotification({ message: t.authRequiredToast }));
      dispatch(openAuthModal('login'));
      return false;
    }
    return true;
  };

  const handleOpenAuthorProfile = (post) => {
    const authorId = post.author_id || post.user_id || post.author?.id;
    const mappedUser = authorId ? usersMap[authorId] : null;
    if (authorId) {
      dispatch(fetchUserById(authorId));
    }
    dispatch(
      openUserProfile(
        mappedUser || {
          id: authorId || 0,
          login:
            post.author?.login ||
            post.author_login ||
            `${t.userPrefix} #${authorId || 1}`,
          full_name: post.author?.full_name || post.author_name || '',
          role: 'user',
        }
      )
    );
  };

  const getPostRatingDelta = useCallback(
    (postId) => {
      const vote = userVotes[postId];
      let voteDelta = 0;
      if (!postVoteFromServer[postId]) {
        if (vote === 'like') voteDelta = 1;
        if (vote === 'dislike') voteDelta = -1;
      }

      const reactionsData = postReactions[postId]?.counts || {};
      const reactionsDelta = REACTION_TYPES.reduce((sum, r) => {
        const count = reactionsData[r.id] || 0;
        return sum + count * r.weight;
      }, 0);

      return {
        voteDelta,
        reactionsDelta,
        totalDelta: voteDelta + reactionsDelta,
      };
    },
    [userVotes, postVoteFromServer, postReactions]
  );

  const getPostEffectiveScore = useCallback(
    (post) => {
      const baseLikes = Number(
        postLikesMap[post.id] ??
          post.likes_count ??
          post.likesCount ??
          post.rating ??
          0
      );
      const { totalDelta } = getPostRatingDelta(post.id);
      return baseLikes + totalDelta;
    },
    [postLikesMap, getPostRatingDelta]
  );

  const getVisiblePreviewComments = useCallback(
    (postId) => {
      const rawList = previewCommentsByPost[postId];
      if (!Array.isArray(rawList)) return undefined;
      if (isAdmin) return rawList;
      return rawList.filter((c) => c.status !== 'inactive');
    },
    [previewCommentsByPost, isAdmin]
  );

  const getMostLikedComment = (postId) => {
    const list = getVisiblePreviewComments(postId) || [];
    if (list.length === 0) return null;

    let best = list[0];
    let bestScore = -Infinity;

    list.forEach((c) => {
      const base = Number(
        commentLikesMap[c.id] ?? c.likes_count ?? c.likesCount ?? c.rating ?? 0
      );
      const v = commentVotes[c.id];
      const delta = commentVoteFromServer[c.id]
        ? 0
        : v === 'like'
        ? 1
        : v === 'dislike'
        ? -1
        : 0;
      const score = base + delta;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    });

    return { comment: best, score: bestScore };
  };

  const sourcePosts = useMemo(() => {
    if (viewMode === 'saved') {
      return Object.values(savedPosts || {});
    }
    return posts;
  }, [viewMode, posts, savedPosts]);

  const authorRatingsMap = useMemo(() => {
    const map = {};
    sourcePosts.forEach((post) => {
      if (!isAdmin && post.status === 'inactive') return;

      const authorKey =
        post.author_id ||
        post.user_id ||
        post.author?.login ||
        post.author_login ||
        'unknown';

      const effectivePostScore = getPostEffectiveScore(post);

      const initialAuthorRating = Number(
        usersMap[post.author_id]?.rating ?? post.author?.rating ?? 0
      );
      if (map[authorKey] === undefined) {
        map[authorKey] = initialAuthorRating;
      }
      map[authorKey] = Math.max(map[authorKey], effectivePostScore);
    });
    return map;
  }, [sourcePosts, isAdmin, getPostEffectiveScore, usersMap]);

  const selectedCategoryObj = useMemo(
    () => categories.find((c) => Number(c.id) === Number(categoryId)),
    [categories, categoryId]
  );

  const filteredPosts = useMemo(() => {
    const filtered = sourcePosts.filter((post) => {
      if (!isAdmin && post.status === 'inactive') {
        return false;
      }
      if (
        isAdmin &&
        statusFilter === 'active' &&
        post.status === 'inactive' &&
        viewMode !== 'saved'
      ) {
        return false;
      }
      if (
        isAdmin &&
        statusFilter === 'inactive' &&
        post.status !== 'inactive' &&
        viewMode !== 'saved'
      ) {
        return false;
      }

      // Сувора фільтрація за обраною категорією
      if (categoryId && viewMode !== 'saved') {
        const postCats =
          previewCategoriesByPost[post.id] !== undefined
            ? previewCategoriesByPost[post.id]
            : Array.isArray(post.categories)
            ? post.categories
            : [];

        const targetCatTitle = (
          selectedCategoryObj?.title ||
          selectedCategoryObj?.name ||
          ''
        )
          .trim()
          .toLowerCase();

        const matchesCat = postCats.some((cat) => {
          if (typeof cat === 'object' && cat !== null) {
            if (Number(cat.id) === Number(categoryId)) return true;
            const cTitle = (cat.title || cat.name || '').trim().toLowerCase();
            return Boolean(targetCatTitle && cTitle === targetCatTitle);
          }
          if (Number(cat) === Number(categoryId)) return true;
          return Boolean(
            targetCatTitle && String(cat).trim().toLowerCase() === targetCatTitle
          );
        });

        if (!matchesCat) return false;
      }

      // Фільтрація за датою публікації (Від — До)
      if ((startDate || endDate) && viewMode !== 'saved') {
        const rawDate =
          post.publish_date ||
          post.publishDate ||
          post.created_at ||
          post.createdAt;
        if (rawDate) {
          const postTime = new Date(rawDate).getTime();
          if (!Number.isNaN(postTime)) {
            if (startDate) {
              const startTime = new Date(`${startDate}T00:00:00`).getTime();
              if (postTime < startTime) return false;
            }
            if (endDate) {
              const endTime = new Date(`${endDate}T23:59:59`).getTime();
              if (postTime > endTime) return false;
            }
          }
        }
      }

      const visibleComments = getVisiblePreviewComments(post.id);
      const commentsCount = Number(
        visibleComments !== undefined
          ? visibleComments.length
          : post.comments_count ?? post.commentsCount ?? 0
      );

      if (viewMode === 'unanswered' && commentsCount > 0) {
        return false;
      }

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const titleMatch = post.title?.toLowerCase().includes(query);
      const contentMatch = post.content?.toLowerCase().includes(query);
      return titleMatch || contentMatch;
    });

    const getPostTimestamp = (p) => {
      const raw =
        p.publish_date || p.publishDate || p.created_at || p.createdAt;
      const parsed = raw ? new Date(raw).getTime() : 0;
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const sorted = [...filtered].sort((a, b) => {
      // 1. Сортування за датою додавання (DESC = найновіші перші, ASC = найстаріші перші)
      if (sortBy === 'date') {
        const timeA = getPostTimestamp(a);
        const timeB = getPostTimestamp(b);
        if (timeA !== timeB) {
          return order === 'ASC' ? timeA - timeB : timeB - timeA;
        }
        return order === 'ASC'
          ? Number(a.id || 0) - Number(b.id || 0)
          : Number(b.id || 0) - Number(a.id || 0);
      }

      // 2. Сортування за кількістю вподобайок (DESC = спадна, ASC = висхідна)
      const scoreA = getPostEffectiveScore(a);
      const scoreB = getPostEffectiveScore(b);
      if (scoreA !== scoreB) {
        return order === 'ASC' ? scoreA - scoreB : scoreB - scoreA;
      }

      const timeA = getPostTimestamp(a);
      const timeB = getPostTimestamp(b);
      return timeB - timeA;
    });

    return sorted;
  }, [
    sourcePosts,
    isAdmin,
    statusFilter,
    viewMode,
    categoryId,
    selectedCategoryObj,
    previewCategoriesByPost,
    startDate,
    endDate,
    getVisiblePreviewComments,
    searchQuery,
    sortBy,
    order,
    getPostEffectiveScore,
  ]);

  const computedTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredPosts.length / limit)),
    [filteredPosts.length, limit]
  );

  const displayedPosts = useMemo(() => {
    if (viewMode === 'saved') {
      return filteredPosts;
    }
    if (paginationMode === 'infinite') {
      return filteredPosts.slice(0, infiniteVisibleCount);
    }
    const startIndex = (page - 1) * limit;
    return filteredPosts.slice(startIndex, startIndex + limit);
  }, [filteredPosts, viewMode, paginationMode, infiniteVisibleCount, page, limit]);

  const handleLoadMoreClick = () => {
    if (infiniteVisibleCount < filteredPosts.length) {
      setInfiniteVisibleCount((prev) => prev + 3);
    } else {
      dispatch(showNotification({ message: t.allQuestionsLoadedToast }));
    }
  };

  if (viewMode === 'stats') {
    const totalReactionsGiven = Object.values(postReactions || {}).reduce(
      (acc, item) =>
        acc +
        Object.values(item.counts || {}).reduce(
          (s, c) => s + Number(c || 0),
          0
        ),
      0
    );

    return (
      <section className="post-feed">
        <div className="feed-header">
          <div>
            <h1 className="feed-title">{t.statsTitle}</h1>
            <p className="feed-subtitle">{t.statsSubtitle}</p>
          </div>
          <button
            type="button"
            className="ask-btn"
            onClick={() => dispatch(setViewMode('all'))}
          >
            {t.backToQuestions}
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">{t.statVisits}</span>
            <span className="stat-value">{siteStats.totalVisits || 1}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t.statViews}</span>
            <span className="stat-value">{siteStats.totalPostViews || 0}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t.statPosts}</span>
            <span className="stat-value">{filteredPosts.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t.statCategories}</span>
            <span className="stat-value">{categories.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t.statReactions}</span>
            <span className="stat-value">
              {totalReactionsGiven + Object.keys(userVotes || {}).length}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t.statSaved}</span>
            <span className="stat-value">
              {Object.keys(savedPosts || {}).length}
            </span>
          </div>
        </div>
      </section>
    );
  }

  const handleVote = async (post, type) => {
    if (!requireAuth()) return;
    await dispatch(votePost({ postId: post.id, type }));
  };

  const handleReactionSelect = (postId, reactionObj) => {
    if (!requireAuth()) return;
    dispatch(toggleReaction({ postId, reactionId: reactionObj.id }));
    setActiveReactionPickerPostId(null);
  };

  const handleToggleBookmark = (post) => {
    dispatch(toggleSavePost(post));
  };

  const getPostShareUrl = (postId) => {
    return `${window.location.origin}/posts/${postId}`;
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback
    }
    dispatch(
      showNotification({
        message:
          language === 'en'
            ? 'Link copied to clipboard!'
            : 'Посилання скопійовано!',
      })
    );
    setActiveSharePostId(null);
  };

  const handleSocialShare = (platform, post) => {
    const postUrl = getPostShareUrl(post.id);
    const encodedUrl = encodeURIComponent(postUrl);
    const encodedTitle = encodeURIComponent(post.title || 'USOF');

    let shareUrl = '';
    if (platform === 'facebook') {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`;
    } else if (platform === 'telegram') {
      shareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;
    } else if (platform === 'twitter') {
      shareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
    } else if (platform === 'instagram') {
      copyToClipboard(postUrl);
      return;
    }

    if (shareUrl) {
      window.open(
        shareUrl,
        '_blank',
        'noopener,noreferrer,width=600,height=500'
      );
      setActiveSharePostId(null);
    }
  };

  const formatPublishDate = (dateValue) => {
    if (!dateValue) return t.justNow;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return dateValue;
    return date.toLocaleDateString(language === 'en' ? 'en-US' : 'uk-UA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleGoToSpecificPage = (e) => {
    e.preventDefault();
    const num = parseInt(customPageInput, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= computedTotalPages) {
      dispatch(setPage(num));
    }
  };

  return (
    <section className="post-feed">
      <div className="feed-header">
        <div>
          <h1 className="feed-title">
            {viewMode === 'saved'
              ? t.savedQuestionsTitle
              : selectedCategoryObj
              ? `${t.selectedCategoryPrefix} ${
                  selectedCategoryObj.title || selectedCategoryObj.name
                }`
              : t.communityQuestions}
          </h1>
          <p className="feed-subtitle">
            {viewMode === 'saved'
              ? t.savedSubtitle
              : selectedCategoryObj?.description || t.communitySubtitle}
          </p>
        </div>
        <button
          type="button"
          className="ask-btn"
          onClick={() => {
            if (!requireAuth()) return;
            dispatch(openAskModal(null));
          }}
        >
          {t.askQuestionBtn}
        </button>
      </div>

      {selectedCategoryObj && viewMode !== 'saved' && (
        <div className="date-filter-bar category-banner">
          <span>
            <strong>
              {selectedCategoryObj.title || selectedCategoryObj.name}:
            </strong>{' '}
            {selectedCategoryObj.description || t.communitySubtitle}
          </span>
          <button
            type="button"
            className="clear-dates-btn"
            onClick={() => dispatch(setCategoryId(null))}
          >
            {t.resetCategoryBtn}
          </button>
        </div>
      )}

      <div className="feed-controls-bar">
        <div className="feed-tabs">
          <button
            type="button"
            className={`tab ${
              sortBy === 'date' &&
              viewMode !== 'unanswered' &&
              viewMode !== 'saved'
                ? 'active'
                : ''
            }`}
            onClick={() => {
              dispatch(setViewMode('all'));
              dispatch(setSortBy('date'));
              dispatch(setOrder('DESC'));
            }}
          >
            {t.tabAll}
          </button>
          <button
            type="button"
            className={`tab ${
              sortBy === 'likes' && viewMode !== 'saved' ? 'active' : ''
            }`}
            onClick={() => {
              if (sortBy === 'likes') {
                dispatch(setOrder(order === 'DESC' ? 'ASC' : 'DESC'));
              } else {
                dispatch(setSortBy('likes'));
                dispatch(setOrder('DESC'));
              }
            }}
          >
            {t.tabPopular}{' '}
            {sortBy === 'likes' ? (order === 'DESC' ? '↓' : '↑') : ''}
          </button>
          <button
            type="button"
            className={`tab ${viewMode === 'unanswered' ? 'active' : ''}`}
            onClick={() => dispatch(setViewMode('unanswered'))}
          >
            {t.tabUnanswered}
          </button>
          <button
            type="button"
            className={`tab ${viewMode === 'saved' ? 'active' : ''}`}
            onClick={() => dispatch(setViewMode('saved'))}
          >
            {t.tabSaved} ({Object.keys(savedPosts || {}).length})
          </button>
        </div>

        <div className="feed-filters">
          <label className="filter-label">
            {t.categoryFilterLabel}
            <select
              value={categoryId || ''}
              onChange={(e) =>
                dispatch(
                  setCategoryId(e.target.value ? Number(e.target.value) : null)
                )
              }
              className="filter-select"
            >
              <option value="">{t.allCategoriesOption}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.title || cat.name}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-label">
            {t.sortByLabel}
            <select
              value={sortBy}
              onChange={(e) => dispatch(setSortBy(e.target.value))}
              className="filter-select"
            >
              <option value="date">{t.sortByDate}</option>
              <option value="likes">{t.sortByLikes}</option>
            </select>
          </label>

          <label className="filter-label">
            {t.orderLabel}
            <select
              value={order}
              onChange={(e) => dispatch(setOrder(e.target.value))}
              className="filter-select"
            >
              <option value="DESC">
                {sortBy === 'likes' ? t.orderDescLikes : t.orderDescDate}
              </option>
              <option value="ASC">
                {sortBy === 'likes' ? t.orderAscLikes : t.orderAscDate}
              </option>
            </select>
          </label>

          {isAdmin && (
            <label className="filter-label">
              {t.statusLabel}
              <select
                value={statusFilter}
                onChange={(e) => dispatch(setStatusFilter(e.target.value))}
                className="filter-select"
              >
                <option value="active">{t.statusActive}</option>
                <option value="inactive">{t.statusInactive}</option>
              </select>
            </label>
          )}

          <label className="filter-label">
            {t.perPageLabel}
            <select
              value={limit}
              onChange={(e) => dispatch(setLimit(e.target.value))}
              className="filter-select"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </label>
        </div>
      </div>

      {viewMode !== 'saved' && (
        <div className="date-filter-bar">
          <span className="date-filter-title">{t.datePeriod}</span>
          <div className="date-inputs-group">
            <label className="date-label">
              {t.dateFrom}
              <input
                type="date"
                value={startDate}
                onChange={(e) => dispatch(setStartDate(e.target.value))}
                className="date-input"
              />
            </label>
            <label className="date-label">
              {t.dateTo}
              <input
                type="date"
                value={endDate}
                onChange={(e) => dispatch(setEndDate(e.target.value))}
                className="date-input"
              />
            </label>
            {(startDate || endDate) && (
              <button
                type="button"
                className="clear-dates-btn"
                onClick={() => dispatch(clearDateFilter())}
              >
                {t.clearDates}
              </button>
            )}
          </div>
        </div>
      )}

      {postStatus === 'loading' && posts.length === 0 && viewMode !== 'saved' && (
        <div className="feed-state-box">{t.loadingPosts}</div>
      )}

      {postStatus === 'failed' && viewMode !== 'saved' && (
        <div className="feed-state-box error">
          <p>
            {t.errorLoadingPosts} {error}
          </p>
          <button
            type="button"
            className="retry-btn"
            onClick={() => dispatch(fetchPosts())}
          >
            {t.retryBtn}
          </button>
        </div>
      )}

      {(postStatus === 'succeeded' || viewMode === 'saved') &&
        displayedPosts.length === 0 && (
          <div className="feed-state-box">
            {viewMode === 'saved' ? t.noSavedPosts : t.noPostsFound}
          </div>
        )}

      {(postStatus === 'succeeded' ||
        viewMode === 'saved' ||
        posts.length > 0) &&
        displayedPosts.length > 0 && (
          <div className="posts-list">
            {displayedPosts.map((post) => {
              const postAuthorId =
                post.author_id || post.user_id || post.author?.id;
              const mappedAuthor = usersMap[postAuthorId];
              const authorName =
                mappedAuthor?.login ||
                post.author?.login ||
                post.author_login ||
                post.author_name ||
                `${t.userPrefix} #${postAuthorId || 1}`;

              const authorKey =
                postAuthorId ||
                post.author?.login ||
                post.author_login ||
                'unknown';

              const publishDate = formatPublishDate(
                post.publish_date ||
                  post.publishDate ||
                  post.created_at ||
                  post.createdAt
              );

              const effectivePostScore = getPostEffectiveScore(post);
              const authorRating =
                authorRatingsMap[authorKey] ?? effectivePostScore;

              const currentVote = userVotes[post.id] || null;
              const postReactionState = postReactions[post.id] || {
                counts: {},
                userSelected: [],
              };

              const visibleComments = getVisiblePreviewComments(post.id);
              const commentsCount =
                visibleComments !== undefined
                  ? visibleComments.length
                  : post.comments_count ?? post.commentsCount ?? 0;

              const postCategories =
                previewCategoriesByPost[post.id] ||
                (Array.isArray(post.categories) ? post.categories : []);

              const bestCommentData = getMostLikedComment(post.id);
              const bestCommentAuthorId =
                bestCommentData?.comment?.author_id ||
                bestCommentData?.comment?.user_id;

              const isSaved = Boolean(savedPosts[post.id]);
              const isShareOpen = activeSharePostId === post.id;
              const isReactionPickerOpen =
                activeReactionPickerPostId === post.id;

              return (
                <article key={post.id} className="post-item">
                  <div className="post-top-row">
                    <h2
                      className="post-title"
                      onClick={() => dispatch(openPostPage(post.id))}
                    >
                      {post.title}
                    </h2>
                    {post.status && (
                      <span className={`post-status-badge ${post.status}`}>
                        {post.status === 'active'
                          ? t.badgeActive
                          : t.badgeInactive}
                      </span>
                    )}
                  </div>

                  <p
                    className="post-snippet"
                    onClick={() => dispatch(openPostPage(post.id))}
                    style={{ cursor: 'pointer' }}
                  >
                    {post.content}
                  </p>

                  {postCategories.length > 0 && (
                    <div className="post-categories">
                      {postCategories.map((cat, idx) => (
                        <span
                          key={cat.id || idx}
                          className="post-category-tag"
                          style={{ cursor: 'pointer' }}
                          title={cat.description || cat.title}
                          onClick={() => {
                            if (cat.id) dispatch(setCategoryId(cat.id));
                          }}
                        >
                          {typeof cat === 'string' ? cat : cat.title}
                        </span>
                      ))}
                    </div>
                  )}

                  {bestCommentData && (
                    <div
                      className="best-comment-preview"
                      onClick={() => dispatch(openPostPage(post.id))}
                    >
                      <div className="best-comment-header">
                        <span className="best-comment-badge">
                          {t.bestAnswerBadge}
                        </span>
                        <span className="best-comment-author">
                          {usersMap[bestCommentAuthorId]?.login ||
                            bestCommentData.comment.author?.login ||
                            bestCommentData.comment.author_login ||
                            `${t.userPrefix} #${bestCommentAuthorId || 1}`}
                        </span>
                        <span className="best-comment-likes">
                          ↑ {bestCommentData.score}
                        </span>
                      </div>
                      <p className="best-comment-text">
                        {bestCommentData.comment.content}
                      </p>
                    </div>
                  )}

                  <div className="post-meta">
                    <button
                      type="button"
                      className="post-author-link"
                      onClick={() => handleOpenAuthorProfile(post)}
                    >
                      {authorName}
                    </button>
                    <span
                      className={`author-rating-badge ${
                        authorRating > 0
                          ? 'positive'
                          : authorRating < 0
                          ? 'negative'
                          : ''
                      }`}
                    >
                      ★ {authorRating > 0 ? `+${authorRating}` : authorRating}
                    </span>

                    <span className="dot">•</span>
                    <span className="post-date-text">{publishDate}</span>

                    <div className="vote-pill" role="group">
                      <button
                        type="button"
                        className={`vote-btn upvote ${
                          currentVote === 'like' ? 'active' : ''
                        }`}
                        onClick={() => handleVote(post, 'like')}
                      >
                        ↑
                      </button>
                      <span
                        className={`vote-score ${
                          effectivePostScore > 0
                            ? 'positive'
                            : effectivePostScore < 0
                            ? 'negative'
                            : ''
                        }`}
                      >
                        {effectivePostScore}
                      </span>
                      <button
                        type="button"
                        className={`vote-btn downvote ${
                          currentVote === 'dislike' ? 'active' : ''
                        }`}
                        onClick={() => handleVote(post, 'dislike')}
                      >
                        ↓
                      </button>
                    </div>

                    <div className="reactions-bar">
                      {REACTION_TYPES.map((r) => {
                        const count = postReactionState.counts?.[r.id] || 0;
                        const isSelected =
                          postReactionState.userSelected?.includes(r.id);
                        if (count === 0 && !isSelected) return null;

                        return (
                          <button
                            key={r.id}
                            type="button"
                            className={`reaction-chip ${
                              isSelected ? 'active' : ''
                            }`}
                            onClick={() => handleReactionSelect(post.id, r)}
                          >
                            <span>{r.emoji}</span>
                            <span className="reaction-count">{count}</span>
                          </button>
                        );
                      })}

                      <div
                        className="reaction-picker-wrapper"
                        ref={isReactionPickerOpen ? reactionMenuRef : null}
                      >
                        <button
                          type="button"
                          className={`add-reaction-btn ${
                            isReactionPickerOpen ? 'active' : ''
                          }`}
                          onClick={() =>
                            setActiveReactionPickerPostId(
                              isReactionPickerOpen ? null : post.id
                            )
                          }
                        >
                          + 😊
                        </button>

                        {isReactionPickerOpen && (
                          <div className="reaction-popover">
                            {REACTION_TYPES.map((r) => {
                              const isSelected =
                                postReactionState.userSelected?.includes(r.id);
                              return (
                                <button
                                  key={r.id}
                                  type="button"
                                  className={`reaction-picker-item ${
                                    isSelected ? 'active' : ''
                                  }`}
                                  onClick={() =>
                                    handleReactionSelect(post.id, r)
                                  }
                                >
                                  <span className="reaction-emoji">
                                    {r.emoji}
                                  </span>
                                  <span className="reaction-name">
                                    {language === 'en' ? r.labelEn : r.label}
                                  </span>
                                  <span className="reaction-weight">
                                    +{r.weight}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="bookmark-btn"
                      onClick={() => dispatch(openPostPage(post.id))}
                    >
                      💬 {commentsCount} {t.answersCountLabel}
                    </button>

                    <button
                      type="button"
                      className={`bookmark-btn ${isSaved ? 'active' : ''}`}
                      onClick={() => handleToggleBookmark(post)}
                    >
                      <span>🔖</span>
                      <span>{isSaved ? t.savedBtn : t.saveBtn}</span>
                    </button>

                    <div
                      className="share-wrapper"
                      ref={isShareOpen ? shareMenuRef : null}
                    >
                      <button
                        type="button"
                        className={`share-btn ${isShareOpen ? 'active' : ''}`}
                        onClick={() =>
                          setActiveSharePostId(isShareOpen ? null : post.id)
                        }
                      >
                        <span className="share-icon">↗</span>
                        <span>{t.shareBtn}</span>
                      </button>

                      {isShareOpen && (
                        <div className="share-dropdown">
                          <button
                            type="button"
                            className="share-option"
                            onClick={() => handleSocialShare('facebook', post)}
                          >
                            <span>Facebook</span>
                          </button>
                          <button
                            type="button"
                            className="share-option"
                            onClick={() => handleSocialShare('instagram', post)}
                          >
                            <span>{t.instagramCopy}</span>
                          </button>
                          <button
                            type="button"
                            className="share-option"
                            onClick={() => handleSocialShare('telegram', post)}
                          >
                            <span>Telegram</span>
                          </button>
                          <button
                            type="button"
                            className="share-option"
                            onClick={() => handleSocialShare('twitter', post)}
                          >
                            <span>X (Twitter)</span>
                          </button>
                          <div className="share-divider" />
                          <button
                            type="button"
                            className="share-option copy-link"
                            onClick={() =>
                              copyToClipboard(getPostShareUrl(post.id))
                            }
                          >
                            <span>{t.copyLinkBtn}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

      {viewMode !== 'saved' && (
        <div className="pagination-wrapper">
          {paginationMode === 'pages' ? (
            <div className="pagination-bar">
              <button
                type="button"
                className="page-btn"
                disabled={page <= 1 || postStatus === 'loading'}
                onClick={() => dispatch(setPage(page - 1))}
              >
                {t.prevPage}
              </button>

              <form
                className="page-jump-form"
                onSubmit={handleGoToSpecificPage}
              >
                <span className="page-indicator">{t.pageWord}</span>
                <input
                  type="number"
                  min={1}
                  max={computedTotalPages}
                  value={customPageInput}
                  onChange={(e) => setCustomPageInput(e.target.value)}
                  className="page-number-input"
                  aria-label="Page number"
                />
                <span className="page-indicator">
                  {t.ofWord} {computedTotalPages}
                </span>
                <button type="submit" className="page-go-btn">
                  {t.goBtn}
                </button>
              </form>

              <button
                type="button"
                className="page-btn"
                disabled={postStatus === 'loading' || page >= computedTotalPages}
                onClick={() => dispatch(setPage(page + 1))}
              >
                {t.nextPage}
              </button>
            </div>
          ) : (
            <div className="pagination-bar">
              <button
                type="button"
                className="ask-btn"
                disabled={postStatus === 'loading'}
                onClick={handleLoadMoreClick}
              >
                {postStatus === 'loading' ? t.loadingMore : t.loadMoreBtn}
              </button>
            </div>
          )}

          <div className="pagination-mode-switch">
            <button
              type="button"
              className="mode-toggle-link"
              onClick={() =>
                dispatch(
                  setPaginationMode(
                    paginationMode === 'pages' ? 'infinite' : 'pages'
                  )
                )
              }
            >
              {t.navModeLabel}{' '}
              {paginationMode === 'pages' ? t.modePages : t.modeInfinite}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default PostFeed;