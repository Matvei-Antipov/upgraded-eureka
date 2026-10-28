import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  closeAuthModal,
  openAuthModal,
  loginUser,
  registerUser,
  requestPasswordReset,
  confirmPasswordReset,
} from '../../store/authSlice';
import { showNotification, fetchPosts } from '../../store/postsSlice';
import { translations } from '../../i18n/translations';
import './AuthModal.css';

const AuthModal = () => {
  const dispatch = useDispatch();
  const {
    isAuthModalOpen,
    authModalTab,
    resetTokenFromUrl,
    usersList,
    status,
    error,
    language,
  } = useSelector((state) => state.auth);

  const t = translations[language] || translations.uk;

  const [login, setLogin] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetStep, setResetStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (resetTokenFromUrl) {
      setResetToken(resetTokenFromUrl);
      setResetStep(2);
    }
  }, [resetTokenFromUrl]);

  if (!isAuthModalOpen) return null;

  const switchTab = (tab) => {
    setFieldErrors({});
    dispatch(openAuthModal(tab));
  };

  // Автоматическая подстановка email по логину (из кэша или списка пользователей БД)
  const handleLoginInputChange = (val) => {
    setLogin(val);
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) return;

    try {
      const raw = localStorage.getItem('usof_registered_profiles');
      const map = raw ? JSON.parse(raw) : {};
      if (map[trimmed]?.email && !email) {
        setEmail(map[trimmed].email);
        return;
      }
    } catch {
      // Ignore
    }

    const foundUser = (usersList || []).find(
      (u) => u.login && u.login.toLowerCase() === trimmed
    );
    if (foundUser?.email && !email) {
      setEmail(foundUser.email);
    }
  };

  const validate = () => {
    const errs = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (authModalTab === 'login') {
      if (!login.trim()) errs.login = t.errEnterLogin;
      if (!password) errs.password = t.errEnterPass;
    } else if (authModalTab === 'register') {
      if (!login.trim() || login.trim().length < 3) {
        errs.login = t.errLoginMin;
      }
      if (!email.trim() || !emailRegex.test(email.trim())) {
        errs.email = t.errEmailInvalid;
      }
      if (!fullName.trim() || fullName.trim().length < 2) {
        errs.fullName = t.errFullNameMin;
      }
      if (!password || password.length < 6) {
        errs.password = t.errPassMin;
      }
      if (password !== passwordConfirm) {
        errs.passwordConfirm = t.errPassMatch;
      }
    } else if (authModalTab === 'reset') {
      if (resetStep === 1) {
        if (!email.trim() || !emailRegex.test(email.trim())) {
          errs.email = t.errEmailInvalid;
        }
      } else {
        if (!resetToken.trim()) errs.resetToken = t.errTokenReq;
        if (!password || password.length < 6) {
          errs.password = t.errPassMin;
        }
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (authModalTab === 'login') {
      const res = await dispatch(
        loginUser({
          login: login.trim(),
          email: email.trim(),
          password,
        })
      );
      if (loginUser.fulfilled.match(res)) {
        dispatch(fetchPosts());
        dispatch(
          showNotification({
            message:
              language === 'en'
                ? `Welcome, ${
                    res.payload.user?.full_name ||
                    res.payload.user?.login ||
                    login
                  }!`
                : `Вітаємо, ${
                    res.payload.user?.full_name ||
                    res.payload.user?.login ||
                    login
                  }! Ви увійшли в систему.`,
          })
        );
      }
    } else if (authModalTab === 'register') {
      const res = await dispatch(
        registerUser({
          login: login.trim(),
          email: email.trim(),
          fullName: fullName.trim(),
          password,
          passwordConfirmation: passwordConfirm,
        })
      );
      if (registerUser.fulfilled.match(res)) {
        dispatch(
          showNotification({
            message:
              language === 'en'
                ? 'Registration successful! Please sign in.'
                : 'Реєстрація успішна! Тепер увійдіть у свій акаунт.',
          })
        );
        switchTab('login');
      }
    } else if (authModalTab === 'reset') {
      if (resetStep === 1) {
        const res = await dispatch(
          requestPasswordReset({ email: email.trim() })
        );
        if (requestPasswordReset.fulfilled.match(res)) {
          dispatch(
            showNotification({
              message:
                language === 'en'
                  ? 'Password reset instructions sent to your email!'
                  : 'Інструкції для скидання пароля надіслано на ваш Email!',
            })
          );
          setResetStep(2);
        }
      } else {
        const res = await dispatch(
          confirmPasswordReset({
            token: resetToken.trim(),
            newPassword: password,
          })
        );
        if (confirmPasswordReset.fulfilled.match(res)) {
          dispatch(
            showNotification({
              message:
                language === 'en'
                  ? 'Password updated! Sign in with your new password.'
                  : 'Пароль успішно змінено! Увійдіть з новим паролем.',
            })
          );
          setResetStep(1);
          switchTab('login');
        }
      }
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={() => dispatch(closeAuthModal())}
      role="dialog"
      aria-modal="true"
    >
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${authModalTab === 'login' ? 'active' : ''}`}
              onClick={() => switchTab('login')}
            >
              {t.loginTab}
            </button>
            <button
              type="button"
              className={`auth-tab ${
                authModalTab === 'register' ? 'active' : ''
              }`}
              onClick={() => switchTab('register')}
            >
              {t.registerTab}
            </button>
            <button
              type="button"
              className={`auth-tab ${authModalTab === 'reset' ? 'active' : ''}`}
              onClick={() => switchTab('reset')}
            >
              {t.resetTab}
            </button>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => dispatch(closeAuthModal())}
          >
            ✕
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="auth-server-error">{error}</div>}

          {authModalTab === 'login' && (
            <>
              <div className="form-field">
                <label className="form-label">{t.loginLabel}</label>
                <input
                  type="text"
                  name="login"
                  value={login}
                  onChange={(e) => handleLoginInputChange(e.target.value)}
                  placeholder="testcaser"
                  className="form-input"
                />
                {fieldErrors.login && (
                  <span className="field-error-text">{fieldErrors.login}</span>
                )}
              </div>

              <div className="form-field">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  name="login_email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label className="form-label">{t.passwordLabel}</label>
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input"
                />
                {fieldErrors.password && (
                  <span className="field-error-text">
                    {fieldErrors.password}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={status === 'loading'}
              >
                {status === 'loading' ? t.signingInText : t.signInSubmit}
              </button>
            </>
          )}

          {authModalTab === 'register' && (
            <>
              <div className="form-field">
                <label className="form-label">{t.loginLabel}</label>
                <input
                  type="text"
                  name="register_login"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="dev_ukraine"
                  className="form-input"
                />
                {fieldErrors.login && (
                  <span className="field-error-text">{fieldErrors.login}</span>
                )}
              </div>

              <div className="form-field">
                <label className="form-label">{t.fullNameLabel}</label>
                <input
                  type="text"
                  name="register_full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tester Caser"
                  className="form-input"
                />
                {fieldErrors.fullName && (
                  <span className="field-error-text">
                    {fieldErrors.fullName}
                  </span>
                )}
              </div>

              <div className="form-field">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  name="register_email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="form-input"
                />
                {fieldErrors.email && (
                  <span className="field-error-text">{fieldErrors.email}</span>
                )}
              </div>

              <div className="form-field">
                <label className="form-label">{t.passwordLabel}</label>
                <input
                  type="password"
                  name="register_password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input"
                />
                {fieldErrors.password && (
                  <span className="field-error-text">
                    {fieldErrors.password}
                  </span>
                )}
              </div>

              <div className="form-field">
                <label className="form-label">{t.confirmPasswordLabel}</label>
                <input
                  type="password"
                  name="register_password_confirm"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="form-input"
                />
                {fieldErrors.passwordConfirm && (
                  <span className="field-error-text">
                    {fieldErrors.passwordConfirm}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={status === 'loading'}
              >
                {status === 'loading' ? t.signingUpText : t.signUpSubmit}
              </button>
            </>
          )}

          {authModalTab === 'reset' && (
            <>
              {resetStep === 1 ? (
                <>
                  <div className="form-field">
                    <label className="form-label">{t.resetEmailLabel}</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="form-input"
                    />
                    {fieldErrors.email && (
                      <span className="field-error-text">
                        {fieldErrors.email}
                      </span>
                    )}
                  </div>
                  <button type="submit" className="auth-submit-btn">
                    {t.sendResetTokenBtn}
                  </button>
                  <button
                    type="button"
                    className="auth-secondary-link"
                    onClick={() => setResetStep(2)}
                  >
                    {t.haveTokenLink}
                  </button>
                </>
              ) : (
                <>
                  <div className="form-field">
                    <label className="form-label">{t.confirmTokenLabel}</label>
                    <input
                      type="text"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Token..."
                      className="form-input"
                    />
                    {fieldErrors.resetToken && (
                      <span className="field-error-text">
                        {fieldErrors.resetToken}
                      </span>
                    )}
                  </div>
                  <div className="form-field">
                    <label className="form-label">{t.newPasswordLabel}</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="form-input"
                    />
                    {fieldErrors.password && (
                      <span className="field-error-text">
                        {fieldErrors.password}
                      </span>
                    )}
                  </div>
                  <button type="submit" className="auth-submit-btn">
                    {t.saveNewPasswordBtn}
                  </button>
                </>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default AuthModal;