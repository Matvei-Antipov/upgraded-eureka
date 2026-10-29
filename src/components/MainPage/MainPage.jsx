import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import PostFeed from '../PostFeed/PostFeed';
import PostPage from '../PostPage/PostPage';
import ProfilePage from '../ProfilePage/ProfilePage';
import AuthModal from '../AuthModal/AuthModal';
import AskQuestionModal from '../AskQuestionModal/AskQuestionModal';
import Footer from '../Footer/Footer';
import {
  clearNotification,
  clearCommentAlert,
  checkIncomingComments,
  openPostPage,
  setHighlightedCommentId,
} from '../../store/postsSlice';
import {
  verifySession,
  setResetTokenFromUrl,
  closeProfilePage,
} from '../../store/authSlice';
import { translations } from '../../i18n/translations';
import './MainPage.css';

const MainPage = () => {
  const dispatch = useDispatch();
  const {
    selectedPostId,
    notification,
    commentAlert,
  } = useSelector((state) => state.posts);
  const { isProfileOpen, user, language } = useSelector((state) => state.auth);

  const t = translations[language] || translations.uk;

  useEffect(() => {
    dispatch(verifySession());

    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('resetToken') || params.get('token');
    if (resetToken) {
      dispatch(setResetTokenFromUrl(resetToken));
    }
  }, [dispatch]);

  useEffect(() => {
    if (!notification) return undefined;
    const timer = setTimeout(() => {
      dispatch(clearNotification());
    }, 3500);
    return () => clearTimeout(timer);
  }, [notification, dispatch]);

  useEffect(() => {
    if (!user) return undefined;
    dispatch(checkIncomingComments());
    const interval = setInterval(() => {
      dispatch(checkIncomingComments());
    }, 8000);
    return () => clearInterval(interval);
  }, [dispatch, user]);

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

      {notification && (
        <div className="toast-container" role="status" aria-live="polite">
          <div className={`toast-banner ${notification.type || 'success'}`}>
            <span className="toast-icon">
              {notification.type === 'error' ? '⚠️' : '✓'}
            </span>
            <span className="toast-text">{notification.message}</span>
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
              <strong>{t.newCommentAlertTitle}</strong>
              <button
                type="button"
                className="comment-alert-close"
                onClick={() => dispatch(clearCommentAlert())}
              >
                ✕
              </button>
            </div>
            <p className="comment-alert-body">
              <strong>{commentAlert.authorLogin}</strong>{' '}
              {t.commentedOnYourPost} «{commentAlert.postTitle}»:
            </p>
            <p className="comment-alert-snippet">{commentAlert.content}</p>
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

      <main className="main-container">
        <Sidebar />
        <div className="main-content-area">
          {isProfileOpen ? (
            <ProfilePage />
          ) : selectedPostId ? (
            <PostPage />
          ) : (
            <PostFeed />
          )}
        </div>
      </main>

      <AuthModal />
      <AskQuestionModal />
      <Footer />
    </div>
  );
};

export default MainPage;