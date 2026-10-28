import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setSearchQuery,
  fetchPosts,
  closePostPage,
  setViewMode,
} from '../../store/postsSlice';
import {
  setLanguage,
  logoutUser,
  openAuthModal,
  openProfilePage,
  closeProfilePage,
} from '../../store/authSlice';
import { translations } from '../../i18n/translations';
import './Header.css';

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

const getInitials = (fullName, login) => {
  const source = String(fullName || login || 'US').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
};

const Header = () => {
  const dispatch = useDispatch();
  const { user, language, isProfilePageOpen } = useSelector(
    (state) => state.auth
  );
  const searchQuery = useSelector((state) => state.posts.searchQuery);
  const selectedPostId = useSelector((state) => state.posts.selectedPostId);
  const [searchError, setSearchError] = useState('');
  const [failedAvatarSrc, setFailedAvatarSrc] = useState(null);
  const imgRef = useRef(null);

  const t = translations[language] || translations.uk;

  const rawAvatar = user?.profile_picture || user?.avatar || null;
  const avatarUrl = resolveAvatarUrl(rawAvatar);
  const shouldShowImage = Boolean(avatarUrl && failedAvatarSrc !== avatarUrl);

  useEffect(() => {
    if (
      imgRef.current &&
      imgRef.current.complete &&
      imgRef.current.naturalWidth === 0 &&
      avatarUrl
    ) {
      setFailedAvatarSrc(avatarUrl);
    }
  }, [avatarUrl]);

  const handleGoToFeed = (e) => {
    if (e) e.preventDefault();
    dispatch(closeProfilePage());
    dispatch(closePostPage());
    dispatch(setViewMode('popular'));
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    if (value.length > 100) {
      setSearchError(t.searchMaxError);
      return;
    }
    setSearchError('');
    dispatch(setSearchQuery(value));
    if (selectedPostId) dispatch(closePostPage());
    if (isProfilePageOpen) dispatch(closeProfilePage());
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim().length === 1) {
      setSearchError(t.searchMinError);
      return;
    }
    setSearchError('');
    dispatch(closeProfilePage());
    if (selectedPostId) {
      dispatch(closePostPage());
    }
    dispatch(fetchPosts());
  };

  const handleAvatarOrProfileClick = () => {
    if (!user) {
      dispatch(openAuthModal('login'));
    } else {
      dispatch(openProfilePage());
    }
  };

  const displayLogin = user?.login || user?.full_name || t.guestName;
  const displayFullName = user?.full_name || user?.fullName || displayLogin;
  const isAdmin = user?.role === 'admin';
  const roleLabel = isAdmin
    ? t.roleAdmin
    : user
    ? t.roleUser
    : t.roleGuest;

  const initials = user ? getInitials(displayFullName, displayLogin) : 'ГС';

  return (
    <header className="header">
      <div className="header-inner">
        <a href="/" className="header-logo" onClick={handleGoToFeed}>
          <span className="logo-icon">&lt;/&gt;</span>
          <span className="logo-text">{t.brand}</span>
        </a>

        {/* Крок 7.2: Пошуковий рядок завжди присутній у Header на всіх сторінках */}
        <form
          className="header-search-wrapper"
          onSubmit={handleSearchSubmit}
          noValidate
        >
          <div className="header-search">
            <span className="search-icon" aria-hidden="true">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchPlaceholder}
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => {
                  setSearchError('');
                  dispatch(setSearchQuery(''));
                  dispatch(fetchPosts());
                }}
              >
                ✕
              </button>
            )}
          </div>
          {searchError && (
            <span className="input-error-msg">{searchError}</span>
          )}
        </form>

        <div className="header-user-section">
          <div className="lang-toggle-pill" role="group" aria-label="Language">
            <button
              type="button"
              className={`lang-btn ${language === 'uk' ? 'active' : ''}`}
              onClick={() => dispatch(setLanguage('uk'))}
            >
              UA
            </button>
            <button
              type="button"
              className={`lang-btn ${language === 'en' ? 'active' : ''}`}
              onClick={() => dispatch(setLanguage('en'))}
            >
              EN
            </button>
          </div>

          <button
            type="button"
            className={`feed-nav-link ${
              selectedPostId || isProfilePageOpen ? 'highlighted' : ''
            }`}
            onClick={handleGoToFeed}
          >
            {t.feedNav}
          </button>

          <div
            className="user-details"
            onClick={handleAvatarOrProfileClick}
            style={{ cursor: 'pointer' }}
          >
            <span className="user-login">{displayLogin}</span>
            <span
              className={`user-role-pill ${
                isAdmin ? 'admin' : user ? 'user' : 'guest'
              }`}
            >
              {roleLabel}
            </span>
          </div>

          <button
            type="button"
            className="avatar-btn"
            onClick={handleAvatarOrProfileClick}
            title={displayFullName}
          >
            {shouldShowImage ? (
              <img
                ref={imgRef}
                src={avatarUrl}
                alt={displayLogin}
                className="avatar-img"
                onError={() => setFailedAvatarSrc(avatarUrl)}
              />
            ) : (
              <span>{initials}</span>
            )}
          </button>

          {user ? (
            <button
              type="button"
              className="logout-btn"
              onClick={() => dispatch(logoutUser())}
            >
              {t.logoutBtn}
            </button>
          ) : (
            <button
              type="button"
              className="logout-btn"
              onClick={() => dispatch(openAuthModal('login'))}
            >
              {t.loginBtn}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;