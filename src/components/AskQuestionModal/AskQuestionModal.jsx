import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  closeAskModal,
  createNewPost,
  updateExistingPost,
} from '../../store/postsSlice';
import { translations } from '../../i18n/translations';
import './AskQuestionModal.css';

const AskQuestionModal = () => {
  const dispatch = useDispatch();
  const { isAskModalOpen, editingPost, categories } = useSelector(
    (state) => state.posts
  );
  const { language } = useSelector((state) => state.auth);
  const t = translations[language] || translations.uk;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const overlayMouseDownRef = useRef(false);

  useEffect(() => {
    setLocalError('');
    if (editingPost) {
      setTitle(editingPost.title || '');
      setContent(editingPost.content || '');
      const initialCats = Array.isArray(editingPost.categories)
        ? editingPost.categories.map((c) =>
            Number(typeof c === 'object' ? c.id : c)
          )
        : [];
      setSelectedCategoryIds(initialCats);
    } else {
      setTitle('');
      setContent('');
      setSelectedCategoryIds(
        categories[0]?.id ? [Number(categories[0].id)] : []
      );
    }
  }, [editingPost, categories, isAskModalOpen]);

  if (!isAskModalOpen) return null;

  const handleOverlayMouseDown = (e) => {
    overlayMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleOverlayMouseUp = (e) => {
    if (overlayMouseDownRef.current && e.target === e.currentTarget) {
      dispatch(closeAskModal());
    }
    overlayMouseDownRef.current = false;
  };

  const handleCategoryToggle = (catId) => {
    const numId = Number(catId);
    setSelectedCategoryIds((prev) =>
      prev.includes(numId)
        ? prev.filter((id) => id !== numId)
        : [...prev, numId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (cleanTitle.length < 3) {
      setLocalError(
        t.titleTooShortError ||
          'Заголовок має містити щонайменше 3 символи.'
      );
      return;
    }

    if (cleanContent.length < 5) {
      setLocalError(
        t.contentTooShortError ||
          'Опис питання має містити щонайменше 5 символів.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingPost && editingPost.id) {
        await dispatch(
          updateExistingPost({
            postId: editingPost.id,
            title: cleanTitle,
            content: cleanContent,
            categories: selectedCategoryIds,
          })
        ).unwrap();
      } else {
        await dispatch(
          createNewPost({
            title: cleanTitle,
            content: cleanContent,
            categories: selectedCategoryIds,
          })
        ).unwrap();
      }
      dispatch(closeAskModal());
    } catch (err) {
      setLocalError(
        typeof err === 'string'
          ? err
          : 'Помилка збереження питання'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {editingPost
              ? t.editModalTitle || 'Редагувати питання'
              : t.askModalTitle || 'Поставити нове питання'}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => dispatch(closeAskModal())}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {localError && (
              <div className="modal-error-banner">{localError}</div>
            )}

            <div className="modal-field">
              <label className="modal-label" htmlFor="question-title-input">
                {t.questionTitleLabel || 'Заголовок питання'}
              </label>
              <input
                id="question-title-input"
                type="text"
                className="modal-input"
                placeholder={
                  t.questionTitlePlaceholder ||
                  'Наприклад: Як налаштувати індекси в PostgreSQL?'
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
                required
              />
            </div>

            <div className="modal-field">
              <label
                className="modal-label"
                htmlFor="question-content-textarea"
              >
                {t.questionContentLabel || 'Детальний опис проблеми або код'}
              </label>
              <textarea
                id="question-content-textarea"
                className="modal-textarea"
                placeholder={
                  t.questionContentPlaceholder ||
                  'Детально опишіть вашу проблему або додайте фрагмент коду...'
                }
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>

            <div className="modal-categories-section">
              <span className="modal-label">
                {t.selectCategoriesLabel || 'Категорії (теми питання)'}
              </span>
              <div className="modal-categories-list">
                {categories.map((cat) => {
                  const isChecked = selectedCategoryIds.includes(
                    Number(cat.id)
                  );
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`category-pill-btn ${
                        isChecked ? 'checked' : ''
                      }`}
                      onClick={() => handleCategoryToggle(cat.id)}
                    >
                      <span>{isChecked ? '✓ ' : ''}</span>
                      <span>{cat.title || cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="modal-cancel-btn"
              onClick={() => dispatch(closeAskModal())}
              disabled={isSubmitting}
            >
              {t.cancelBtn || 'Скасувати'}
            </button>
            <button
              type="submit"
              className="modal-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? t.savingBtn || 'Збереження...'
                : editingPost
                ? t.saveChangesBtn || 'Зберегти зміни'
                : t.publishBtn || 'Опублікувати питання'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AskQuestionModal;