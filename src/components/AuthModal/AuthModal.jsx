import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  closeAuthModal,
  switchAuthMode,
  loginUser,
  registerUser,
  requestPasswordReset,
  confirmPasswordReset,
  clearAuthError,
} from '../../store/authSlice';
import { translations, translateMessage } from '../../i18n/translations';
import './AuthModal.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const AuthModal = () => {
  const dispatch = useDispatch();
  const {
    isAuthModalOpen,
    authModalMode,
    loading,
    error,
    registrationSuccess,
    resetSuccessKey,
    resetTokenFromUrl,
    language = 'uk',
  } = useSelector((state) => state.auth);
  const t = translations[language] || translations.uk;

  const [identifier, setIdentifier] = useState('');
  const [login, setLogin] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  const backdropMouseDownRef = useRef(false);

  useEffect(() => {
    setValidationError('');
    dispatch(clearAuthError());
  }, [authModalMode, isAuthModalOpen, dispatch]);

  useEffect(() => {
    if (resetTokenFromUrl) {
      setResetToken(resetTokenFromUrl);
    }
  }, [resetTokenFromUrl]);

  if (!isAuthModalOpen) return null;

  const handleBackdropMouseDown = (e) => {
    backdropMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleBackdropMouseUp = (e) => {
    if (backdropMouseDownRef.current && e.target === e.currentTarget) {
      dispatch(closeAuthModal());
    }
    backdropMouseDownRef.current = false;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    if (authModalMode === 'login') {
      if (!identifier.trim()) {
        setValidationError(t.fillAllFieldsError);
        return;
      }
      if (!password || password.length < 4) {
        setValidationError(t.passwordTooShortError);
        return;
      }
      dispatch(
        loginUser({
          identifier: identifier.trim(),
          login: identifier.trim(),
          email: identifier.trim(),
          password,
        })
      );
    } else if (authModalMode === 'register') {
      if (login.trim().length < 3) {
        setValidationError(t.loginTooShortError);
        return;
      }
      if (!EMAIL_RE.test(email.trim())) {
        setValidationError(t.invalidEmailError);
        return;
      }
      if (password.length < 6) {
        setValidationError(t.passwordTooShortError);
        return;
      }
      if (password !== passwordConfirmation) {
        setValidationError(t.passwordsDoNotMatchError);
        return;
      }
      setIdentifier(login.trim());
      dispatch(
        registerUser({
          login: login.trim(),
          email: email.trim(),
          fullName: fullName.trim() || login.trim(),
          password,
          passwordConfirmation,
        })
      );
    } else if (authModalMode === 'reset') {
      if (resetToken.trim()) {
        if (newPassword.length < 6) {
          setValidationError(t.passwordTooShortError);
          return;
        }
        if (newPassword !== confirmNewPassword) {
          setValidationError(t.passwordsDoNotMatchError);
          return;
        }
        const rawToken = resetToken.trim();
        const urlMatch = rawToken.match(/password-reset\/([a-zA-Z0-9_-]+)/);
        const cleanToken = urlMatch ? urlMatch[1] : rawToken;
        dispatch(
          confirmPasswordReset({ token: cleanToken, newPassword })
        );
      } else {
        if (!EMAIL_RE.test(email.trim())) {
          setValidationError(t.invalidEmailError);
          return;
        }
        dispatch(requestPasswordReset({ email: email.trim() }));
      }
    }
  };

  const serverErrorText = error
    ? typeof error === 'string'
      ? translateMessage(language, error, error)
      : `${translateMessage(language, error.key, t.actionFailedError)}${
          error.detail ? ` (${error.detail})` : ''
        }`
    : '';

  return (
    <div
      className="auth-modal-backdrop"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
      role="dialog"
      aria-modal="true"
    >
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab-btn ${
                authModalMode === 'login' ? 'active' : ''
              }`}
              onClick={() => dispatch(switchAuthMode('login'))}
            >
              {t.authLoginTab}
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${
                authModalMode === 'register' ? 'active' : ''
              }`}
              onClick={() => dispatch(switchAuthMode('register'))}
            >
              {t.authRegisterTab}
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${
                authModalMode === 'reset' ? 'active' : ''
              }`}
              onClick={() => dispatch(switchAuthMode('reset'))}
            >
              {t.authResetTab}
            </button>
          </div>
          <button
            type="button"
            className="auth-modal-close"
            onClick={() => dispatch(closeAuthModal())}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {registrationSuccess && (
            <div className="auth-success-banner">{t.registerSuccessToast}</div>
          )}

          {resetSuccessKey && (
            <div className="auth-success-banner">
              {translateMessage(language, resetSuccessKey)}
            </div>
          )}

          {(validationError || serverErrorText) && (
            <div className="auth-error-banner">
              {validationError || serverErrorText}
            </div>
          )}

          {authModalMode === 'login' && (
            <>
              <div className="auth-field">
                <label className="auth-label">{t.loginOrEmailLabel}</label>
                <input
                  type="text"
                  className="auth-input"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={t.loginInputPlaceholder}
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">{t.passwordLabel}</label>
                <input
                  type="password"
                  className="auth-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              <div className="auth-Reset-row">
                <button
                  type="button"
                  className="auth-link-btn"
                  onClick={() => dispatch(switchAuthMode('reset'))}
                >
                  {t.forgotPasswordLink}
                </button>
              </div>
            </>
          )}

          {authModalMode === 'register' && (
            <>
              <div className="auth-field">
                <label className="auth-label">{t.uniqueLoginLabel}</label>
                <input
                  type="text"
                  className="auth-input"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="dev_master"
                  autoComplete="username"
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">{t.fullNameLabel}</label>
                <input
                  type="text"
                  className="auth-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.fullNamePlaceholder}
                  autoComplete="name"
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">{t.emailLabel}</label>
                <input
                  type="email"
                  className="auth-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  autoComplete="email"
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">{t.passwordLabel}</label>
                <input
                  type="password"
                  className="auth-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  autoComplete="new-password"
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">{t.confirmPasswordLabel}</label>
                <input
                  type="password"
                  className="auth-input"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder={t.confirmPasswordPlaceholder}
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          {authModalMode === 'reset' && (
            <>
              <p className="auth-reset-desc">{t.resetPasswordDesc}</p>

              <div className="auth-field">
                <label className="auth-label">{t.emailLabel}</label>
                <input
                  type="email"
                  className="auth-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">{t.resetTokenLabel}</label>
                <input
                  type="text"
                  className="auth-input"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder={t.resetTokenPlaceholder}
                />
              </div>

              {resetToken.trim() && (
                <>
                  <div className="auth-field">
                    <label className="auth-label">{t.newPasswordLabel}</label>
                    <input
                      type="password"
                      className="auth-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t.passwordPlaceholder}
                    />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label">
                      {t.confirmNewPasswordLabel}
                    </label>
                    <input
                      type="password"
                      className="auth-input"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder={t.confirmPasswordPlaceholder}
                    />
                  </div>
                </>
              )}
            </>
          )}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading
              ? t.processingBtn
              : authModalMode === 'login'
              ? t.submitLoginBtn
              : authModalMode === 'register'
              ? t.submitRegisterBtn
              : resetToken.trim()
              ? t.confirmResetBtn
              : t.sendResetLinkBtn}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
