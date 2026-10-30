import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  closeAskModal,
  createNewPost,
  updateExistingPost,
} from '../../store/postsSlice';
import { translations, translateMessage } from '../../i18n/translations';
import { MAX_INLINE_IMAGE_CHARS, MAX_TEXT_BYTES } from '../../config';
import { byteLength } from '../../utils/format';
import './AskQuestionModal.css';

const DRAFT_STORAGE_KEY = 'usof_question_draft_v1';

const compressImageFileToDataUrl = (file, maxWidth = 1200, quality = 0.8) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const AskQuestionModal = () => {
  const dispatch = useDispatch();
  const {
    isAskModalOpen,
    editingPost,
    categories = [],
    previewCategoriesByPost = {},
    currentPostCategories = [],
  } = useSelector((state) => state.posts);
  const { language = 'uk' } = useSelector((state) => state.auth);
  const t = translations[language] || translations.uk;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(false);
  const [showImageUrlBox, setShowImageUrlBox] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');

  const overlayMouseDownRef = useRef(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isAskModalOpen) return;
    setLocalError('');
    setShowImageUrlBox(false);
    setImageUrlInput('');

    if (editingPost) {
      setTitle(editingPost.title || '');
      setContent(editingPost.content || '');
      const rawCats =
        (Array.isArray(editingPost.categories) &&
          editingPost.categories.length > 0 &&
          editingPost.categories) ||
        previewCategoriesByPost[editingPost.id] ||
        currentPostCategories ||
        [];
      const initialCats = rawCats
        .map((c) => {
          if (typeof c === 'object') return Number(c.id);
          const found = categories.find(
            (cat) => String(cat.title).toLowerCase() === String(c).toLowerCase()
          );
          return found ? Number(found.id) : Number(c);
        })
        .filter((n) => !Number.isNaN(n) && n > 0);
      setSelectedCategoryIds(initialCats);
      setDraftSavedAt(false);
    } else {
      try {
        const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (rawDraft) {
          const parsed = JSON.parse(rawDraft);
          setTitle(parsed.title || '');
          setContent(parsed.content || '');
          if (
            Array.isArray(parsed.selectedCategoryIds) &&
            parsed.selectedCategoryIds.length > 0
          ) {
            setSelectedCategoryIds(parsed.selectedCategoryIds.map(Number));
          } else {
            setSelectedCategoryIds(
              categories[0]?.id ? [Number(categories[0].id)] : []
            );
          }
          setDraftSavedAt(Boolean(parsed.title || parsed.content));
          return;
        }
      } catch {}
      setTitle('');
      setContent('');
      setSelectedCategoryIds(
        categories[0]?.id ? [Number(categories[0].id)] : []
      );
      setDraftSavedAt(false);
    }
  }, [
    editingPost,
    categories,
    previewCategoriesByPost,
    currentPostCategories,
    isAskModalOpen,
  ]);

  useEffect(() => {
    if (!isAskModalOpen || editingPost) return;
    try {
      if (title.trim() || content.trim()) {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            title,
            content,
            selectedCategoryIds,
          })
        );
        setDraftSavedAt(true);
      } else {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setDraftSavedAt(false);
      }
    } catch {}
  }, [title, content, selectedCategoryIds, isAskModalOpen, editingPost]);

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
    if (editingPost) return;
    const numId = Number(catId);
    setSelectedCategoryIds((prev) =>
      prev.includes(numId)
        ? prev.filter((id) => id !== numId)
        : [...prev, numId]
    );
  };

  const handleClearDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setTitle('');
    setContent('');
    setSelectedCategoryIds(categories[0]?.id ? [Number(categories[0].id)] : []);
    setDraftSavedAt(false);
  };

  const handleInsertCodeBlock = () => {
    const snippet = `\n\`\`\`javascript\n// Code\nconsole.log('Hello USOF');\n\`\`\`\n`;
    setContent((prev) => `${prev}${snippet}`);
  };

  const handleImageFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalError('');
    if (file.size > 2.5 * 1024 * 1024) {
      setLocalError(t.imageTooLargeError);
      e.target.value = '';
      return;
    }
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      if (dataUrl.length > MAX_INLINE_IMAGE_CHARS) {
        setLocalError(t.imageTooLargeError);
        return;
      }
      const markdownImage = `\n![${file.name || 'screenshot'}](${dataUrl})\n`;
      if (byteLength(`${content}${markdownImage}`) > MAX_TEXT_BYTES) {
        setLocalError(t.imageTooLargeError);
        return;
      }
      setContent((prev) => `${prev}${markdownImage}`);
    } catch {
      setLocalError(t.imageProcessError);
    } finally {
      e.target.value = '';
    }
  };

  const handleInsertImageUrl = () => {
    const cleanUrl = imageUrlInput.trim();
    if (!cleanUrl) return;
    const markdownImage = `\n![image](${cleanUrl})\n`;
    setContent((prev) => `${prev}${markdownImage}`);
    setImageUrlInput('');
    setShowImageUrlBox(false);
  };

  const attachedImages = Array.from(
    content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g),
    (m) => ({ fullMatch: m[0], alt: m[1] || 'image', src: m[2] })
  );

  const handleRemoveAttachedImage = (fullMatch) => {
    setContent((prev) => prev.replace(fullMatch, '').trim());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (cleanTitle.length < 5) {
      setLocalError(t.titleTooShortError);
      return;
    }

    if (cleanContent.length < 10) {
      setLocalError(t.contentTooShortError);
      return;
    }

    if (byteLength(cleanContent) > MAX_TEXT_BYTES) {
      setLocalError(t.imageTooLargeError);
      return;
    }

    if (!editingPost && selectedCategoryIds.length === 0) {
      setLocalError(t.selectAtLeastOneCategoryError);
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
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
      dispatch(closeAskModal());
    } catch (err) {
      const msgKey = err?.key || (typeof err === 'string' ? err : '');
      setLocalError(
        err?.detail || translateMessage(language, msgKey, t.actionFailedError)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <h2 className="modal-title">
              {editingPost ? t.editModalTitle : t.askModalTitle}
            </h2>
            {!editingPost && draftSavedAt && (
              <div className="draft-status-bar">
                <span className="draft-saved-badge">
                  💾 {t.draftSavedBadge}
                </span>
                <button
                  type="button"
                  className="draft-clear-btn"
                  onClick={handleClearDraft}
                >
                  {t.clearDraftBtn}
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => dispatch(closeAskModal())}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            {localError && (
              <div className="modal-error-banner">{localError}</div>
            )}

            <div className="modal-field">
              <label className="modal-label" htmlFor="question-title-input">
                {t.questionTitleLabel}
              </label>
              <input
                id="question-title-input"
                type="text"
                className="modal-input"
                placeholder={t.questionTitlePlaceholder}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
                required
              />
            </div>

            <div className="modal-field">
              <div className="modal-editor-header">
                <label
                  className="modal-label"
                  htmlFor="question-content-textarea"
                >
                  {t.questionContentLabel}
                </label>

                <div className="modal-editor-toolbar">
                  <button
                    type="button"
                    className="editor-tool-btn"
                    onClick={handleInsertCodeBlock}
                  >
                    &lt;/&gt; {t.codeBlockBtn}
                  </button>

                  <button
                    type="button"
                    className="editor-tool-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    🖼️ {t.uploadImageBtn}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileUpload}
                    hidden
                  />

                  <button
                    type="button"
                    className="editor-tool-btn"
                    onClick={() => setShowImageUrlBox((prev) => !prev)}
                  >
                    🔗 {t.imageUrlBtn}
                  </button>
                </div>
              </div>

              {showImageUrlBox && (
                <div className="editor-url-popover">
                  <input
                    type="url"
                    className="modal-input compact"
                    placeholder="https://example.com/screenshot.png"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                  />
                  <button
                    type="button"
                    className="editor-url-insert-btn"
                    onClick={handleInsertImageUrl}
                  >
                    {t.insertBtn}
                  </button>
                </div>
              )}

              <textarea
                id="question-content-textarea"
                className="modal-textarea"
                placeholder={t.questionContentPlaceholder}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />

              {attachedImages.length > 0 && (
                <div className="modal-attached-images">
                  {attachedImages.map((img, idx) => (
                    <div
                      key={`${img.alt}-${idx}`}
                      className="modal-image-thumb"
                    >
                      <img src={img.src} alt={img.alt} />
                      <button
                        type="button"
                        className="modal-image-remove"
                        onClick={() => handleRemoveAttachedImage(img.fullMatch)}
                        title={t.removeImageTitle}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-categories-section">
              <span className="modal-label">
                {editingPost
                  ? t.categoriesReadonlyHint
                  : t.selectCategoriesLabel}
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
                      disabled={Boolean(editingPost)}
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
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              className="modal-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? t.savingBtn
                : editingPost
                ? t.saveChangesBtn
                : t.publishBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AskQuestionModal;
