import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  logoutUser,
  openAuthModal,
  openProfilePage,
  closeProfilePage,
  setLanguage,
} from '../../store/authSlice';
import {
  setSearchQuery,
  closePostPage,
  setCategoryId,
  setViewMode,
} from '../../store/postsSlice';
import { translations } from '../../i18n/translations';
import './Header.css';

const Header = () => {
  const dispatch = useDispatch();
  const { user, avatarUrl, language } = useSelector((state) => state.auth);
  const { searchQuery } = useSelector((state) => state.posts);

  const t = translations[language] || translations.uk;

  const handleLogoClick = () => {
    dispatch(closeProfilePage());
    dispatch(closePostPage());
    dispatch(setCategoryId(null));
    dispatch(setViewMode('all'));
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/[\s_]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="header">
      <div className="header-container">
        <div
          className="header-brand"
          onClick={handleLogoClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleLogoClick();
          }}
        >
          <div className="brand-logo-box">{'</>'}</div>
          <div className="brand-text">
            <span className="brand-title">{t.brandTitle || 'розбір'}</span>
            <span className="brand-subtitle">{t.brandSubtitle}</span>
          </div>
        </div>

        <div className="header-search">
          <span className="search-icon" aria-hidden="true">
            🔍
          </span>
          <input
            type="text"
            className="search-input"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => dispatch(setSearchQuery(e.target.value))}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              title={t.clearSearch}
              onClick={() => dispatch(setSearchQuery(''))}
            >
              ✕
            </button>
          )}
        </div>

        <div className="header-actions">
          <div className="lang-switcher" role="group" aria-label="Language">
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

          {user ? (
            <div className="header-user-area">
              <div
                className="user-profile-trigger"
                onClick={() => dispatch(openProfilePage())}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    dispatch(openProfilePage());
                  }
                }}
              >
                <div className="user-info-text">
                  <span className="user-login">
                    {user.login || user.full_name || t.guestName}
                  </span>
                  <span
                    className={`user-role-badge ${
                      user.role === 'admin' ? 'admin' : 'user'
                    }`}
                  >
                    {user.role === 'admin' ? t.roleAdmin : t.roleUser}
                  </span>
                </div>
                <div className="user-avatar">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={user.login || 'avatar'}
                      className="user-avatar-img"
                    />
                  ) : (
                    <span>{getInitials(user.login || user.full_name)}</span>
                  )}
                </div>
              </div>

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
              <span className="guest-badge">{t.guestRole}</span>
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