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
              <span className="sidebar-icon">❖</span>
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
              <span className="sidebar-icon">↗</span>
              <span className="sidebar-text">{t.navPopular}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`sidebar-item ${viewMode === 'new' ? 'active' : ''}`}
              onClick={() => handleNavClick('new')}
            >
              <span className="sidebar-icon">🕒</span>
              <span className="sidebar-text">{t.navNew}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`sidebar-item ${viewMode === 'saved' ? 'active' : ''}`}
              onClick={() => handleNavClick('saved')}
            >
              <span className="sidebar-icon">🔖</span>
              <span className="sidebar-text">{t.navSaved}</span>
              <span
                className={`saved-count-badge ${
                  savedCount > 0 ? 'has-items' : ''
                }`}
              >
                {savedCount}
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`sidebar-item ${viewMode === 'stats' ? 'active' : ''}`}
              onClick={() => handleNavClick('stats')}
            >
              <span className="sidebar-icon">📊</span>
              <span className="sidebar-text">{t.navStats}</span>
            </button>
          </li>
        </ul>
      </div>

      <div className="sidebar-block">
        <h3 className="sidebar-heading">{t.categoriesSection}</h3>
        <ul className="sidebar-categories">
          <li>
            <button
              type="button"
              className={`sidebar-cat-btn ${
                categoryId === null ? 'active' : ''
              }`}
              onClick={() => handleCategoryClick(null)}
            >
              <span className="category-name">{t.allCategories}</span>
            </button>
          </li>
          {categories.length === 0 ? (
            <li className="sidebar-empty">{t.noCategories}</li>
          ) : (
            categories.map((cat) => (
              <li key={cat.id}>
                <button
                  type="button"
                  className={`sidebar-cat-btn ${
                    Number(categoryId) === Number(cat.id) ? 'active' : ''
                  }`}
                  onClick={() => handleCategoryClick(Number(cat.id))}
                >
                  <span className="category-name">
                    {cat.title || cat.name}
                  </span>
                  {cat.description && (
                    <span className="category-desc">{cat.description}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
