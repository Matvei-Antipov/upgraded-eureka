import React from 'react';
import { useSelector } from 'react-redux';
import { translations } from '../../i18n/translations';
import './Footer.css';

const Footer = () => {
  const { language } = useSelector((state) => state.auth);
  const t = translations[language] || translations.uk;

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

        <div className="footer-copy-col">
          <p className="footer-copy">
            © {new Date().getFullYear()} {t.brandTitle}. {t.footerRights}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
