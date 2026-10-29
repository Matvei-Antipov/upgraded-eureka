import React, { useEffect, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchPostDetails,
  closePostPage,
  setCategoryId,
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
  REACTION_TYPES,
} from '../../store/postsSlice';
import {
  openAuthModal,
  fetchUserById,
  openUserProfile,
} from '../../store/authSlice';
import { translations } from '../../i18n/translations';
import { avatarUrl, getInitials, formatDateTime } from '../../utils/format';
import { buildCommentTree } from '../../utils/comments';
import RichContent from '../RichContent/RichContent';
import './PostPage.css';

const PostPage = () => {
  const dispatch = useDispatch();
  const {
    selectedPostId,
    currentPost,
    currentPostCategories = [],
    currentPostComments = [],
    postLikesMap = {},
    commentLikesMap = {},
    postDetailsStatus,
    userVotes = {},
    commentVotes = {},
    postReactions = {},
    commentReactions = {},
    savedPostsByUser = {},
    highlightedCommentId,
  } = useSelector((state) => state.posts);

  const { user, language = 'uk', usersMap = {} } = useSelector(
    (state) => state.auth
  );
  const t = translations[language] || translations.uk;

  const [commentSortOrder, setCommentSortOrder] = useState('asc');
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [editCommentError, setEditCommentError] = useState('');
  const [commentError, setCommentError] = useState('');

  const bucketKey = String(user?.id || 'guest');

  useEffect(() => {
    if (selectedPostId) {
      dispatch(fetchPostDetails(selectedPostId));
    }
  }, [selectedPostId, dispatch]);

  useEffect(() => {
    if (currentPost?.author_id) {
      dispatch(fetchUserById(currentPost.author_id));
    }
    currentPostComments.forEach((c) => {
      if (c?.author_id) {
        dispatch(fetchUserById(c.author_id));
      }
    });
  }, [currentPost, currentPostComments, dispatch]);

  const commentTree = useMemo(() => {
    const compare = (a, b) => {
      const scoreA = Number(commentLikesMap[a.id] ?? a.likes_count ?? 0);
      const scoreB = Number(commentLikesMap[b.id] ?? b.likes_count ?? 0);
      if (scoreA !== scoreB) {
        return commentSortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      }
      const dA = new Date(a.publish_date || 0).getTime();
      const dB = new Date(b.publish_date || 0).getTime();
      return dA - dB;
    };
    return buildCommentTree(currentPostComments, compare);
  }, [currentPostComments, commentLikesMap, commentSortOrder]);

  if (!currentPost && postDetailsStatus === 'loading') {
    return <div className="post-page-container">{t.loadingPosts}</div>;
  }

  if (!currentPost || postDetailsStatus === 'failed') {
    return (
      <div className="post-page-container">
        <div className="post-page-top-bar">
          <button
            type="button"
            className="ask-btn"
            onClick={() => dispatch(closePostPage())}
          >
            {t.backToQuestions}
          </button>
        </div>
        <div className="post-full-card">
          <h2 className="post-full-title">{t.notFoundTitle}</h2>
          <p className="feed-subtitle">{t.notFoundSubtitle}</p>
        </div>
      </div>
    );
  }

  const postAuthorId = currentPost.author_id;
  const isPostOwner = user && Number(user.id) === Number(postAuthorId);
  const isAdmin = user?.role === 'admin';
  const isPostInactive = currentPost.status === 'inactive';

  if (isPostInactive && !isAdmin && !isPostOwner) {
    return (
      <div className="post-page-container">
        <div className="post-page-top-bar">
          <button
            type="button"
            className="ask-btn"
            onClick={() => dispatch(closePostPage())}
          >
            {t.backToQuestions}
          </button>
        </div>
        <div className="post-full-card">
          <h2 className="post-full-title">{t.badgeInactive}</h2>
          <p className="feed-subtitle">{t.inactivePostForbidden}</p>
        </div>
      </div>
    );
  }

  const isSaved = Boolean(savedPostsByUser?.[bucketKey]?.[currentPost.id]);

  const postAuthorObj = postAuthorId ? usersMap[String(postAuthorId)] : null;
  const postAuthorName =
    (postAuthorObj && !postAuthorObj._notFound && postAuthorObj.login) ||
    currentPost.author_login ||
    `${t.userPrefix} #${postAuthorId || 1}`;
  const postAuthorAvatar = avatarUrl(postAuthorObj);

  const postScore = Number(
    postLikesMap[currentPost.id] ?? currentPost.likes_count ?? 0
  );
  const currentPostVote = userVotes[currentPost.id] || null;

  const postReactionData = postReactions[currentPost.id] || {};
  const postReactionCounts = postReactionData.counts || {};

  const handleSubmitMainComment = async (e) => {
    e.preventDefault();
    setCommentError('');
    if (!user) {
      dispatch(openAuthModal('login'));
      return;
    }
    if (!newCommentText.trim()) {
      setCommentError(t.answerEmptyError);
      return;
    }
    if (newCommentText.trim().length < 2) {
      setCommentError(t.answerShortError);
      return;
    }
    const res = await dispatch(
      createComment({
        postId: currentPost.id,
        content: newCommentText.trim(),
        parentCommentId: null,
      })
    );
    if (!res.error) {
      setNewCommentText('');
    }
  };

  const handleSubmitReply = async (parentId) => {
    setReplyError('');
    if (!user) {
      dispatch(openAuthModal('login'));
      return;
    }
    if (replyText.trim().length < 2) {
      setReplyError(t.answerShortError);
      return;
    }
    const res = await dispatch(
      createComment({
        postId: currentPost.id,
        content: replyText.trim(),
        parentCommentId: parentId,
      })
    );
    if (!res.error) {
      setReplyText('');
      setReplyingToId(null);
    }
  };

  const handleSaveCommentEdit = async (commentId) => {
    setEditCommentError('');
    if (editingCommentText.trim().length < 2) {
      setEditCommentError(t.answerShortError);
      return;
    }
    const res = await dispatch(
      updateComment({
        commentId,
        postId: currentPost.id,
        content: editingCommentText.trim(),
      })
    );
    if (!res.error) {
      setEditingCommentId(null);
    }
  };

  const handleToggleCommentStatus = (comment) => {
    const nextStatus = comment.status === 'inactive' ? 'active' : 'inactive';
    dispatch(
      updateComment({
        commentId: comment.id,
        postId: currentPost.id,
        status: nextStatus,
      })
    );
  };

  const handleDeleteComment = (commentId) => {
    if (!window.confirm(t.confirmDeleteComment)) return;
    dispatch(deleteComment({ commentId, postId: currentPost.id }));
  };

  const handleDeletePost = () => {
    if (!window.confirm(t.confirmDeletePost)) return;
    dispatch(deleteExistingPost(currentPost.id));
    dispatch(closePostPage());
  };

  const renderCommentNode = (node, depth = 0) => {
    const { comment, text: cleanText, children } = node;
    const cAuthorId = comment.author_id;
    const cAuthorObj = cAuthorId ? usersMap[String(cAuthorId)] : null;
    const cAuthorName =
      (cAuthorObj && !cAuthorObj._notFound && cAuthorObj.login) ||
      comment.author_login ||
      `${t.userPrefix} #${cAuthorId || 1}`;
    const cAuthorAvatar = avatarUrl(cAuthorObj);
    const isCommentOwner = user && Number(user.id) === Number(cAuthorId);
    const cScore = Number(
      commentLikesMap[comment.id] ?? comment.likes_count ?? 0
    );
    const cVote = commentVotes[comment.id] || null;
    const cReactionData = commentReactions[comment.id] || {};
    const cReactionCounts = cReactionData.counts || {};
    const isHighlighted =
      highlightedCommentId &&
      Number(highlightedCommentId) === Number(comment.id);

    return (
      <div
        key={comment.id}
        className={`comment-thread-node ${depth > 0 ? 'nested-reply' : ''}`}
      >
        <div
          className={`comment-card ${
            comment.status === 'inactive' ? 'comment-inactive' : ''
          } ${isHighlighted ? 'comment-highlighted' : ''}`}
        >
          <div className="comment-header">
            <div
              className="post-author-chip"
              onClick={() =>
                dispatch(
                  openUserProfile(
                    cAuthorObj && !cAuthorObj._notFound
                      ? cAuthorObj
                      : { id: cAuthorId, login: cAuthorName }
                  )
                )
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                dispatch(
                  openUserProfile(
                    cAuthorObj && !cAuthorObj._notFound
                      ? cAuthorObj
                      : { id: cAuthorId, login: cAuthorName }
                  )
                )
              }
            >
              <div className="post-author-avatar">
                {cAuthorAvatar ? (
                  <img src={cAuthorAvatar} alt={cAuthorName} />
                ) : (
                  <span>{getInitials(cAuthorName)}</span>
                )}
              </div>
              <span className="comment-author">{cAuthorName}</span>
              {depth > 0 && (
                <span className="post-cat-tag">↳ {t.replyingToBadge}</span>
              )}
              {comment.status === 'inactive' && (
                <span className="status-pill inactive">{t.badgeInactive}</span>
              )}
            </div>
            <span className="comment-date">
              {formatDateTime(comment.publish_date, language)}
            </span>
          </div>

          {editingCommentId === comment.id ? (
            <div className="inline-reply-form">
              {editCommentError && (
                <div className="modal-error-banner">{editCommentError}</div>
              )}
              <textarea
                className="reply-textarea"
                value={editingCommentText}
                onChange={(e) => setEditingCommentText(e.target.value)}
              />
              <div className="reply-form-actions">
                <button
                  type="button"
                  className="ask-btn"
                  onClick={() => handleSaveCommentEdit(comment.id)}
                >
                  {t.saveChangesBtn}
                </button>
                <button
                  type="button"
                  className="bookmark-btn"
                  onClick={() => {
                    setEditingCommentId(null);
                    setEditCommentError('');
                  }}
                >
                  {t.cancelBtn}
                </button>
              </div>
            </div>
          ) : (
            <RichContent text={cleanText} language={language} />
          )}

          <div className="comment-footer">
            <div className="vote-pill">
              <button
                type="button"
                className={`vote-btn ${cVote === 'like' ? 'active-up' : ''}`}
                onClick={() =>
                  user
                    ? dispatch(
                        voteComment({ commentId: comment.id, type: 'like' })
                      )
                    : dispatch(openAuthModal('login'))
                }
              >
                ▲
              </button>
              <span className="vote-score">{cScore}</span>
              <button
                type="button"
                className={`vote-btn ${
                  cVote === 'dislike' ? 'active-down' : ''
                }`}
                onClick={() =>
                  user
                    ? dispatch(
                        voteComment({ commentId: comment.id, type: 'dislike' })
                      )
                    : dispatch(openAuthModal('login'))
                }
              >
                ▼
              </button>
            </div>

            {!isPostInactive && (
              <button
                type="button"
                className="bookmark-btn"
                onClick={() => {
                  setReplyError('');
                  setReplyingToId(
                    replyingToId === comment.id ? null : comment.id
                  );
                }}
              >
                ↩ {t.replyBtn}
              </button>
            )}

            {REACTION_TYPES.slice(0, 3).map((r) => {
              const count = Number(cReactionCounts?.[r.id] || 0);
              return (
                <button
                  key={r.id}
                  type="button"
                  className="reaction-chip"
                  onClick={() =>
                    dispatch(
                      toggleCommentReaction({
                        commentId: comment.id,
                        reactionId: r.id,
                        userId: bucketKey,
                      })
                    )
                  }
                >
                  {r.emoji} {count > 0 ? count : ''}
                </button>
              );
            })}

            {isCommentOwner && (
              <button
                type="button"
                className="bookmark-btn"
                onClick={() => {
                  setEditCommentError('');
                  setEditingCommentId(comment.id);
                  setEditingCommentText(cleanText);
                }}
              >
                {t.editBtn}
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                className="bookmark-btn"
                onClick={() => handleToggleCommentStatus(comment)}
              >
                {comment.status === 'inactive'
                  ? t.activateBtn
                  : t.deactivateBtn}
              </button>
            )}

            {(isCommentOwner || isAdmin) && (
              <button
                type="button"
                className="bookmark-btn"
                onClick={() => handleDeleteComment(comment.id)}
              >
                {t.deleteBtn}
              </button>
            )}
          </div>

          {replyingToId === comment.id && !isPostInactive && (
            <div className="inline-reply-form">
              {replyError && (
                <div className="modal-error-banner">{replyError}</div>
              )}
              <textarea
                className="reply-textarea"
                placeholder={t.replyPlaceholder}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <div className="reply-form-actions">
                <button
                  type="button"
                  className="ask-btn"
                  onClick={() => handleSubmitReply(comment.id)}
                >
                  {t.sendAnswerBtn}
                </button>
                <button
                  type="button"
                  className="bookmark-btn"
                  onClick={() => {
                    setReplyingToId(null);
                    setReplyError('');
                  }}
                >
                  {t.cancelBtn}
                </button>
              </div>
            </div>
          )}
        </div>

        {children.length > 0 && (
          <div className="comment-children">
            {children.map((child) => renderCommentNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="post-page-container">
      <div className="post-page-top-bar">
        <button
          type="button"
          className="ask-btn"
          onClick={() => dispatch(closePostPage())}
        >
          {t.backToQuestions}
        </button>

        <div className="post-owner-controls">
          {isPostOwner && (
            <button
              type="button"
              className="bookmark-btn"
              onClick={() =>
                dispatch(
                  openAskModal({
                    ...currentPost,
                    categories: currentPostCategories,
                  })
                )
              }
            >
              {t.editBtn}
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              className="bookmark-btn"
              onClick={() =>
                dispatch(
                  updateExistingPost({
                    postId: currentPost.id,
                    status:
                      currentPost.status === 'inactive' ? 'active' : 'inactive',
                  })
                )
              }
            >
              {currentPost.status === 'inactive'
                ? t.activateBtn
                : t.deactivateBtn}
            </button>
          )}

          {(isPostOwner || isAdmin) && (
            <button
              type="button"
              className="bookmark-btn"
              onClick={handleDeletePost}
            >
              {t.deleteBtn}
            </button>
          )}
        </div>
      </div>

      <article className="post-full-card">
        <div className="post-item-header">
          <div className="post-badges">
            <span
              className={`status-pill ${
                currentPost.status === 'inactive' ? 'inactive' : 'active'
              }`}
            >
              {currentPost.status === 'inactive'
                ? t.badgeInactive
                : t.badgeActive}
            </span>
            {currentPostCategories.map((cat, idx) => (
              <span
                key={cat.id || idx}
                className="post-cat-tag"
                onClick={() => {
                  if (cat.id) {
                    dispatch(closePostPage());
                    dispatch(setCategoryId(cat.id));
                  }
                }}
              >
                {typeof cat === 'object' ? cat.title : cat}
              </span>
            ))}
          </div>

          <span className="post-date">
            {t.publishedAtLabel}{' '}
            {formatDateTime(currentPost.publish_date, language)}
          </span>
        </div>

        <h1 className="post-full-title">{currentPost.title}</h1>

        <RichContent text={currentPost.content} language={language} />

        <div className="post-meta">
          <div
            className="post-author-chip"
            onClick={() =>
              dispatch(
                openUserProfile(
                  postAuthorObj && !postAuthorObj._notFound
                    ? postAuthorObj
                    : { id: postAuthorId, login: postAuthorName }
                )
              )
            }
            role="button"
            tabIndex={0}
            onKeyDown={(e) =>
              e.key === 'Enter' &&
              dispatch(
                openUserProfile(
                  postAuthorObj && !postAuthorObj._notFound
                    ? postAuthorObj
                    : { id: postAuthorId, login: postAuthorName }
                )
              )
            }
          >
            <div className="post-author-avatar">
              {postAuthorAvatar ? (
                <img src={postAuthorAvatar} alt={postAuthorName} />
              ) : (
                <span>{getInitials(postAuthorName)}</span>
              )}
            </div>
            <span className="post-author-name">{postAuthorName}</span>
          </div>

          <div className="post-actions-bar">
            <div className="vote-pill">
              <button
                type="button"
                className={`vote-btn ${
                  currentPostVote === 'like' ? 'active-up' : ''
                }`}
                onClick={() =>
                  user
                    ? dispatch(
                        votePost({ postId: currentPost.id, type: 'like' })
                      )
                    : dispatch(openAuthModal('login'))
                }
              >
                ▲
              </button>
              <span className="vote-score">{postScore}</span>
              <button
                type="button"
                className={`vote-btn ${
                  currentPostVote === 'dislike' ? 'active-down' : ''
                }`}
                onClick={() =>
                  user
                    ? dispatch(
                        votePost({ postId: currentPost.id, type: 'dislike' })
                      )
                    : dispatch(openAuthModal('login'))
                }
              >
                ▼
              </button>
            </div>

            {REACTION_TYPES.map((r) => {
              const count = Number(postReactionCounts?.[r.id] || 0);
              return (
                <button
                  key={r.id}
                  type="button"
                  className="reaction-chip"
                  onClick={() =>
                    dispatch(
                      toggleReaction({
                        postId: currentPost.id,
                        reactionId: r.id,
                        userId: bucketKey,
                      })
                    )
                  }
                >
                  {r.emoji} {count > 0 ? count : ''}
                </button>
              );
            })}

            <button
              type="button"
              className={`bookmark-btn ${isSaved ? 'active saved-glow' : ''}`}
              onClick={() =>
                dispatch(
                  toggleSavePost({ post: currentPost, userId: bucketKey })
                )
              }
            >
              {isSaved ? `★ ${t.savedBtn}` : `☆ ${t.saveBtn}`}
            </button>
          </div>
        </div>
      </article>

      <section className="comments-section-card">
        <div className="comments-header-bar">
          <h3>
            💬 {t.answersCountLabel} ({currentPostComments.length})
          </h3>
          <div className="comments-sort-wrap">
            <span>{t.sortByLikes}</span>
            <button
              type="button"
              className={`bookmark-btn ${
                commentSortOrder === 'asc' ? 'active' : ''
              }`}
              onClick={() => setCommentSortOrder('asc')}
            >
              {t.sortAsc}
            </button>
            <button
              type="button"
              className={`bookmark-btn ${
                commentSortOrder === 'desc' ? 'active' : ''
              }`}
              onClick={() => setCommentSortOrder('desc')}
            >
              {t.sortDesc}
            </button>
          </div>
        </div>

        {commentTree.length === 0 ? (
          <div className="feed-empty-state">{t.noAnswersYet}</div>
        ) : (
          <div className="comments-tree-list">
            {commentTree.map((node) => renderCommentNode(node, 0))}
          </div>
        )}

        {isPostInactive ? (
          <p className="feed-subtitle">{t.inactivePostNoCommentsNote}</p>
        ) : (
          <form
            className="bottom-answer-box"
            onSubmit={handleSubmitMainComment}
          >
            <div className="answer-box-toolbar">
              <span>{t.yourAnswerTitle}</span>
              <button
                type="button"
                className="bookmark-btn"
                onClick={() =>
                  setNewCommentText(
                    (prev) => `${prev}\n\`\`\`javascript\n// Code\n\`\`\`\n`
                  )
                }
              >
                &lt;/&gt; {t.insertCodeBtn}
              </button>
            </div>
            {commentError && (
              <div className="modal-error-banner">{commentError}</div>
            )}
            <textarea
              className="reply-textarea"
              placeholder={t.writeAnswerPlaceholder}
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
            />
            <button type="submit" className="ask-btn">
              {t.sendAnswerBtn}
            </button>
          </form>
        )}
      </section>
    </div>
  );
};

export default PostPage;
