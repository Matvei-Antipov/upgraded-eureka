import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setViewMode,
  setCategoryId,
  closePostPage,
  openAskModal,
  showNotification,
} from '../../store/postsSlice';
import { closeProfilePage, openAuthModal } from '../../store/authSlice';
import { translations } from '../../i18n/translations';
import './Footer.css';

const Footer = () => {
  const dispatch = useDispatch();
  const { user, language } = useSelector((state) => state.auth);
  const { apiConnected } = useSelector((state) => state.posts);
  const t = translations[language] || translations.uk;

  const handleNav = (mode) => {
    dispatch(closeProfilePage());
    dispatch(closePostPage());
    dispatch(setCategoryId(null));
    dispatch(setViewMode(mode));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAsk = () => {
    if (!user) {
      dispatch(showNotification('authRequiredToast'));
      dispatch(openAuthModal('login'));
      return;
    }
    dispatch(openAskModal(null));
  };

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand-col">
          <div className="footer-brand">
            <span className="footer-logo-box">{'</>'}</span>
            <span className="footer-brand-title">{t.brandTitle}</span>
          </div>
          <p className="footer-desc">{t.footerDesc}</p>
        </div>

        <div className="footer-links-col">
          <h4 className="footer-heading">{t.footerNav}</h4>
          <ul className="footer-links">
            <li>
              <button
                type="button"
                className="footer-link-btn"
                onClick={() => handleNav('all')}
              >
                {t.footerAllQuestions}
              </button>
            </li>
            <li>
              <button
                type="button"
                className="footer-link-btn"
                onClick={() => handleNav('popular')}
              >
                {t.footerPopular}
              </button>
            </li>
            <li>
              <button
                type="button"
                className="footer-link-btn"
                onClick={handleAsk}
              >
                {t.footerAsk}
              </button>
            </li>
          </ul>
        </div>

        <div className="footer-status-col">
          <h4 className="footer-heading">{t.footerSystem}</h4>
          <div className="footer-status-badge">
            <span
              className={`status-dot ${apiConnected ? '' : 'offline'}`}
            />
            <span>
              {apiConnected ? t.footerApiConnected : t.footerApiDisconnected}
            </span>
          </div>
          <p className="footer-copy">
            © {new Date().getFullYear()} {t.brandTitle}. {t.footerRights}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
