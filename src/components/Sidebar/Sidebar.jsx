import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchCategories,
  setCategoryId,
  setViewMode,
  closePostPage,
} from '../../store/postsSlice';
import { closeProfilePage } from '../../store/authSlice';
import { translations } from '../../i18n/translations';
import './Sidebar.css';

const Sidebar = () => {
  const dispatch = useDispatch();
  const language = useSelector((state) => state.auth.language);
  const categories = useSelector((state) => state.posts.categories);
  const selectedCategoryId = useSelector((state) => state.posts.categoryId);
  const viewMode = useSelector((state) => state.posts.viewMode);
  const savedPosts = useSelector((state) => state.posts.savedPosts);

  const t = translations[language] || translations.uk;
  const savedCount = Object.keys(savedPosts || {}).length;

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  const handleSectionClick = (mode) => {
    dispatch(closeProfilePage());
    dispatch(closePostPage());
    dispatch(setCategoryId(null));
    dispatch(setViewMode(mode));
  };

  const handleTopicClick = (catId) => {
    dispatch(closeProfilePage());
    dispatch(closePostPage());
    dispatch(setCategoryId(catId));
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <h3 className="sidebar-heading">{t.sectionsHeading}</h3>
        <nav className="sidebar-nav">
          <button
            type="button"
            className={`sidebar-item ${
              selectedCategoryId === null && viewMode === 'all' ? 'active' : ''
            }`}
            onClick={() => handleSectionClick('all')}
          >
            <span className="sidebar-icon">❖</span>
            <span>{t.allQuestions}</span>
          </button>

          <button
            type="button"
            className={`sidebar-item ${
              viewMode === 'popular' ? 'active' : ''
            }`}
            onClick={() => handleSectionClick('popular')}
          >
            <span className="sidebar-icon">↗</span>
            <span>{t.popular}</span>
          </button>

          <button
            type="button"
            className={`sidebar-item ${viewMode === 'new' ? 'active' : ''}`}
            onClick={() => handleSectionClick('new')}
          >
            <span className="sidebar-icon">🕒</span>
            <span>{t.newest}</span>
          </button>

          <button
            type="button"
            className={`sidebar-item ${viewMode === 'saved' ? 'active' : ''}`}
            onClick={() => handleSectionClick('saved')}
          >
            <span className="sidebar-icon">🔖</span>
            <span>{t.saved}</span>
            {savedCount > 0 && (
              <span className="sidebar-badge">{savedCount}</span>
            )}
          </button>

          <button
            type="button"
            className={`sidebar-item ${viewMode === 'stats' ? 'active' : ''}`}
            onClick={() => handleSectionClick('stats')}
          >
            <span className="sidebar-icon">📊</span>
            <span>{t.statistics}</span>
          </button>
        </nav>
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <h3 className="sidebar-heading">{t.topicsHeading}</h3>
        <nav className="sidebar-topics">
          <button
            type="button"
            className={`topic-item ${
              selectedCategoryId === null &&
              viewMode !== 'saved' &&
              viewMode !== 'stats'
                ? 'active'
                : ''
            }`}
            onClick={() => handleTopicClick(null)}
          >
            <span className="topic-item-title">{t.allTopics}</span>
            <span className="topic-item-desc">{t.allTopicsDesc}</span>
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`topic-item ${
                Number(selectedCategoryId) === Number(cat.id) ? 'active' : ''
              }`}
              onClick={() => handleTopicClick(cat.id)}
              title={cat.description || cat.title}
            >
              <span className="topic-item-title">{cat.title || cat.name}</span>
              {cat.description && (
                <span className="topic-item-desc">{cat.description}</span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;