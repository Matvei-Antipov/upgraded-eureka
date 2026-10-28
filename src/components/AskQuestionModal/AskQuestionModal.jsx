import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  closeAskModal,
  createNewPost,
  updateExistingPost,
  createCategory,
  openPostPage,
} from '../../store/postsSlice';
import { closeProfilePage } from '../../store/authSlice';
import { translations } from '../../i18n/translations';
import './AskQuestionModal.css';

const AskQuestionModal = () => {
  const dispatch = useDispatch();
  const { isAskModalOpen, editingPost, categories } = useSelector(
    (state) => state.posts
  );
  const { user, language } = useSelector((state) => state.auth);
  const t = translations[language] || translations.uk;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [status, setStatus] = useState('active');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatTitle, setNewCatTitle] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatError, setNewCatError] = useState('');

  useEffect(() => {
    if (editingPost) {
      setTitle(editingPost.title || '');
      setContent(editingPost.content || '');
      setStatus(editingPost.status || 'active');
      const existingCatIds = Array.isArray(editingPost.categories)
        ? editingPost.categories
            .map((c) => Number(typeof c === 'object' ? c.id : c))
            .filter(Boolean)
        : [];
      setSelectedCategories(existingCatIds);
    } else {
      setTitle('');
      setContent('');
      setStatus('active');
      setSelectedCategories([]);
    }
    setErrors({});
    setIsAddingCategory(false);
    setNewCatTitle('');
    setNewCatDesc('');
    setNewCatError('');
  }, [editingPost, isAskModalOpen]);

  if (!isAskModalOpen) return null;

  const isAdmin = user?.role === 'admin';
  const isAuthor =
    !editingPost ||
    Number(user?.id || user?.userId) === Number(editingPost?.author_id);

  const toggleCategory = (catId) => {
    const id = Number(catId);
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    if (errors.categories) {
      setErrors((prev) => ({ ...prev, categories: '' }));
    }
  };

  const handleCreateInlineCategory = async () => {
    if (!isAdmin) return;

    const trimmed = newCatTitle.trim();
    if (!trimmed) {
      setNewCatError(t.errNewCatReq);
      return;
    }
    if (trimmed.length < 2) {
      setNewCatError(t.errNewCatMin);
      return;
    }

    const exists = categories.some(
      (c) => (c.title || c.name || '').toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setNewCatError(t.errNewCatExists);
      return;
    }

    setNewCatError('');
    const resultAction = await dispatch(
      createCategory({
        title: trimmed,
        description: newCatDesc.trim() || `${trimmed}`,
      })
    );

    if (createCategory.fulfilled.match(resultAction)) {
      const created = resultAction.payload;
      setSelectedCategories((prev) => [...prev, Number(created.id)]);
      setNewCatTitle('');
      setNewCatDesc('');
      setIsAddingCategory(false);
      if (errors.categories) {
        setErrors((prev) => ({ ...prev, categories: '' }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (isAuthor) {
      if (!trimmedTitle) {
        newErrors.title = t.errTitleReq;
      } else if (trimmedTitle.length < 10) {
        newErrors.title = t.errTitleMin;
      } else if (trimmedTitle.length > 180) {
        newErrors.title = t.errTitleMax;
      }

      if (!trimmedContent) {
        newErrors.content = t.errContentReq;
      } else if (trimmedContent.length < 20) {
        newErrors.content = t.errContentMin;
      }
    }

    if (!editingPost && selectedCategories.length === 0) {
      newErrors.categories = t.errCategoryReq;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (editingPost) {
        await dispatch(
          updateExistingPost({
            postId: editingPost.id,
            title: isAuthor ? title.trim() : undefined,
            content: isAuthor ? content.trim() : undefined,
            status: isAdmin ? status : undefined,
            categories:
              selectedCategories.length > 0 ? selectedCategories : undefined,
          })
        );
      } else {
        const res = await dispatch(
          createNewPost({
            title: title.trim(),
            content: content.trim(),
            categories: selectedCategories,
          })
        );
        if (createNewPost.fulfilled.match(res)) {
          const createdId = res.payload?.createdPost?.id;
          if (createdId) {
            dispatch(closeProfilePage());
            dispatch(openPostPage(createdId));
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={() => dispatch(closeAskModal())}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {editingPost ? t.editQuestionModalTitle : t.newQuestionModalTitle}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => dispatch(closeAskModal())}
          >
            ✕
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label className="form-label" htmlFor="post-title-input">
              {t.questionTitleLabel}
            </label>
            <input
              id="post-title-input"
              type="text"
              disabled={!isAuthor}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors({ ...errors, title: '' });
              }}
              placeholder={t.questionTitlePlaceholder}
              className={`form-input ${errors.title ? 'has-error' : ''}`}
            />
            {errors.title && (
              <span className="field-error-text">{errors.title}</span>
            )}
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="post-content-textarea">
              {t.questionBodyLabel}
            </label>
            <textarea
              id="post-content-textarea"
              rows={5}
              disabled={!isAuthor}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (errors.content) setErrors({ ...errors, content: '' });
              }}
              placeholder={t.questionBodyPlaceholder}
              className={`form-textarea ${errors.content ? 'has-error' : ''}`}
            />
            {errors.content && (
              <span className="field-error-text">{errors.content}</span>
            )}
          </div>

          <div className="form-field">
            <div className="category-header-row">
              <span className="form-label">{t.topicsLabel}</span>
              {isAdmin && (
                <button
                  type="button"
                  className="add-new-cat-toggle"
                  onClick={() => {
                    setIsAddingCategory(!isAddingCategory);
                    setNewCatError('');
                  }}
                >
                  {isAddingCategory ? t.cancelBtn : t.createNewTopicBtn}
                </button>
              )}
            </div>

            {isAdmin && isAddingCategory && (
              <div className="inline-new-cat-box">
                <input
                  type="text"
                  value={newCatTitle}
                  onChange={(e) => setNewCatTitle(e.target.value)}
                  placeholder={t.newTopicTitlePlaceholder}
                  className="form-input"
                />
                <input
                  type="text"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder={t.newTopicDescPlaceholder}
                  className="form-input"
                />
                {newCatError && (
                  <span className="field-error-text">{newCatError}</span>
                )}
                <button
                  type="button"
                  className="create-cat-confirm-btn"
                  onClick={handleCreateInlineCategory}
                >
                  {t.addAndSelectTopicBtn}
                </button>
              </div>
            )}

            <div className="categories-Select-grid">
              {categories.map((cat) => {
                const isChecked = selectedCategories.includes(Number(cat.id));
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`category-choice-pill ${
                      isChecked ? 'selected' : ''
                    }`}
                    onClick={() => toggleCategory(cat.id)}
                    title={cat.description || cat.title}
                  >
                    {cat.title || cat.name}
                  </button>
                );
              })}
            </div>
            {errors.categories && (
              <span className="field-error-text">{errors.categories}</span>
            )}
          </div>

          {editingPost && isAdmin && (
            <div className="form-field">
              <label className="form-label" htmlFor="post-status-select">
                {t.adminStatusLabel}
              </label>
              <select
                id="post-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="form-input"
              >
                <option value="active">{t.statusActive} (active)</option>
                <option value="inactive">{t.statusInactive} (inactive)</option>
              </select>
            </div>
          )}

          <div className="modal-footer">
            <button
              type="button"
              className="modal-cancel-btn"
              onClick={() => dispatch(closeAskModal())}
            >
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              className="modal-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? t.savingText
                : editingPost
                ? t.saveQuestionChangesBtn
                : t.publishQuestionBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AskQuestionModal;