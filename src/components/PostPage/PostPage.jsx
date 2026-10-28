import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchPostDetails,
  fetchCategories,
  closePostPage,
  setCategoryId,
  setHighlightedCommentId,
  votePost,
  voteComment,
  createComment,
  updateComment,
  deleteComment,
  toggleReaction,
  toggleCommentReaction,
  toggleSavePost,
  openAskModal,
  updateExistingPost,
  deleteExistingPost,
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
import './PostPage.css';

const resolveAvatarUrl = (rawPath) => {
  if (!rawPath || typeof rawPath !== 'string') return null;
  const trimmed = rawPath.trim();
  const lower = trimmed.toLowerCase();
  if (
    !trimmed ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower.includes('default') ||
    lower.includes('placeholder')
  ) {
    return null;
  }
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/api/')) {
    return trimmed;
  }
  if (trimmed.startsWith('uploads/')) {
    return `/${trimmed}`;
  }
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  return `/uploads/${trimmed}`;
};

const PostPage = () => {
  const dispatch = useDispatch();
  const { user, language, usersMap } = useSelector((state) => state.auth);
  const {
    selectedPostId,
    currentPost: post,
    currentPostCategories,
    currentPostComments,
    postLikesMap,
    commentLikesMap,
    postVoteFromServer,
    commentVoteFromServer,
    postDetailsStatus,
    postDetailsError,
    categories: allCategories,
    userVotes,
    commentVotes,
    postReactions,
    commentReactions,
    savedPosts,
    commentParents,
    highlightedCommentId,
  } = useSelector((state) => state.posts);

  const t = translations[language] || translations.uk;
  const isAdmin = user?.role === 'admin';

  const [answerText, setAnswerText] = useState('');
  const [answerError, setAnswerError] = useState('');
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState('');

  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  const [commentSortOrder, setCommentSortOrder] = useState('asc');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [brokenAvatars, setBrokenAvatars] = useState({});

  const shareMenuRef = useRef(null);
  const reactionMenuRef = useRef(null);
  const requestedUserIdsRef = useRef(new Set());

  useEffect(() => {
    dispatch(fetchAllUsers());
    dispatch(fetchCategories());
  }, [dispatch]);

  useEffect(() => {
    if (selectedPostId) {
      dispatch(fetchPostDetails(selectedPostId));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [dispatch, selectedPostId]);

  useEffect(() => {
    if (!highlightedCommentId || currentPostComments.length === 0) {
      return undefined;
    }
    const scrollTimer = setTimeout(() => {
      const el = document.getElementById(`comment-${highlightedCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);

    const clearTimer = setTimeout(() => {
      dispatch(setHighlightedCommentId(null));
    }, 4500);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightedCommentId, currentPostComments, dispatch]);

  useEffect(() => {
    const postAid = post?.author_id || post?.user_id;
    if (
      postAid &&
      !usersMap[postAid] &&
      !requestedUserIdsRef.current.has(postAid)
    ) {
      requestedUserIdsRef.current.add(postAid);
      dispatch(fetchUserById(postAid));
    }
    currentPostComments.forEach((c) => {
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
  }, [dispatch, post, currentPostComments, usersMap]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        shareMenuRef.current &&
        !shareMenuRef.current.contains(event.target)
      ) {
        setIsShareOpen(false);
      }
      if (
        reactionMenuRef.current &&
        !reactionMenuRef.current.contains(event.target)
      ) {
        setIsReactionPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const requireAuth = () => {
    if (!user) {
      dispatch(showNotification({ message: t.authRequiredToast }));
      dispatch(openAuthModal('login'));
      return false;
    }
    return true;
  };

  const handleOpenUser = (authorId, fallbackName) => {
    if (authorId) {
      dispatch(fetchUserById(authorId));
    }
    dispatch(
      openUserProfile(
        usersMap[authorId] || {
          id: authorId || 0,
          login: fallbackName,
          full_name: fallbackName,
          role: 'user',
        }
      )
    );
  };

  const getInitials = (name) => {
    if (!name) return 'US';
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return String(name).slice(0, 2).toUpperCase();
  };

  const formatRelativeTime = (dateValue) => {
    if (!dateValue) return t.justNow;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return dateValue;

    const diffMs = Math.max(0, Date.now() - date.getTime());
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) {
      return t.justNow;
    }
    if (diffMinutes < 60) {
      return `${diffMinutes} ${t.minAgo}`;
    }
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} ${t.hoursAgo}`;
    }
    return date.toLocaleDateString(language === 'en' ? 'en-US' : 'uk-UA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getPostRatingDelta = (postId) => {
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

    return voteDelta + reactionsDelta;
  };

  const getCommentEffectiveLikes = useCallback(
    (comment) => {
      const base = Number(
        commentLikesMap[comment.id] ??
          comment.likes_count ??
          comment.likesCount ??
          comment.rating ??
          0
      );
      const vote = commentVotes[comment.id];
      let delta = 0;
      if (!commentVoteFromServer[comment.id]) {
        if (vote === 'like') delta = 1;
        if (vote === 'dislike') delta = -1;
      }

      const cReactions = commentReactions[comment.id]?.counts || {};
      const rDelta = REACTION_TYPES.reduce(
        (sum, r) => sum + (cReactions[r.id] || 0) * r.weight,
        0
      );

      return base + delta + rDelta;
    },
    [commentLikesMap, commentVotes, commentVoteFromServer, commentReactions]
  );

  const visibleCommentsList = useMemo(() => {
    if (isAdmin) return currentPostComments;
    return currentPostComments.filter((c) => c.status !== 'inactive');
  }, [currentPostComments, isAdmin]);

  const { rootComments, repliesByParentId } = useMemo(() => {
    const roots = [];
    const byParent = {};
    const existingIds = new Set(visibleCommentsList.map((c) => String(c.id)));

    visibleCommentsList.forEach((c) => {
      const parentId =
        c.parent_id || c.parentId || commentParents[c.id] || null;
      if (parentId && existingIds.has(String(parentId))) {
        const key = String(parentId);
        if (!byParent[key]) byParent[key] = [];
        byParent[key].push(c);
      } else {
        roots.push(c);
      }
    });

    const compareByLikes = (a, b) => {
      const scoreA = getCommentEffectiveLikes(a);
      const scoreB = getCommentEffectiveLikes(b);
      return commentSortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
    };

    roots.sort(compareByLikes);
    Object.keys(byParent).forEach((key) => {
      byParent[key].sort(compareByLikes);
    });

    return { rootComments: roots, repliesByParentId: byParent };
  }, [
    visibleCommentsList,
    commentParents,
    commentSortOrder,
    getCommentEffectiveLikes,
  ]);

  const handleMainAnswerSubmit = async (e) => {
    e.preventDefault();
    if (!requireAuth()) return;

    const trimmed = answerText.trim();
    if (!trimmed) {
      setAnswerError(t.answerEmptyError);
      return;
    }
    if (trimmed.length < 5) {
      setAnswerError(t.answerShortError);
      return;
    }
    setAnswerError('');

    await dispatch(
      createComment({
        postId: post.id,
        content: trimmed,
        parentCommentId: null,
      })
    );
    setAnswerText('');
  };

  const handleReplySubmit = async (e, parentCommentId) => {
    e.preventDefault();
    if (!requireAuth()) return;

    const trimmed = replyText.trim();
    if (!trimmed || trimmed.length < 2) {
      setReplyError(t.answerShortError);
      return;
    }
    setReplyError('');

    await dispatch(
      createComment({
        postId: post.id,
        content: trimmed,
        parentCommentId,
      })
    );
    setReplyText('');
    setReplyingToId(null);
  };

  const handleSaveEditedComment = async (comment) => {
    const trimmed = editingCommentText.trim();
    if (!trimmed) return;
    await dispatch(
      updateComment({
        postId: post.id,
        commentId: comment.id,
        content: trimmed,
        status: comment.status || 'active',
      })
    );
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const copyShareLink = async (platform) => {
    const postUrl = `${window.location.origin}/posts/${post.id}`;
    const encodedUrl = encodeURIComponent(postUrl);
    const encodedTitle = encodeURIComponent(post.title || 'USOF');

    if (platform === 'facebook') {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`,
        '_blank',
        'noopener,noreferrer,width=600,height=500'
      );
      setIsShareOpen(false);
      return;
    }
    if (platform === 'telegram') {
      window.open(
        `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
        '_blank',
        'noopener,noreferrer,width=600,height=500'
      );
      setIsShareOpen(false);
      return;
    }

    try {
      await navigator.clipboard.writeText(postUrl);
    } catch {
      // Ignore
    }
    dispatch(
      showNotification({
        message:
          language === 'en' ? 'Link copied!' : 'Посилання скопійовано!',
      })
    );
    setIsShareOpen(false);
  };

  if (postDetailsStatus === 'loading' && !post) {
    return (
      <div className="post-page-container">
        <div className="post-page-state">{t.loadingPosts}</div>
      </div>
    );
  }

  if (postDetailsStatus === 'failed' || !post) {
    return (
      <div className="post-page-container">
        <div className="post-page-state error">
          <p>{postDetailsError || 'Not found'}</p>
          <button
            type="button"
            className="back-to-feed-btn"
            onClick={() => dispatch(closePostPage())}
          >
            {t.backToFeedBtn}
          </button>
        </div>
      </div>
    );
  }

  const mappedPostAuthor = usersMap[post.author_id || post.user_id];
  const authorName =
    mappedPostAuthor?.login ||
    post.author?.login ||
    post.author_login ||
    post.author_name ||
    `${t.userPrefix} #${post.author_id || post.user_id || 1}`;

  const isAuthor =
    user &&
    (Number(user.id || user.userId) === Number(post.author_id) ||
      user.login === authorName);
  const canModifyPost = isAuthor || isAdmin;

  if (post.status === 'inactive' && !isAdmin && !isAuthor) {
    return (
      <div className="post-page-container">
        <div className="post-page-state error">
          <p>{t.inactivePostForbidden}</p>
          <button
            type="button"
            className="back-to-feed-btn"
            onClick={() => dispatch(closePostPage())}
          >
            {t.backToFeedBtn}
          </button>
        </div>
      </div>
    );
  }

  const postAuthorAvatar = resolveAvatarUrl(
    mappedPostAuthor?.profile_picture ||
      mappedPostAuthor?.avatar ||
      post.author?.profile_picture
  );

  const displayCategories =
    currentPostCategories.length > 0
      ? currentPostCategories
      : Array.isArray(post.categories) && post.categories.length > 0
      ? post.categories
      : allCategories.slice(0, 2);

  const baseLikes = Number(
    postLikesMap[post.id] ??
      post.likes_count ??
      post.likesCount ??
      post.rating ??
      0
  );
  const effectiveScore = baseLikes + getPostRatingDelta(post.id);
  const currentVote = userVotes[post.id] || null;
  const isSaved = Boolean(savedPosts[post.id]);
  const postReactionState = postReactions[post.id] || {
    counts: {},
    userSelected: [],
  };

  const renderCommentNode = (comment, depth = 0) => {
    const mappedCommentAuthor = usersMap[comment.author_id || comment.user_id];
    const cAuthor =
      mappedCommentAuthor?.login ||
      comment.author?.login ||
      comment.author_login ||
      comment.author_name ||
      `${t.userPrefix} #${comment.author_id || comment.user_id || 1}`;

    const cAvatar = resolveAvatarUrl(
      mappedCommentAuthor?.profile_picture ||
        mappedCommentAuthor?.avatar ||
        comment.author?.profile_picture
    );

    const isCommentAuthor =
      user &&
      Number(user.id || user.userId) ===
        Number(comment.author_id || comment.user_id);
    const canDeleteComment = isCommentAuthor || isAdmin;

    const cScore = getCommentEffectiveLikes(comment);
    const cVote = commentVotes[comment.id] || null;
    const cReactions = commentReactions[comment.id] || {
      counts: {},
      userSelected: [],
    };
    const childReplies = repliesByParentId[String(comment.id)] || [];
    const isReplyingHere = replyingToId === comment.id;
    const isEditingHere = editingCommentId === comment.id;
    const isHighlighted =
      String(highlightedCommentId) === String(comment.id);

    return (
      <div
        key={comment.id}
        id={`comment-${comment.id}`}
        className={`comment-thread-node ${depth > 0 ? 'nested' : ''} ${
          isHighlighted ? 'highlighted-comment-node' : ''
        }`}
      >
        <div className="comment-card">
          <div className="comment-author-row">
            <div
              className="author-avatar-circle small"
              style={{ cursor: 'pointer', overflow: 'hidden' }}
              onClick={() => handleOpenUser(comment.author_id, cAuthor)}
            >
              {cAvatar && !brokenAvatars[cAvatar] ? (
                <img
                  src={cAvatar}
                  alt={cAuthor}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={() =>
                    setBrokenAvatars((prev) => ({ ...prev, [cAvatar]: true }))
                  }
                />
              ) : (
                getInitials(cAuthor)
              )}
            </div>
            <button
              type="button"
              className="comment-author-name"
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
              onClick={() => handleOpenUser(comment.author_id, cAuthor)}
            >
              {cAuthor}
            </button>
            <span className="comment-time">
              {formatRelativeTime(
                comment.publish_date ||
                  comment.publishDate ||
                  comment.created_at
              )}
            </span>
            {isAdmin && (
              <span
                className={`post-status-badge ${comment.status || 'active'}`}
              >
                {comment.status === 'inactive'
                  ? t.badgeInactive
                  : t.badgeActive}
              </span>
            )}
          </div>

          {isEditingHere ? (
            <div className="inline-reply-form">
              <textarea
                rows={2}
                value={editingCommentText}
                onChange={(e) => setEditingCommentText(e.target.value)}
                className="inline-reply-textarea"
              />
              <div className="inline-reply-buttons">
                <button
                  type="button"
                  className="cancel-reply-btn"
                  onClick={() => setEditingCommentId(null)}
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="button"
                  className="submit-reply-btn"
                  onClick={() => handleSaveEditedComment(comment)}
                >
                  {t.saveChangesBtn}
                </button>
              </div>
            </div>
          ) : (
            <p className="comment-body-text">{comment.content}</p>
          )}

          <div className="comment-actions-row">
            <button
              type="button"
              className={`comment-like-btn ${cVote === 'like' ? 'active' : ''}`}
              onClick={() => {
                if (!requireAuth()) return;
                dispatch(voteComment({ commentId: comment.id, type: 'like' }));
              }}
            >
              ↑ {cScore}
            </button>

            <button
              type="button"
              className={`comment-dislike-btn ${
                cVote === 'dislike' ? 'active' : ''
              }`}
              onClick={() => {
                if (!requireAuth()) return;
                dispatch(
                  voteComment({ commentId: comment.id, type: 'dislike' })
                );
              }}
            >
              ↓
            </button>

            {REACTION_TYPES.map((r) => {
              const rCount = cReactions.counts?.[r.id] || 0;
              const rSelected = cReactions.userSelected?.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`comment-reaction-btn ${
                    rSelected ? 'active' : ''
                  }`}
                  onClick={() => {
                    if (!requireAuth()) return;
                    dispatch(
                      toggleCommentReaction({
                        commentId: comment.id,
                        reactionId: r.id,
                      })
                    );
                  }}
                >
                  {r.emoji} {rCount > 0 ? rCount : ''}
                </button>
              );
            })}

            <button
              type="button"
              className="comment-reply-trigger"
              onClick={() => {
                if (!requireAuth()) return;
                setReplyingToId(isReplyingHere ? null : comment.id);
                setReplyText('');
                setReplyError('');
              }}
            >
              {t.replyBtn}
            </button>

            {isCommentAuthor && (
              <button
                type="button"
                className="comment-reply-trigger"
                onClick={() => {
                  setEditingCommentId(comment.id);
                  setEditingCommentText(comment.content);
                }}
              >
                {t.editBtn}
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                className="comment-reply-trigger"
                onClick={() =>
                  dispatch(
                    updateComment({
                      postId: post.id,
                      commentId: comment.id,
                      content: comment.content,
                      status:
                        comment.status === 'inactive' ? 'active' : 'inactive',
                    })
                  )
                }
              >
                🛡{' '}
                {comment.status === 'inactive'
                  ? t.activateBtn
                  : t.deactivateBtn}
              </button>
            )}

            {canDeleteComment && (
              <button
                type="button"
                className="comment-reply-trigger"
                style={{ color: '#dc2626' }}
                onClick={() =>
                  dispatch(
                    deleteComment({ postId: post.id, commentId: comment.id })
                  )
                }
              >
                {t.deleteBtn}
              </button>
            )}
          </div>

          {isReplyingHere && (
            <form
              className="inline-reply-form"
              onSubmit={(e) => handleReplySubmit(e, comment.id)}
              noValidate
            >
              <textarea
                rows={2}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`${t.replyPlaceholder} ${cAuthor}...`}
                className="inline-reply-textarea"
              />
              {replyError && (
                <span className="form-validation-error">{replyError}</span>
              )}
              <div className="inline-reply-buttons">
                <button
                  type="button"
                  className="cancel-reply-btn"
                  onClick={() => setReplyingToId(null)}
                >
                  {t.cancelBtn}
                </button>
                <button type="submit" className="submit-reply-btn">
                  {t.replyBtn}
                </button>
              </div>
            </form>
          )}
        </div>

        {childReplies.length > 0 && (
          <div className="comment-children-list">
            {childReplies.map((reply) => renderCommentNode(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <article className="post-page-container">
      <nav className="post-breadcrumbs" aria-label="Categories">
        {displayCategories.length > 0 ? (
          displayCategories.map((cat, index) => (
            <React.Fragment key={cat.id || index}>
              {index > 0 && <span className="breadcrumb-sep">/</span>}
              <button
                type="button"
                className="breadcrumb-cat-link"
                onClick={() => {
                  if (cat.id) dispatch(setCategoryId(cat.id));
                  else dispatch(closePostPage());
                }}
                title={cat.description || cat.title}
              >
                {typeof cat === 'string' ? cat : cat.title || cat.name}
              </button>
            </React.Fragment>
          ))
        ) : (
          <button
            type="button"
            className="breadcrumb-cat-link"
            onClick={() => dispatch(closePostPage())}
          >
            {t.generalTopic}
          </button>
        )}
      </nav>

      <h1 className="post-full-title">{post.title}</h1>

      <div className="post-author-header">
        <div
          className="author-avatar-circle"
          style={{ cursor: 'pointer', overflow: 'hidden' }}
          onClick={() => handleOpenUser(post.author_id, authorName)}
        >
          {postAuthorAvatar && !brokenAvatars[postAuthorAvatar] ? (
            <img
              src={postAuthorAvatar}
              alt={authorName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() =>
                setBrokenAvatars((prev) => ({
                  ...prev,
                  [postAuthorAvatar]: true,
                }))
              }
            />
          ) : (
            getInitials(authorName)
          )}
        </div>
        <button
          type="button"
          className="author-full-name"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
          onClick={() => handleOpenUser(post.author_id, authorName)}
        >
          {authorName}
        </button>
        <span className="author-meta-dot">·</span>
        <span className="post-time-ago">
          {formatRelativeTime(
            post.publish_date || post.publishDate || post.created_at
          )}
        </span>
        {post.status && (
          <span className={`post-status-badge ${post.status}`}>
            {post.status === 'active' ? t.badgeActive : t.badgeInactive}
          </span>
        )}
      </div>

      <div className="post-full-body">
        {String(post.content || '')
          .split('\n')
          .map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
      </div>

      <div className="post-full-actions">
        <div className="post-vote-box">
          <button
            type="button"
            className={`post-vote-arrow ${
              currentVote === 'like' ? 'active-up' : ''
            }`}
            onClick={() => {
              if (!requireAuth()) return;
              dispatch(votePost({ postId: post.id, type: 'like' }));
            }}
          >
            ↑
          </button>
          <span className="post-vote-number">{effectiveScore}</span>
          <button
            type="button"
            className={`post-vote-arrow ${
              currentVote === 'dislike' ? 'active-down' : ''
            }`}
            onClick={() => {
              if (!requireAuth()) return;
              dispatch(votePost({ postId: post.id, type: 'dislike' }));
            }}
          >
            ↓
          </button>
        </div>

        <div className="post-share-container" ref={shareMenuRef}>
          <button
            type="button"
            className="post-action-ghost-btn"
            onClick={() => setIsShareOpen(!isShareOpen)}
          >
            <span>🔗</span>
            <span>{t.shareBtn}</span>
          </button>

          {isShareOpen && (
            <div className="share-dropdown">
              <button
                type="button"
                className="share-option"
                onClick={() => copyShareLink('facebook')}
              >
                Facebook
              </button>
              <button
                type="button"
                className="share-option"
                onClick={() => copyShareLink('instagram')}
              >
                {t.instagramCopy}
              </button>
              <button
                type="button"
                className="share-option"
                onClick={() => copyShareLink('telegram')}
              >
                Telegram
              </button>
              <div className="share-divider" />
              <button
                type="button"
                className="share-option copy-link"
                onClick={() => copyShareLink('copy')}
              >
                {t.copyLinkBtn}
              </button>
            </div>
          )}
        </div>

        <div className="post-reactions-inline" ref={reactionMenuRef}>
          {REACTION_TYPES.map((r) => {
            const count = postReactionState.counts?.[r.id] || 0;
            const isSelected = postReactionState.userSelected?.includes(r.id);
            if (count === 0 && !isSelected) return null;
            return (
              <button
                key={r.id}
                type="button"
                className={`reaction-chip ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  if (!requireAuth()) return;
                  dispatch(
                    toggleReaction({ postId: post.id, reactionId: r.id })
                  );
                }}
              >
                <span>{r.emoji}</span>
                <span>{count}</span>
              </button>
            );
          })}

          <button
            type="button"
            className="post-action-ghost-btn"
            onClick={() => {
              if (!requireAuth()) return;
              setIsReactionPickerOpen(!isReactionPickerOpen);
            }}
          >
            {t.addReaction}
          </button>

          {isReactionPickerOpen && (
            <div className="reaction-popover">
              {REACTION_TYPES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="reaction-picker-item"
                  onClick={() => {
                    dispatch(
                      toggleReaction({ postId: post.id, reactionId: r.id })
                    );
                    setIsReactionPickerOpen(false);
                  }}
                >
                  <span className="reaction-emoji">{r.emoji}</span>
                  <span className="reaction-name">
                    {language === 'en' ? r.labelEn : r.label}
                  </span>
                  <span className="reaction-weight">+{r.weight}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className={`post-action-ghost-btn ${isSaved ? 'active' : ''}`}
          onClick={() => dispatch(toggleSavePost(post))}
        >
          <span>🔖</span>
          <span>{isSaved ? t.savedBtn : t.saveBtn}</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            className="post-action-ghost-btn"
            onClick={() =>
              dispatch(
                updateExistingPost({
                  postId: post.id,
                  status: post.status === 'inactive' ? 'active' : 'inactive',
                })
              )
            }
          >
            {t.adminToggleStatus}{' '}
            {post.status === 'inactive' ? t.activateBtn : t.deactivateBtn}
          </button>
        )}

        {canModifyPost && (
          <>
            <button
              type="button"
              className="post-action-ghost-btn"
              onClick={() =>
                dispatch(
                  openAskModal({
                    ...post,
                    categories: displayCategories,
                  })
                )
              }
            >
              {t.editBtn}
            </button>

            <button
              type="button"
              className="post-action-ghost-btn"
              style={{ color: '#dc2626' }}
              onClick={() => setConfirmDeleteOpen(true)}
            >
              {t.deleteBtn}
            </button>
          </>
        )}
      </div>

      {confirmDeleteOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setConfirmDeleteOpen(false)}
        >
          <div
            className="modal-card"
            style={{ maxWidth: '400px', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, fontSize: '17px' }}>
              {t.confirmDeleteTitle}
            </h3>
            <p style={{ fontSize: '14px', color: '#4b5563' }}>
              {t.confirmDeleteText}
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '20px',
              }}
            >
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setConfirmDeleteOpen(false)}
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                className="modal-submit-btn"
                style={{ backgroundColor: '#dc2626' }}
                onClick={() => {
                  setConfirmDeleteOpen(false);
                  dispatch(deleteExistingPost(post.id));
                }}
              >
                {t.deleteForeverBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      <hr className="post-section-divider" />

      <section className="answers-section">
        <div className="answers-header-row">
          <h2 className="answers-count-title">
            {visibleCommentsList.length} {t.answersCountLabel}
          </h2>

          {visibleCommentsList.length > 1 && (
            <button
              type="button"
              className="comments-sort-toggle"
              onClick={() =>
                setCommentSortOrder(commentSortOrder === 'asc' ? 'desc' : 'asc')
              }
            >
              {t.sortByLikes}{' '}
              {commentSortOrder === 'asc' ? t.sortAsc : t.sortDesc}
            </button>
          )}
        </div>

        {rootComments.length === 0 ? (
          <p className="no-answers-yet">{t.noAnswersYet}</p>
        ) : (
          <div className="comments-tree-list">
            {rootComments.map((comment) => renderCommentNode(comment, 0))}
          </div>
        )}

        <form
          className="bottom-answer-box"
          onSubmit={handleMainAnswerSubmit}
          noValidate
        >
          <textarea
            rows={3}
            value={answerText}
            onChange={(e) => {
              setAnswerText(e.target.value);
              if (answerError) setAnswerError('');
            }}
            placeholder={t.writeAnswerPlaceholder}
            className="bottom-answer-textarea"
          />
          {answerError && (
            <span className="form-validation-error">{answerError}</span>
          )}
          <div className="bottom-answer-footer">
            <button type="submit" className="send-answer-btn">
              {t.sendAnswerBtn}
            </button>
          </div>
        </form>
      </section>
    </article>
  );
};

export default PostPage;