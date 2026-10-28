import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  clearNotification,
  clearCommentAlert,
  setHighlightedCommentId,
  openPostPage,
  closePostPage,
  fetchPostDetails,
  silentFetchPostDetails,
  checkIncomingComments,
} from '../../store/postsSlice';
import {
  verifySession,
  fetchAllUsers,
  openProfilePage,
  openUserProfile,
  fetchUserById,
  closeProfilePage,
  setResetTokenFromUrl,
} from '../../store/authSlice';
import { translations } from '../../i18n/translations';
import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import PostFeed from '../PostFeed/PostFeed';
import PostPage from '../PostPage/PostPage';
import ProfilePage from '../ProfilePage/ProfilePage';
import AskQuestionModal from '../AskQuestionModal/AskQuestionModal';
import AuthModal from '../AuthModal/AuthModal';
import Footer from '../Footer/Footer';
import './MainPage.css';

const MainPage = () => {
  const dispatch = useDispatch();
  const selectedPostId = useSelector((state) => state.posts.selectedPostId);
  const postsCount = useSelector((state) => state.posts.items.length);
  const notification = useSelector((state) => state.posts.notification);
  const commentAlert = useSelector((state) => state.posts.commentAlert);
  const { user, usersMap, isProfilePageOpen, viewedUserProfile, language } =
    useSelector((state) => state.auth);
  const [isNotFound, setIsNotFound] = useState(false);

  const t = translations[language] || translations.uk;

  useEffect(() => {
    dispatch(verifySession());
  }, [dispatch]);

  // Мгновенная проверка новых комментариев при входе в аккаунт или загрузке постов
  useEffect(() => {
    if (user && postsCount > 0) {
      dispatch(checkIncomingComments());
    }
  }, [dispatch, user, postsCount]);

  // Фоновое обновление данных каждые 4 секунды без перезагрузки страницы
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch(fetchAllUsers());
      if (selectedPostId) {
        dispatch(silentFetchPostDetails(selectedPostId));
      }
      if (user) {
        dispatch(checkIncomingComments());
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [dispatch, selectedPostId, user]);

  useEffect(() => {
    const syncStateFromLocation = () => {
      const path = window.location.pathname;
      const postMatch = path.match(/^\/posts\/([^/]+)$/);
      const userMatch = path.match(/^\/users\/([^/]+)$/);
      const resetMatch = path.match(/^\/password-reset\/([^/]+)$/);

      if (path === '/' || path === '') {
        setIsNotFound(false);
        dispatch(closePostPage());
        dispatch(closeProfilePage());
      } else if (postMatch && postMatch[1]) {
        setIsNotFound(false);
        dispatch(closeProfilePage());
        dispatch(openPostPage(postMatch[1]));
      } else if (path === '/profile') {
        setIsNotFound(false);
        dispatch(closePostPage());
        dispatch(openProfilePage());
      } else if (userMatch && userMatch[1]) {
        setIsNotFound(false);
        dispatch(closePostPage());
        dispatch(fetchUserById(userMatch[1]));
        dispatch(
          openUserProfile({ id: userMatch[1], login: `User #${userMatch[1]}` })
        );
      } else if (resetMatch && resetMatch[1]) {
        setIsNotFound(false);
        dispatch(setResetTokenFromUrl(resetMatch[1]));
      } else {
        setIsNotFound(true);
      }
    };

    syncStateFromLocation();
    window.addEventListener('popstate', syncStateFromLocation);
    return () => window.removeEventListener('popstate', syncStateFromLocation);
  }, [dispatch]);

  useEffect(() => {
    if (isNotFound) return;
    let targetPath = '/';
    if (isProfilePageOpen) {
      targetPath = viewedUserProfile?.id
        ? `/users/${viewedUserProfile.id}`
        : '/profile';
    } else if (selectedPostId) {
      targetPath = `/posts/${selectedPostId}`;
    }

    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  }, [selectedPostId, isProfilePageOpen, viewedUserProfile, isNotFound]);

  useEffect(() => {
    if (!notification) return undefined;
    const timer = setTimeout(() => {
      dispatch(clearNotification());
    }, 3000);
    return () => clearTimeout(timer);
  }, [notification, dispatch]);

  const handleLeaveNotFound = () => {
    setIsNotFound(false);
    window.history.pushState({}, '', '/');
    dispatch(closePostPage());
    dispatch(closeProfilePage());
  };

  const formatCommentAlertTime = (dateValue) => {
    if (!dateValue) return t.justNow;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return t.justNow;
    const diffMs = Math.max(0, Date.now() - date.getTime());
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return t.justNow;
    if (diffMinutes < 60) return `${diffMinutes} ${t.minAgo}`;
    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours} ${t.hoursAgo}`;
  };

  const handleViewIncomingComment = () => {
    if (!commentAlert) return;
    const { postId, commentId } = commentAlert;
    dispatch(clearCommentAlert());
    dispatch(closeProfilePage());
    dispatch(setHighlightedCommentId(commentId));
    dispatch(openPostPage(postId));
    dispatch(fetchPostDetails(postId));
  };

  const alertAuthorName = commentAlert
    ? usersMap[commentAlert.authorId]?.login || commentAlert.authorLogin
    : '';

  return (
    <div className="app-container">
      <Header />
      <div className="main-layout">
        {isNotFound ? (
          <main className="content-area">
            <div style={{ textAlign: 'center', padding: '80px 16px' }}>
              <h1 style={{ fontSize: '36px', marginBottom: '12px' }}>
                {t.notFoundTitle}
              </h1>
              <p style={{ color: '#6b7280', marginBottom: '24px' }}>
                {t.notFoundSubtitle}
              </p>
              <button
                type="button"
                className="ask-btn"
                onClick={handleLeaveNotFound}
              >
                {t.backToFeedBtn}
              </button>
            </div>
          </main>
        ) : isProfilePageOpen ? (
          <main className="content-area">
            <ProfilePage />
          </main>
        ) : selectedPostId ? (
          <main className="content-area">
            <PostPage />
          </main>
        ) : (
          <>
            <Sidebar />
            <main className="content-area">
              <PostFeed />
            </main>
          </>
        )}
      </div>

      <AskQuestionModal />
      <AuthModal />

      {commentAlert && (
        <div className="comment-alert-toast" role="alert">
          <div className="comment-alert-top">
            <span className="comment-alert-title">
              {t.newCommentAlertTitle}
            </span>
            <button
              type="button"
              className="comment-alert-close"
              onClick={() => dispatch(clearCommentAlert())}
            >
              ✕
            </button>
          </div>
          <p className="comment-alert-body">
            <strong>@{alertAuthorName}</strong> {t.commentedOnYourPost}{' '}
            <strong>«{commentAlert.postTitle}»</strong> (
            {formatCommentAlertTime(commentAlert.publishDate)})
          </p>
          {commentAlert.content && (
            <p className="comment-alert-snippet">«{commentAlert.content}»</p>
          )}
          <div className="comment-alert-actions">
            <button
              type="button"
              className="comment-alert-view-btn"
              onClick={handleViewIncomingComment}
            >
              {t.viewCommentBtn}
            </button>
          </div>
        </div>
      )}

      {notification && (
        <div className="share-toast" role="status" aria-live="polite">
          <span>✓</span>
          <span>{notification.message}</span>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default MainPage;