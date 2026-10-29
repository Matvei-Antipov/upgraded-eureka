import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchCategories,
  setCategoryId,
  setViewMode,
  setSortBy,
  setOrder,
  closePostPage,
} from '../../store/postsSlice';
import { closeProfilePage } from '../../store/authSlice';
import { translations } from '../../i18n/translations';
import './Sidebar.css';

const Sidebar = () => {
  const dispatch = useDispatch();
  const {
    categories,
    categoryId,
    viewMode,
    sortBy,
    savedPostsByUser,
  } = useSelector((state) => state.posts);
  const { user, language } = useSelector((state) => state.auth);
  const t = translations[language] || translations.uk;

  const bucketKey = String(user?.id || 'guest');
  const savedCount = Object.keys(savedPostsByUser?.[bucketKey] || {}).length;

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  const handleNavClick = (mode) => {
    dispatch(closeProfilePage());
    dispatch(closePostPage());
    if (mode === 'all' || mode === 'new') {
      dispatch(setViewMode(mode));
      dispatch(setSortBy('date'));
      dispatch(setOrder('DESC'));
    } else if (mode === 'popular') {
      dispatch(setViewMode('popular'));
      dispatch(setSortBy('likes'));
      dispatch(setOrder('DESC'));
    } else {
      dispatch(setViewMode(mode));
    }
  };

  const handleCategoryClick = (id) => {
    dispatch(closeProfilePage());
    dispatch(closePostPage());
    if (viewMode === 'saved' || viewMode === 'stats') {
      dispatch(setViewMode('all'));
    }
    if (id !== null && Number(categoryId) === Number(id)) {
      dispatch(setCategoryId(null));
    } else {
      dispatch(setCategoryId(id));
    }
  };

  return (
    <aside className="sidebar" aria-label={t.navSection}>
      <div className="sidebar-block">
        <h3 className="sidebar-heading">{t.navSection}</h3>
        <ul className="sidebar-nav">
          <li>
            <button
              type="button"
              className={`sidebar-item ${
                viewMode === 'all' && sortBy === 'date' && !categoryId
                  ? 'active'
                  : ''
              }`}
              onClick={() => {
                dispatch(setCategoryId(null));
                handleNavClick('all');
              }}
            >
              <span className="sidebar-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 12 12 17 22 12" />
                  <polyline points="2 17 12 22 22 17" />
                </svg>
              </span>
              <span className="sidebar-text">{t.navMain}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`sidebar-item ${
                sortBy === 'likes' &&
                viewMode !== 'saved' &&
                viewMode !== 'stats'
                  ? 'active'
                  : ''
              }`}
              onClick={() => handleNavClick('popular')}
            >
              <span className="sidebar-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </span>
              <span className="sidebar-text">{t.navPopular}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`sidebar-item ${viewMode === 'new' ? 'active' : ''}`}
              onClick={() => handleNavClick('new')}
            >
              <span className="sidebar-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 15.5 14" />
                </svg>
              </span>
              <span className="sidebar-text">{t.navNew}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`sidebar-item ${viewMode === 'saved' ? 'active' : ''}`}
              onClick={() => handleNavClick('saved')}
            >
              <span className="sidebar-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              <span className="sidebar-text">{t.navSaved}</span>
              {savedCount > 0 && (
                <span className="saved-count-badge has-items">
                  {savedCount}
                </span>
              )}
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`sidebar-item ${viewMode === 'stats' ? 'active' : ''}`}
              onClick={() => handleNavClick('stats')}
            >
              <span className="sidebar-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </span>
              <span className="sidebar-text">{t.navStats}</span>
            </button>
          </li>
        </ul>
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-block">
        <h3 className="sidebar-heading">{t.categoriesSection}</h3>
        <ul className="sidebar-categories">
          {categories.length === 0 ? (
            <li className="sidebar-empty">{t.noCategories}</li>
          ) : (
            categories.map((cat) => {
              const isCatActive = Number(categoryId) === Number(cat.id);
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    className={`sidebar-cat-btn ${isCatActive ? 'active' : ''}`}
                    onClick={() => handleCategoryClick(Number(cat.id))}
                    title={cat.description || cat.title || cat.name}
                  >
                    <span className="category-name">
                      {cat.title || cat.name}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
