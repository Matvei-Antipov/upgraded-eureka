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
import { translations } from '../../i18n/translations';
import './AuthModal.css';

const AuthModal = () => {
  const dispatch = useDispatch();
  const {
    isAuthModalOpen,
    authModalMode,
    loading,
    error,
    registrationSuccess,
    resetSuccessMessage,
  } = useSelector((state) => state.auth);
  const currentLanguage = useSelector((state) => state.posts?.language || 'uk');
  const t = translations[currentLanguage] || translations.uk;

  const [identifier, setIdentifier] = useState('');
  const [login, setLogin] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  // Защита от закрытия модального окна при выделении текста мышкой внутри инпутов
  const backdropMouseDownRef = useRef(false);

  useEffect(() => {
    setValidationError('');
    dispatch(clearAuthError());
  }, [authModalMode, isAuthModalOpen, dispatch]);

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
        setValidationError(
          currentLanguage === 'en' ? 'Enter your login or email' : 'Введіть логін або email'
        );
        return;
      }
      if (!password || password.length < 4) {
        setValidationError(
          currentLanguage === 'en'
            ? 'Password must be at least 4 characters'
            : 'Пароль має містити щонайменше 4 символи'
        );
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
        setValidationError(
          currentLanguage === 'en'
            ? 'Login must be at least 3 characters'
            : 'Логін має містити щонайменше 3 символи'
        );
        return;
      }
      if (!email.includes('@')) {
        setValidationError(
          currentLanguage === 'en' ? 'Enter a valid email' : 'Введіть коректний email'
        );
        return;
      }
      if (password.length < 6) {
        setValidationError(
          currentLanguage === 'en'
            ? 'Password must be at least 6 characters'
            : 'Пароль має містити щонайменше 6 символів'
        );
        return;
      }
      if (password !== passwordConfirmation) {
        setValidationError(
          currentLanguage === 'en' ? 'Passwords do not match' : 'Паролі не співпадають'
        );
        return;
      }
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
          setValidationError(
            currentLanguage === 'en'
              ? 'New password must be at least 6 characters'
              : 'Новий пароль має містити щонайменше 6 символів'
          );
          return;
        }
        dispatch(confirmPasswordReset({ token: resetToken.trim(), newPassword }));
      } else {
        if (!email.includes('@')) {
          setValidationError(
            currentLanguage === 'en' ? 'Enter your account email' : 'Введіть ваш email'
          );
          return;
        }
        dispatch(requestPasswordReset({ email: email.trim() }));
      }
    }
  };

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
              className={`auth-tab ${authModalMode === 'login' ? 'active' : ''}`}
              onClick={() => dispatch(switchAuthMode('login'))}
            >
              {currentLanguage === 'en' ? 'Sign In' : 'Вхід'}
            </button>
            <button
              type="button"
              className={`auth-tab ${authModalMode === 'register' ? 'active' : ''}`}
              onClick={() => dispatch(switchAuthMode('register'))}
            >
              {currentLanguage === 'en' ? 'Sign Up' : 'Реєстрація'}
            </button>
            <button
              type="button"
              className={`auth-tab ${authModalMode === 'reset' ? 'active' : ''}`}
              onClick={() => dispatch(switchAuthMode('reset'))}
            >
              {currentLanguage === 'en' ? 'Reset Password' : 'Відновлення'}
            </button>
          </div>
          <button
            type="button"
            className="auth-close-btn"
            onClick={() => dispatch(closeAuthModal())}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form className="auth-modal-form" onSubmit={handleSubmit} noValidate>
          {registrationSuccess && (
            <div className="auth-alert success">
              {currentLanguage === 'en'
                ? 'Registration successful! You can now sign in with your login or email.'
                : 'Реєстрація успішна! Тепер ви можете увійти за логіном або email.'}
            </div>
          )}

          {resetSuccessMessage && (
            <div className="auth-alert success">{resetSuccessMessage}</div>
          )}

          {(validationError || error) && (
            <div className="auth-alert error">{validationError || error}</div>
          )}

          {authModalMode === 'login' && (
            <>
              <div className="auth-field">
                <label className="auth-label">
                  {currentLanguage === 'en' ? 'Login or Email' : 'Логін або Email'}
                </label>
                <input
                  type="text"
                  className="auth-input"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    currentLanguage === 'en'
                      ? 'e.g. admin_usof or admin@usof.com'
                      : 'Наприклад: admin_usof або admin@usof.com'
                  }
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">
                  {currentLanguage === 'en' ? 'Password' : 'Пароль'}
                </label>
                <input
                  type="password"
                  className="auth-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </>
          )}

          {authModalMode === 'register' && (
            <>
              <div className="auth-field">
                <label className="auth-label">
                  {currentLanguage === 'en' ? 'Unique Login *' : 'Унікальний логін *'}
                </label>
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
                <label className="auth-label">
                  {currentLanguage === 'en' ? 'Full Name' : "Повне ім'я"}
                </label>
                <input
                  type="text"
                  className="auth-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Олександр Коваленко"
                  autoComplete="name"
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">Email *</label>
                <input
                  type="email"
                  className="auth-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  autoComplete="email"
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">
                  {currentLanguage === 'en' ? 'Password *' : 'Пароль *'}
                </label>
                <input
                  type="password"
                  className="auth-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Мінімум 6 символів"
                  autoComplete="new-password"
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">
                  {currentLanguage === 'en' ? 'Confirm Password *' : 'Підтвердження пароля *'}
                </label>
                <input
                  type="password"
                  className="auth-input"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder="Повторіть пароль"
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          {authModalMode === 'reset' && (
            <>
              <div className="auth-field">
                <label className="auth-label">Email</label>
                <input
                  type="email"
                  className="auth-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">
                  {currentLanguage === 'en'
                    ? 'Confirm Token (if received)'
                    : 'Токен підтвердження (якщо вже отримали)'}
                </label>
                <input
                  type="text"
                  className="auth-input"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder={
                    currentLanguage === 'en'
                      ? 'Leave blank to request link first'
                      : 'Залиште порожнім для запиту листа'
                  }
                />
              </div>

              {resetToken.trim() && (
                <div className="auth-field">
                  <label className="auth-label">
                    {currentLanguage === 'en' ? 'New Password' : 'Новий пароль'}
                  </label>
                  <input
                    type="password"
                    className="auth-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Мінімум 6 символів"
                  />
                </div>
              )}
            </>
          )}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading
              ? currentLanguage === 'en'
                ? 'Please wait...'
                : 'Зачекайте...'
              : authModalMode === 'login'
              ? currentLanguage === 'en'
                ? 'Sign In'
                : 'Увійти'
              : authModalMode === 'register'
              ? currentLanguage === 'en'
                ? 'Create Account'
                : 'Зареєструватися'
              : resetToken.trim()
              ? currentLanguage === 'en'
                ? 'Save New Password'
                : 'Зберегти новий пароль'
              : currentLanguage === 'en'
              ? 'Send Reset Link'
              : 'Надіслати посилання'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;