import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import PostFeed from '../PostFeed/PostFeed';
import PostPage from '../PostPage/PostPage';
import ProfilePage from '../ProfilePage/ProfilePage';
import Footer from '../Footer/Footer';
import AskQuestionModal from '../AskQuestionModal/AskQuestionModal';
import AuthModal from '../AuthModal/AuthModal';
import {
  clearNotification,
  checkIncomingComments,
  clearCommentAlert,
  openPostPage,
  setHighlightedCommentId,
  checkApiHealth,
} from '../../store/postsSlice';
import {
  verifySession,
  getJwtSession,
  setResetTokenFromUrl,
  closeProfilePage,
} from '../../store/authSlice';
import { translations, translateMessage } from '../../i18n/translations';
import { COMMENT_POLL_INTERVAL_MS, TOAST_DURATION_MS } from '../../config';
import './MainPage.css';

const MainPage = () => {
  const dispatch = useDispatch();
  const {
    selectedPostId,
    notification,
    commentAlert,
  } = useSelector((state) => state.posts);
  const {
    isProfileOpen,
    user,
    language = 'uk',
  } = useSelector((state) => state.auth);
  const t = translations[language] || translations.uk;

  useEffect(() => {
    document.title = language === 'en' ? 'rozbir' : 'розбір';
  }, [language]);

  useEffect(() => {
    dispatch(verifySession());
    dispatch(checkApiHealth());

    const params = new URLSearchParams(window.location.search);
    const sharedPostId = params.get('post');
    if (sharedPostId && !Number.isNaN(Number(sharedPostId))) {
      dispatch(openPostPage(Number(sharedPostId)));
    }

    const pathMatch = window.location.pathname.match(
      /password-reset\/([a-zA-Z0-9_-]+)/
    );
    const tokenFromUrl =
      params.get('token') ||
      params.get('reset_token') ||
      params.get('resetToken') ||
      (pathMatch ? pathMatch[1] : '');
    if (tokenFromUrl) {
      dispatch(setResetTokenFromUrl(tokenFromUrl));
    }
  }, [dispatch]);

  useEffect(() => {
    const session = getJwtSession();
    if (
      session &&
      (!user ||
        Number(user.id) !== Number(session.userId) ||
        user.role !== session.role)
    ) {
      dispatch(verifySession());
    }
  }, [user, dispatch]);

  useEffect(() => {
    if (!notification) return undefined;
    const timer = setTimeout(() => {
      dispatch(clearNotification());
    }, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notification, dispatch]);

  useEffect(() => {
    if (!user) return undefined;
    dispatch(checkIncomingComments());
    const interval = setInterval(() => {
      dispatch(checkIncomingComments());
    }, COMMENT_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, dispatch]);

  const toastText = notification
    ? typeof notification === 'string'
      ? translateMessage(language, notification, notification)
      : translateMessage(language, notification.key, notification.detail || '')
    : '';

  const toastType =
    notification && typeof notification === 'object'
      ? notification.type || 'success'
      : 'success';

  const handleOpenAlertComment = () => {
    if (!commentAlert) return;
    dispatch(closeProfilePage());
    dispatch(openPostPage(commentAlert.postId));
    if (commentAlert.commentId) {
      dispatch(setHighlightedCommentId(commentAlert.commentId));
    }
    dispatch(clearCommentAlert());
  };

  return (
    <div className="app-wrapper">
      <Header />

      {notification && toastText && (
        <div className="toast-container" role="status" aria-live="polite">
          <div className={`toast-banner ${toastType}`}>
            <span className="toast-icon">
              {toastType === 'error' ? '⚠️' : '✓'}
            </span>
            <span className="toast-text">
              {toastText}
              {notification?.detail &&
              toastType === 'error' &&
              notification.detail !== toastText
                ? ` (${notification.detail})`
                : ''}
            </span>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => dispatch(clearNotification())}
              aria-label="Close notification"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {commentAlert && (
        <div className="comment-alert-container" role="alert">
          <div className="comment-alert-card">
            <div className="comment-alert-header">
              <strong>🔔 {t.newCommentAlertTitle}</strong>
              <button
                type="button"
                className="comment-alert-close"
                onClick={() => dispatch(clearCommentAlert())}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="comment-alert-body">
              <strong>{commentAlert.authorLogin}</strong>{' '}
              {t.commentedOnYourPost} «{commentAlert.postTitle}»
            </p>
            {commentAlert.content && (
              <p className="comment-alert-snippet">{commentAlert.content}</p>
            )}
            <button
              type="button"
              className="comment-alert-action"
              onClick={handleOpenAlertComment}
            >
              {t.viewCommentBtn}
            </button>
          </div>
        </div>
      )}

      <div className="main-container">
        <Sidebar />
        <main className="main-content-area">
          {isProfileOpen ? (
            <ProfilePage />
          ) : selectedPostId ? (
            <PostPage />
          ) : (
            <PostFeed />
          )}
        </main>
      </div>

      <AskQuestionModal />
      <AuthModal />
      <Footer />
    </div>
  );
};

export default MainPage;
