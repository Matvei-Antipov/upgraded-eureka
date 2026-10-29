import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  loginUser,
  registerUser,
  requestPasswordReset,
  confirmPasswordReset,
  closeAuthModal,
  openAuthModal,
} from '../../store/authSlice';
import { showNotification } from '../../store/postsSlice';
import { translations } from '../../i18n/translations';
import './AuthModal.css';

const AuthModal = () => {
  const dispatch = useDispatch();
  const {
    isAuthModalOpen,
    authModalMode,
    status,
    error,
    resetToken,
    language,
  } = useSelector((state) => state.auth);

  const t = translations[language] || translations.uk;

  const [mode, setMode] = useState('login');
  const [login, setLogin] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (authModalMode) {
      setMode(authModalMode);
    }
    setLocalError('');
  }, [authModalMode, isAuthModalOpen]);

  useEffect(() => {
    if (resetToken) {
      setTokenInput(resetToken);
      setMode('reset-confirm');
    }
  }, [resetToken]);

  if (!isAuthModalOpen) return null;

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setLocalError('');
    dispatch(openAuthModal(nextMode));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    const cleanIdentifier = login.trim();
    if (!cleanIdentifier || !password) {
      setLocalError(t.fillAllFieldsError);
      return;
    }

    try {
      await dispatch(
        loginUser({
          loginOrEmail: cleanIdentifier,
          identifier: cleanIdentifier,
          login: cleanIdentifier,
          email: cleanIdentifier,
          password,
        })
      ).unwrap();

      dispatch(
        showNotification({
          message: t.loginSuccessToast,
          type: 'success',
        })
      );
      dispatch(closeAuthModal());
    } catch (err) {
      setLocalError(typeof err === 'string' ? err : t.loginFailedError);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!login.trim() || !email.trim() || !password) {
      setLocalError(t.fillAllFieldsError);
      return;
    }

    if (password.length < 6) {
      setLocalError(t.passwordTooShortError);
      return;
    }

    if (passwordConfirm && password !== passwordConfirm) {
      setLocalError(t.passwordsDoNotMatchError);
      return;
    }

    try {
      await dispatch(
        registerUser({
          login: login.trim(),
          full_name: fullName.trim() || login.trim(),
          fullName: fullName.trim() || login.trim(),
          email: email.trim(),
          password,
          password_confirmation: passwordConfirm || password,
          passwordConfirm: passwordConfirm || password,
        })
      ).unwrap();

      dispatch(
        showNotification({
          message: t.registerSuccessToast,
          type: 'success',
        })
      );
      dispatch(closeAuthModal());
    } catch (err) {
      setLocalError(typeof err === 'string' ? err : t.registerFailedError);
    }
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim()) {
      setLocalError(t.enterEmailError);
      return;
    }

    try {
      const res = await dispatch(requestPasswordReset(email.trim())).unwrap();
      if (res?.resetToken) {
        setTokenInput(res.resetToken);
      }
      dispatch(
        showNotification({
          message: t.resetLinkSentToast,
          type: 'success',
        })
      );
      setMode('reset-confirm');
    } catch (err) {
      setLocalError(typeof err === 'string' ? err : t.resetRequestFailedError);
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!tokenInput.trim() || !newPassword) {
      setLocalError(t.fillAllFieldsError);
      return;
    }

    try {
      await dispatch(
        confirmPasswordReset({
          token: tokenInput.trim(),
          newPassword,
        })
      ).unwrap();

      dispatch(
        showNotification({
          message: t.passwordChangedToast,
          type: 'success',
        })
      );
      setMode('login');
    } catch (err) {
      setLocalError(typeof err === 'string' ? err : t.resetConfirmFailedError);
    }
  };

  return (
    <div
      className="auth-modal-backdrop"
      onClick={() => dispatch(closeAuthModal())}
      role="presentation"
    >
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h2 className="auth-modal-title">
            {mode === 'login' && t.authLoginTitle}
            {mode === 'register' && t.authRegisterTitle}
            {(mode === 'reset' || mode === 'reset-confirm') && t.authResetTitle}
          </h2>
          <button
            type="button"
            className="auth-modal-close"
            onClick={() => dispatch(closeAuthModal())}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {(mode === 'login' || mode === 'register') && (
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
              onClick={() => switchMode('login')}
            >
              {t.loginBtn}
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
              onClick={() => switchMode('register')}
            >
              {t.registerBtn}
            </button>
          </div>
        )}

        {(localError || error) && (
          <div className="auth-error-banner">{localError || error}</div>
        )}

        {mode === 'login' && (
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="auth-field">
              <label className="auth-label">{t.loginOrEmailLabel}</label>
              <input
                type="text"
                className="auth-input"
                placeholder={t.loginInputPlaceholder}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">{t.passwordLabel}</label>
              <input
                type="password"
                className="auth-input"
                placeholder={t.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="auth-Reset-row">
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => switchMode('reset')}
              >
                {t.forgotPasswordLink}
              </button>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? t.processingBtn : t.submitLoginBtn}
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form className="auth-form" onSubmit={handleRegisterSubmit}>
            <div className="auth-field">
              <label className="auth-label">{t.loginLabel}</label>
              <input
                type="text"
                className="auth-input"
                placeholder={t.loginInputPlaceholder}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">{t.fullNameLabel}</label>
              <input
                type="text"
                className="auth-input"
                placeholder={t.fullNamePlaceholder}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">{t.emailLabel}</label>
              <input
                type="email"
                className="auth-input"
                placeholder={t.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">{t.passwordLabel}</label>
              <input
                type="password"
                className="auth-input"
                placeholder={t.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">{t.confirmPasswordLabel}</label>
              <input
                type="password"
                className="auth-input"
                placeholder={t.confirmPasswordPlaceholder}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? t.processingBtn : t.submitRegisterBtn}
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <form className="auth-form" onSubmit={handleRequestReset}>
            <p className="auth-reset-desc">{t.resetPasswordDesc}</p>
            <div className="auth-field">
              <label className="auth-label">{t.emailLabel}</label>
              <input
                type="email"
                className="auth-input"
                placeholder={t.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? t.processingBtn : t.sendResetLinkBtn}
            </button>

            <button
              type="button"
              className="auth-link-btn center"
              onClick={() => switchMode('login')}
            >
              {t.backToLoginLink}
            </button>
          </form>
        )}

        {mode === 'reset-confirm' && (
          <form className="auth-form" onSubmit={handleConfirmReset}>
            <div className="auth-field">
              <label className="auth-label">{t.resetTokenLabel}</label>
              <input
                type="text"
                className="auth-input"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">{t.newPasswordLabel}</label>
              <input
                type="password"
                className="auth-input"
                placeholder={t.passwordPlaceholder}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? t.processingBtn : t.confirmResetBtn}
            </button>

            <button
              type="button"
              className="auth-link-btn center"
              onClick={() => switchMode('login')}
            >
              {t.backToLoginLink}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthModal;