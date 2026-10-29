import React, { useEffect, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchPosts,
  fetchCategories,
  fetchCategoryById,
  fetchPostPreviewComments,
  setSortBy,
  setOrder,
  setCategoryId,
  setStatusFilter,
  setStartDate,
  setEndDate,
  clearDateFilter,
  setPage,
  setLimit,
  setPaginationMode,
  setViewMode,
  votePost,
  toggleReaction,
  toggleSavePost,
  openAskModal,
  openPostPage,
  showNotification,
  REACTION_TYPES,
} from '../../store/postsSlice';
import {
  openAuthModal,
  fetchUserById,
  openUserProfile,
} from '../../store/authSlice';
import { translations } from '../../i18n/translations';
import { PAGE_SIZE_OPTIONS } from '../../config';
import { avatarUrl, getInitials, formatDate } from '../../utils/format';
import { parseCommentContent } from '../../utils/comments';
import RichContent from '../RichContent/RichContent';
import './PostFeed.css';

const PostFeed = () => {
  const dispatch = useDispatch();
  const {
    items = [],
    categories = [],
    previewCommentsByPost = {},
    previewCategoriesByPost = {},
    postLikesMap = {},
    commentLikesMap = {},
    status,
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
    userVotes = {},
    postReactions = {},
    savedPostsByUser = {},
    siteStats = { visits: 1, postViews: 0 },
  } = useSelector((state) => state.posts);

  const { user, language = 'uk', usersMap = {} } = useSelector(
    (state) => state.auth
  );
  const t = translations[language] || translations.uk;
  const isAdmin = user?.role === 'admin';

  const [openReactionPostId, setOpenReactionPostId] = useState(null);
  const [openSharePostId, setOpenSharePostId] = useState(null);
  const [pageInput, setPageInput] = useState(page || 1);

  const bucketKey = String(user?.id || 'guest');
  const userSavedMap = useMemo(
    () => savedPostsByUser?.[bucketKey] || {},
    [savedPostsByUser, bucketKey]
  );

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  useEffect(() => {
    if (categoryId) {
      dispatch(fetchCategoryById(categoryId));
    }
  }, [categoryId, dispatch]);

  useEffect(() => {
    dispatch(fetchPosts());
  }, [
    dispatch,
    sortBy,
    order,
    categoryId,
    statusFilter,
    startDate,
    endDate,
    isAdmin,
  ]);

  useEffect(() => {
    setPageInput(page);
  }, [page]);

  const savedPostsArray = useMemo(
    () =>
      Object.values(userSavedMap).filter(
        (p) => p && typeof p === 'object' && p.id
      ),
    [userSavedMap]
  );

  const savedIdsSet = useMemo(
    () => new Set(Object.keys(userSavedMap).map((k) => Number(k))),
    [userSavedMap]
  );

  const savedCount = savedIdsSet.size;

  const displayedPosts = useMemo(() => {
    let source = viewMode === 'saved' ? savedPostsArray : items;

    source = source.filter((post) => {
      if (!post) return false;
      if (post.status === 'inactive') {
        const authorId = Number(post.author_id);
        return isAdmin || (user && Number(user.id) === authorId);
      }
      return true;
    });

    if (isAdmin && statusFilter && statusFilter !== 'all') {
      source = source.filter((p) => (p.status || 'active') === statusFilter);
    }

    if (categoryId && viewMode === 'saved') {
      source = source.filter((post) => {
        const cats =
          previewCategoriesByPost[post.id] ||
          (Array.isArray(post.categories) ? post.categories : []);
        return cats.some(
          (c) => Number(typeof c === 'object' ? c.id : c) === Number(categoryId)
        );
      });
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      source = source.filter(
        (p) =>
          String(p.title || '').toLowerCase().includes(q) ||
          String(p.content || '').toLowerCase().includes(q)
      );
    }

    if (startDate) {
      const startMs = new Date(`${startDate}T00:00:00`).getTime();
      source = source.filter((p) => {
        const d = new Date(p.publish_date || 0).getTime();
        return d >= startMs;
      });
    }

    if (endDate) {
      const endMs = new Date(`${endDate}T23:59:59.999`).getTime();
      source = source.filter((p) => {
        const d = new Date(p.publish_date || 0).getTime();
        return d <= endMs;
      });
    }

    if (viewMode === 'unanswered') {
      source = source.filter((p) => {
        const comments = previewCommentsByPost[p.id];
        if (Array.isArray(comments)) {
          return comments.length === 0;
        }
        return Number(p.comments_count || 0) === 0;
      });
    }

    const isAsc = String(order || 'DESC').toUpperCase() === 'ASC';
    const sorted = [...source].sort((a, b) => {
      if (sortBy === 'likes' || viewMode === 'popular') {
        const likesA = Number(postLikesMap[a.id] ?? a.likes_count ?? 0);
        const likesB = Number(postLikesMap[b.id] ?? b.likes_count ?? 0);
        if (likesA !== likesB) {
          return isAsc ? likesA - likesB : likesB - likesA;
        }
      }
      const dateA = new Date(a.publish_date || 0).getTime();
      const dateB = new Date(b.publish_date || 0).getTime();
      return isAsc ? dateA - dateB : dateB - dateA;
    });

    return sorted;
  }, [
    viewMode,
    savedPostsArray,
    items,
    user,
    isAdmin,
    statusFilter,
    categoryId,
    previewCategoriesByPost,
    searchQuery,
    startDate,
    endDate,
    previewCommentsByPost,
    sortBy,
    order,
    postLikesMap,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(displayedPosts.length / (Number(limit) || 10))
  );

  const safePage = Math.min(Math.max(1, page), totalPages);

  const paginatedPosts = useMemo(() => {
    const perPage = Number(limit) || 10;
    if (paginationMode === 'infinite') {
      return displayedPosts.slice(0, safePage * perPage);
    }
    const startIdx = (safePage - 1) * perPage;
    return displayedPosts.slice(startIdx, startIdx + perPage);
  }, [displayedPosts, paginationMode, safePage, limit]);

  useEffect(() => {
    const targets =
      viewMode === 'unanswered' ? displayedPosts.slice(0, 40) : paginatedPosts;
    targets.forEach((post) => {
      if (post?.id) {
        dispatch(fetchPostPreviewComments(post.id));
      }
      const authorId = post?.author_id;
      if (authorId) {
        dispatch(fetchUserById(authorId));
      }
    });
  }, [paginatedPosts, displayedPosts, viewMode, dispatch]);

  const handleAuthorClick = (e, post) => {
    e.stopPropagation();
    const authorId = post.author_id;
    const cachedUser = authorId ? usersMap[String(authorId)] : null;
    if (cachedUser && !cachedUser._notFound) {
      dispatch(openUserProfile(cachedUser));
    } else if (authorId) {
      dispatch(fetchUserById(authorId));
      dispatch(
        openUserProfile({
          id: authorId,
          login: post.author_login || `user_${authorId}`,
        })
      );
    }
  };

  const handleVote = (e, postId, voteType) => {
    e.stopPropagation();
    if (!user) {
      dispatch(openAuthModal('login'));
      return;
    }
    dispatch(votePost({ postId, type: voteType }));
  };

  const handleAskClick = () => {
    if (!user) {
      dispatch(openAuthModal('login'));
      return;
    }
    dispatch(openAskModal(null));
  };

  const handleShare = (e, post, platform) => {
    e.stopPropagation();
    const url = `${window.location.origin}/?post=${post.id}`;
    if (platform === 'copy' || platform === 'instagram') {
      navigator.clipboard?.writeText(url);
      dispatch(
        showNotification(
          platform === 'instagram' ? 'instagramCopiedToast' : 'linkCopiedToast'
        )
      );
    } else if (platform === 'telegram') {
      window.open(
        `https://t.me/share/url?url=${encodeURIComponent(
          url
        )}&text=${encodeURIComponent(post.title)}`,
        '_blank'
      );
    } else if (platform === 'facebook') {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
          url
        )}`,
        '_blank'
      );
    }
    setOpenSharePostId(null);
  };

  if (viewMode === 'stats') {
    const totalReactions = Object.values(postReactions || {}).reduce(
      (acc, entry) => {
        if (!entry) return acc;
        const countsObj = entry.counts || {};
        return (
          acc +
          Object.values(countsObj).reduce(
            (s, v) => s + (typeof v === 'number' ? v : 0),
            0
          )
        );
      },
      0
    );

    return (
      <section className="post-feed">
        <div className="stats-page-card">
          <div className="stats-header">
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
            <div className="stat-box">
              <span className="stat-value">
                {siteStats.visits || siteStats.totalVisits || 1}
              </span>
              <span className="stat-label">{t.statVisits}</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">
                {siteStats.postViews || siteStats.totalPostViews || 0}
              </span>
              <span className="stat-label">{t.statViews}</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{items.length}</span>
              <span className="stat-label">{t.statPosts}</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{categories.length}</span>
              <span className="stat-label">{t.statCategories}</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{totalReactions}</span>
              <span className="stat-label">{t.statReactions}</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{savedCount}</span>
              <span className="stat-label">{t.statSaved}</span>
            </div>
          </div>

          <p className="feed-subtitle" style={{ marginTop: '14px' }}>
            {t.statsLocalNote}
          </p>
        </div>
      </section>
    );
  }

  const activeCategoryObj = categories.find(
    (c) => Number(c.id) === Number(categoryId)
  );

  return (
    <section className="post-feed">
      <div className="feed-header">
        <div className="feed-title-group">
          <h1 className="feed-title">
            {viewMode === 'saved'
              ? t.savedQuestionsTitle
              : activeCategoryObj
              ? `${t.selectedCategoryPrefix} ${activeCategoryObj.title}`
              : t.communityQuestions}
          </h1>
          <p className="feed-subtitle">
            {viewMode === 'saved'
              ? t.savedSubtitle
              : activeCategoryObj?.description
              ? activeCategoryObj.description
              : t.communitySubtitle}
          </p>
        </div>

        <button type="button" className="ask-btn" onClick={handleAskClick}>
          + {t.askQuestionBtn}
        </button>
      </div>

      <div className="feed-controls-bar">
        <div className="feed-tabs">
          <button
            type="button"
            className={`feed-tab ${viewMode === 'all' ? 'active' : ''}`}
            onClick={() => dispatch(setViewMode('all'))}
          >
            {t.tabAll}
          </button>
          <button
            type="button"
            className={`feed-tab ${viewMode === 'unanswered' ? 'active' : ''}`}
            onClick={() => dispatch(setViewMode('unanswered'))}
          >
            {t.tabUnanswered}
          </button>
          <button
            type="button"
            className={`feed-tab ${viewMode === 'popular' ? 'active' : ''}`}
            onClick={() => {
              dispatch(setViewMode('popular'));
              dispatch(setSortBy('likes'));
            }}
          >
            {t.tabPopular}
          </button>
          <button
            type="button"
            className={`feed-tab ${viewMode === 'saved' ? 'active' : ''}`}
            onClick={() => dispatch(setViewMode('saved'))}
          >
            <span>{t.tabSaved}</span>
            <span
              className={`saved-tab-badge ${savedCount > 0 ? 'has-items' : ''}`}
            >
              {savedCount}
            </span>
          </button>
        </div>

        <div className="feed-filters-row">
          <div className="filter-group">
            <label htmlFor="feed-category-select">{t.categoryFilterLabel}</label>
            <select
              id="feed-category-select"
              className="filter-select"
              value={categoryId || ''}
              onChange={(e) =>
                dispatch(
                  setCategoryId(e.target.value ? Number(e.target.value) : null)
                )
              }
            >
              <option value="">{t.allCategoriesOption}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.title}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="feed-sort-select">{t.sortByLabel}</label>
            <select
              id="feed-sort-select"
              className="filter-select"
              value={sortBy}
              onChange={(e) => dispatch(setSortBy(e.target.value))}
            >
              <option value="date">{t.sortByDate}</option>
              <option value="likes">{t.sortByLikesOption}</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="feed-order-select">{t.orderLabel}</label>
            <select
              id="feed-order-select"
              className="filter-select"
              value={String(order || 'DESC').toUpperCase()}
              onChange={(e) => dispatch(setOrder(e.target.value))}
            >
              <option value="DESC">{t.orderDesc}</option>
              <option value="ASC">{t.orderAsc}</option>
            </select>
          </div>

          {isAdmin && (
            <div className="filter-group">
              <label htmlFor="feed-status-select">{t.statusLabel}</label>
              <select
                id="feed-status-select"
                className="filter-select"
                value={statusFilter}
                onChange={(e) => dispatch(setStatusFilter(e.target.value))}
              >
                <option value="all">{t.statusAll}</option>
                <option value="active">{t.statusActive}</option>
                <option value="inactive">{t.statusInactive}</option>
              </select>
            </div>
          )}

          <div className="filter-group">
            <label htmlFor="feed-limit-select">{t.perPageLabel}</label>
            <select
              id="feed-limit-select"
              className="filter-select"
              value={limit}
              onChange={(e) => dispatch(setLimit(Number(e.target.value)))}
            >
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="feed-dates-row">
          <span className="date-filter-label">{t.datePeriod}</span>
          <input
            type="date"
            className="date-input"
            value={startDate || ''}
            max={endDate || undefined}
            onChange={(e) => dispatch(setStartDate(e.target.value))}
          />
          <span>—</span>
          <input
            type="date"
            className="date-input"
            value={endDate || ''}
            min={startDate || undefined}
            onChange={(e) => dispatch(setEndDate(e.target.value))}
          />
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

      {status === 'loading' && items.length === 0 ? (
        <div className="feed-empty-state">{t.loadingPosts}</div>
      ) : error && items.length === 0 ? (
        <div className="feed-empty-state">
          <p>{t.errorLoadingPosts}</p>
          <button
            type="button"
            className="ask-btn"
            onClick={() => dispatch(fetchPosts())}
          >
            {t.retryBtn}
          </button>
        </div>
      ) : paginatedPosts.length === 0 ? (
        <div className="feed-empty-state">
          {viewMode === 'saved' ? t.noSavedPosts : t.noPostsFound}
        </div>
      ) : (
        <div className="posts-list">
          {paginatedPosts.map((post) => {
            const authorId = post.author_id;
            const authorProfile = authorId ? usersMap[String(authorId)] : null;
            const authorName =
              (authorProfile && !authorProfile._notFound && authorProfile.login) ||
              post.author_login ||
              `${t.userPrefix} #${authorId || 1}`;
            const authorAvatar = avatarUrl(authorProfile);

            const postCats =
              previewCategoriesByPost[post.id] ||
              (Array.isArray(post.categories) ? post.categories : []);
            const commentsList = previewCommentsByPost[post.id] || [];
            const bestComment =
              commentsList.length > 0
                ? [...commentsList].sort(
                    (a, b) =>
                      Number(commentLikesMap[b.id] ?? b.likes_count ?? 0) -
                      Number(commentLikesMap[a.id] ?? a.likes_count ?? 0)
                  )[0]
                : null;
            const bestCommentText = bestComment
              ? parseCommentContent(bestComment.content).text
              : '';

            const currentVote = userVotes[post.id] || null;
            const score = Number(
              postLikesMap[post.id] ?? post.likes_count ?? 0
            );
            const isSaved = savedIdsSet.has(Number(post.id));

            const postReactionData = postReactions[post.id] || {};
            const reactionCounts = postReactionData.counts || {};

            return (
              <article
                key={post.id}
                className={`post-item ${
                  post.status === 'inactive' ? 'post-inactive' : ''
                }`}
                onClick={() => dispatch(openPostPage(post.id))}
              >
                <div className="post-item-header">
                  <div className="post-badges">
                    <span
                      className={`status-pill ${
                        post.status === 'inactive' ? 'inactive' : 'active'
                      }`}
                    >
                      {post.status === 'inactive'
                        ? t.badgeInactive
                        : t.badgeActive}
                    </span>

                    {postCats.map((c, idx) => {
                      const label =
                        typeof c === 'object' ? c.title || c.name : c;
                      return (
                        <span key={c.id || idx} className="post-cat-tag">
                          {label}
                        </span>
                      );
                    })}
                  </div>

                  <span className="post-date">
                    {formatDate(post.publish_date, language)}
                  </span>
                </div>

                <h2 className="post-title">{post.title}</h2>

                <RichContent text={post.content} compact language={language} />

                {bestComment && bestCommentText && (
                  <div className="post-best-comment-preview">
                    <span className="best-comment-badge">
                      💬 {t.bestAnswerBadge}:
                    </span>
                    <span className="best-comment-text">{bestCommentText}</span>
                  </div>
                )}

                <div
                  className="post-meta"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="post-author-chip"
                    onClick={(e) => handleAuthorClick(e, post)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && handleAuthorClick(e, post)
                    }
                  >
                    <div className="post-author-avatar">
                      {authorAvatar ? (
                        <img src={authorAvatar} alt={authorName} />
                      ) : (
                        <span>{getInitials(authorName)}</span>
                      )}
                    </div>
                    <span className="post-author-name">{authorName}</span>
                  </div>

                  <div className="post-actions-bar">
                    <div className="vote-pill">
                      <button
                        type="button"
                        className={`vote-btn ${
                          currentVote === 'like' ? 'active-up' : ''
                        }`}
                        onClick={(e) => handleVote(e, post.id, 'like')}
                      >
                        ▲
                      </button>
                      <span className="vote-score">{score}</span>
                      <button
                        type="button"
                        className={`vote-btn ${
                          currentVote === 'dislike' ? 'active-down' : ''
                        }`}
                        onClick={(e) => handleVote(e, post.id, 'dislike')}
                      >
                        ▼
                      </button>
                    </div>

                    <button
                      type="button"
                      className="comments-count-pill"
                      onClick={() => dispatch(openPostPage(post.id))}
                    >
                      💬 {commentsList.length || 0} {t.answersCountLabel}
                    </button>

                    <div className="reactions-bar">
                      {REACTION_TYPES.map((r) => {
                        const count = Number(reactionCounts?.[r.id] || 0);
                        if (count <= 0) return null;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            className="reaction-chip"
                            onClick={() =>
                              dispatch(
                                toggleReaction({
                                  postId: post.id,
                                  reactionId: r.id,
                                  userId: bucketKey,
                                })
                              )
                            }
                          >
                            {r.emoji} {count}
                          </button>
                        );
                      })}

                      <div className="reaction-picker-wrap">
                        <button
                          type="button"
                          className="reaction-add-btn"
                          onClick={() =>
                            setOpenReactionPostId(
                              openReactionPostId === post.id ? null : post.id
                            )
                          }
                        >
                          😊 +
                        </button>
                        {openReactionPostId === post.id && (
                          <div className="reaction-popover">
                            {REACTION_TYPES.map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                className="reaction-option"
                                onClick={() => {
                                  dispatch(
                                    toggleReaction({
                                      postId: post.id,
                                      reactionId: r.id,
                                      userId: bucketKey,
                                    })
                                  );
                                  setOpenReactionPostId(null);
                                }}
                              >
                                {r.emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`bookmark-btn ${
                        isSaved ? 'active saved-glow' : ''
                      }`}
                      onClick={() =>
                        dispatch(toggleSavePost({ post, userId: bucketKey }))
                      }
                    >
                      <span>{isSaved ? '★' : '☆'}</span>
                      <span>{isSaved ? t.savedBtn : t.saveBtn}</span>
                    </button>

                    <div className="share-dropdown-wrap">
                      <button
                        type="button"
                        className="share-btn"
                        onClick={() =>
                          setOpenSharePostId(
                            openSharePostId === post.id ? null : post.id
                          )
                        }
                      >
                        ↗ {t.shareBtn}
                      </button>
                      {openSharePostId === post.id && (
                        <div className="share-popover">
                          <button
                            type="button"
                            onClick={(e) => handleShare(e, post, 'copy')}
                          >
                            🔗 {t.copyLinkBtn}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleShare(e, post, 'telegram')}
                          >
                            ✈️ Telegram
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleShare(e, post, 'facebook')}
                          >
                            📘 Facebook
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleShare(e, post, 'instagram')}
                          >
                            📸 {t.instagramCopy}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {displayedPosts.length > 0 && (
        <div className="pagination-footer">
          <div className="pagination-mode-toggle">
            <span>{t.navModeLabel}</span>
            <button
              type="button"
              className={`mode-btn ${
                paginationMode === 'pages' ? 'active' : ''
              }`}
              onClick={() => dispatch(setPaginationMode('pages'))}
            >
              {t.modePages}
            </button>
            <button
              type="button"
              className={`mode-btn ${
                paginationMode === 'infinite' ? 'active' : ''
              }`}
              onClick={() => dispatch(setPaginationMode('infinite'))}
            >
              {t.modeInfinite}
            </button>
          </div>

          {paginationMode === 'pages' ? (
            <div className="pagination-controls">
              <button
                type="button"
                className="page-btn"
                disabled={safePage <= 1}
                onClick={() => dispatch(setPage(safePage - 1))}
              >
                {t.prevPage}
              </button>

              <span className="page-indicator">
                {t.pageWord} <strong>{safePage}</strong> {t.ofWord}{' '}
                <strong>{totalPages}</strong> ({displayedPosts.length})
              </span>

              <form
                className="page-jump-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const num = Math.max(
                    1,
                    Math.min(totalPages, Number(pageInput) || 1)
                  );
                  dispatch(setPage(num));
                }}
              >
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  className="page-jump-input"
                />
                <button type="submit" className="page-btn">
                  {t.goBtn}
                </button>
              </form>

              <button
                type="button"
                className="page-btn"
                disabled={safePage >= totalPages}
                onClick={() => dispatch(setPage(safePage + 1))}
              >
                {t.nextPage}
              </button>
            </div>
          ) : (
            paginatedPosts.length < displayedPosts.length && (
              <button
                type="button"
                className="load-more-btn"
                onClick={() => dispatch(setPage(safePage + 1))}
              >
                {t.loadMoreBtn} ({paginatedPosts.length} /{' '}
                {displayedPosts.length})
              </button>
            )
          )}
        </div>
      )}
    </section>
  );
};

export default PostFeed;
