import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setSearchQuery,
  setCategoryId,
  setViewMode,
  closePostPage,
} from '../../store/postsSlice';
import {
  openAuthModal,
  logoutUser,
  openProfilePage,
  closeProfilePage,
  setLanguage,
} from '../../store/authSlice';
import { translations } from '../../i18n/translations';
import { avatarUrl, getInitials } from '../../utils/format';
import './Header.css';

const Header = () => {
  const dispatch = useDispatch();
  const { searchQuery } = useSelector((state) => state.posts);
  const { user, isAuthenticated, language = 'uk' } = useSelector(
    (state) => state.auth
  );
  const t = translations[language] || translations.uk;
  const [imgFailed, setImgFailed] = useState(false);

  const handleLogoClick = () => {
    dispatch(closeProfilePage());
    dispatch(closePostPage());
    dispatch(setCategoryId(null));
    dispatch(setViewMode('all'));
  };

  const handleAvatarOrProfileClick = () => {
    if (isAuthenticated && user) {
      dispatch(closePostPage());
      dispatch(openProfilePage(null));
    } else {
      dispatch(openAuthModal('login'));
    }
  };

  const displayLogin =
    isAuthenticated && user ? user.login : t.guestName || 'Guest';
  const displayRole =
    isAuthenticated && user
      ? user.role === 'admin'
        ? t.roleAdmin
        : t.roleUser
      : t.guestRole;
  const resolvedAvatar =
    isAuthenticated && user && !imgFailed ? avatarUrl(user) : null;

  return (
    <header className="header">
      <div className="header-container">
        <div
          className="header-brand"
          onClick={handleLogoClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleLogoClick()}
        >
          <div className="brand-logo-box" aria-hidden="true">
            &lt;/&gt;
          </div>
          <div className="brand-text">
            <span className="brand-title">{t.brandTitle}</span>
            <span className="brand-subtitle">{t.brandSubtitle}</span>
          </div>
        </div>

        <div className="header-search">
          <svg
            className="search-icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => {
              dispatch(closeProfilePage());
              dispatch(closePostPage());
              dispatch(setSearchQuery(e.target.value));
            }}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => dispatch(setSearchQuery(''))}
              aria-label={t.clearSearch}
            >
              ✕
            </button>
          )}
        </div>

        <div className="header-actions">
          <div className="lang-switcher">
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

          <div
            className="user-profile-trigger"
            onClick={handleAvatarOrProfileClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleAvatarOrProfileClick()}
          >
            <div className="user-info-text">
              <span className="user-login">{displayLogin}</span>
              <span
                className={`user-role-badge ${
                  isAuthenticated && user?.role === 'admin' ? 'admin' : ''
                }`}
              >
                {displayRole}
              </span>
            </div>
            <div className="user-avatar" aria-label="User avatar">
              {resolvedAvatar ? (
                <img
                  src={resolvedAvatar}
                  alt={displayLogin}
                  className="user-avatar-img"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <span>{getInitials(displayLogin)}</span>
              )}
            </div>
          </div>

          {isAuthenticated && user ? (
            <div className="header-user-area">
              <button
                type="button"
                className="logout-btn"
                onClick={() => dispatch(logoutUser())}
              >
                {t.logoutBtn}
              </button>
            </div>
          ) : (
            <div className="header-guest-area">
              <button
                type="button"
                className="login-btn"
                onClick={() => dispatch(openAuthModal('login'))}
              >
                {t.loginBtn}
              </button>
              <button
                type="button"
                className="register-btn"
                onClick={() => dispatch(openAuthModal('register'))}
              >
                {t.registerBtn}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
