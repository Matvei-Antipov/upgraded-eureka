import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setCategoryId, setSortBy } from '../../store/postsSlice';
import { translations } from '../../i18n/translations';
import './Footer.css';

const Footer = () => {
  const dispatch = useDispatch();
  const language = useSelector((state) => state.auth.language);
  const t = translations[language] || translations.uk;

  const handleQuickNav = (sortType) => {
    dispatch(setCategoryId(null));
    dispatch(setSortBy(sortType));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <a href="/" className="footer-logo">
              <span className="logo-icon">&lt;/&gt;</span>
              <span className="logo-text">{t.brand}</span>
            </a>
            <p className="footer-description">{t.footerDesc}</p>
          </div>

          <div className="footer-links-group">
            <div className="footer-column">
              <h4 className="footer-heading">{t.footerNav}</h4>
              <button
                type="button"
                className="footer-link-btn"
                onClick={() => handleQuickNav('date')}
              >
                {t.allQuestions}
              </button>
              <button
                type="button"
                className="footer-link-btn"
                onClick={() => handleQuickNav('likes')}
              >
                {t.popular}
              </button>
              <button
                type="button"
                className="footer-link-btn"
                onClick={() => handleQuickNav('date')}
              >
                {t.newest}
              </button>
            </div>

            <div className="footer-column">
              <h4 className="footer-heading">{t.footerPlatform}</h4>
              <a
                href="#about"
                className="footer-link"
                onClick={(e) => e.preventDefault()}
              >
                {t.footerAbout}
              </a>
              <a
                href="#rules"
                className="footer-link"
                onClick={(e) => e.preventDefault()}
              >
                {t.footerRules}
              </a>
              <a
                href="#api"
                className="footer-link"
                onClick={(e) => e.preventDefault()}
              >
                {t.footerApi}
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span className="footer-copyright">
            © {new Date().getFullYear()} {t.brand} (USOF). {t.footerRights}
          </span>
          <div className="footer-status">
            <span className="status-dot" />
            <span>{t.footerApiConnected}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;