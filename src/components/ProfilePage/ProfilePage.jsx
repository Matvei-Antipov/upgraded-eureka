import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  closeProfilePage,
  openProfilePage,
  updateUserProfile,
  uploadUserAvatar,
  fetchAllUsers,
  adminCreateUser,
  adminUpdateUserRole,
  adminDeleteUser,
} from '../../store/authSlice';
import {
  fetchPosts,
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  showNotification,
  openPostPage,
  REACTION_TYPES,
} from '../../store/postsSlice';
import { translations } from '../../i18n/translations';
import './ProfilePage.css';

const resolveAvatarUrl = (rawPath) => {
  if (!rawPath || typeof rawPath !== 'string') return null;
  const trimmed = rawPath.trim();
  const lower = trimmed.toLowerCase();
  if (
    !trimmed ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower.includes('default') ||
    lower.includes('placeholder')
  ) {
    return null;
  }
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/api/')) {
    return trimmed;
  }
  if (trimmed.startsWith('uploads/')) {
    return `/${trimmed}`;
  }
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  return `/uploads/${trimmed}`;
};

const getInitials = (name, fallbackLogin) => {
  const source = String(name || fallbackLogin || 'US').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
};

const ProfilePage = () => {
  const dispatch = useDispatch();
  const { user, viewedUserProfile, usersList, language } = useSelector(
    (state) => state.auth
  );
  const {
    items: posts,
    categories,
    postLikesMap,
    postVoteFromServer,
    userVotes,
    postReactions,
  } = useSelector((state) => state.posts);

  const t = translations[language] || translations.uk;

  const isViewingOtherUser =
    viewedUserProfile &&
    (!user ||
      String(viewedUserProfile.id) !== String(user.id || user.userId));
  const targetUser = isViewingOtherUser ? viewedUserProfile : user;

  const [login, setLogin] = useState(targetUser?.login || '');
  const [fullName, setFullName] = useState(
    targetUser?.full_name || targetUser?.fullName || ''
  );
  const [email, setEmail] = useState(targetUser?.email || '');
  const [failedAvatarSrc, setFailedAvatarSrc] = useState(null);

  const [catTitle, setCatTitle] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatTitle, setEditingCatTitle] = useState('');
  const [editingCatDesc, setEditingCatDesc] = useState('');

  const [newUserLogin, setNewUserLogin] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');

  const isAdmin = user?.role === 'admin' && !isViewingOtherUser;

  useEffect(() => {
    dispatch(fetchPosts());
    dispatch(fetchCategories());
    dispatch(fetchAllUsers());
  }, [dispatch]);

  useEffect(() => {
    setLogin(targetUser?.login || '');
    setFullName(targetUser?.full_name || targetUser?.fullName || '');
    setEmail(targetUser?.email || '');
  }, [targetUser]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!login.trim()) return;
    const res = await dispatch(
      updateUserProfile({
        userId: user?.id || user?.userId,
        login: login.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
      })
    );
    if (updateUserProfile.fulfilled.match(res)) {
      dispatch(
        showNotification({
          message:
            language === 'en'
              ? 'Profile updated successfully!'
              : 'Дані профілю успішно оновлено!',
        })
      );
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFailedAvatarSrc(null);
    await dispatch(uploadUserAvatar(file));
    dispatch(
      showNotification({
        message:
          language === 'en'
            ? 'Avatar updated!'
            : 'Аватар профілю успішно оновлено!',
      })
    );
  };

  const handleAdminAddCategory = async (e) => {
    e.preventDefault();
    if (!catTitle.trim()) return;
    await dispatch(
      createCategory({
        title: catTitle.trim(),
        description: catDesc.trim(),
      })
    );
    setCatTitle('');
    setCatDesc('');
  };

  const handleAdminSaveCategory = async (catId) => {
    if (!editingCatTitle.trim()) return;
    await dispatch(
      updateCategory({
        categoryId: catId,
        title: editingCatTitle.trim(),
        description: editingCatDesc.trim(),
      })
    );
    setEditingCatId(null);
  };

  const handleAdminAddUser = async (e) => {
    e.preventDefault();
    if (!newUserLogin.trim() || !newUserEmail.trim() || !newUserPassword)
      return;
    const res = await dispatch(
      adminCreateUser({
        login: newUserLogin.trim(),
        email: newUserEmail.trim(),
        full_name: newUserLogin.trim(),
        password: newUserPassword,
        role: newUserRole,
      })
    );
    if (adminCreateUser.fulfilled.match(res)) {
      dispatch(
        showNotification({
          message: `User ${newUserLogin} (${newUserRole}) created!`,
        })
      );
      setNewUserLogin('');
      setNewUserEmail('');
      setNewUserPassword('');
    }
  };

  const handleChangeUserRole = async (userId, newRole, userLogin) => {
    await dispatch(adminUpdateUserRole({ userId, role: newRole }));
    dispatch(
      showNotification({
        message:
          language === 'en'
            ? `Role of ${userLogin} updated to ${newRole}!`
            : `Роль користувача ${userLogin} змінено на ${newRole}!`,
      })
    );
  };

  const userPosts = useMemo(() => {
    return posts.filter((p) => {
      const targetId = targetUser?.id || targetUser?.userId;
      const postAuthorId =
        p.author_id || p.user_id || p.authorId || p.author?.id;
      const isThisUsersPost =
        (targetId &&
          postAuthorId &&
          Number(postAuthorId) === Number(targetId)) ||
        (targetUser?.login && p.author_login === targetUser.login) ||
        (targetUser?.dbLogin && p.author_login === targetUser.dbLogin);
      if (!isThisUsersPost) return false;
      if (
        isViewingOtherUser &&
        user?.role !== 'admin' &&
        p.status === 'inactive'
      ) {
        return false;
      }
      return true;
    });
  }, [posts, targetUser, isViewingOtherUser, user?.role]);

  const effectiveUserRating = useMemo(() => {
    const baseUserRating = Number(targetUser?.rating ?? 0);
    let dbPostsLikesSum = 0;
    let extraReactionsAndLocalDelta = 0;

    userPosts.forEach((post) => {
      const baseLikes = Number(
        postLikesMap[post.id] ??
          post.likes_count ??
          post.likesCount ??
          post.rating ??
          0
      );
      dbPostsLikesSum += baseLikes;

      const vote = userVotes[post.id];
      let voteDelta = 0;
      if (!postVoteFromServer[post.id]) {
        if (vote === 'like') voteDelta = 1;
        if (vote === 'dislike') voteDelta = -1;
      }
      const reactionsData = postReactions[post.id]?.counts || {};
      const reactionsDelta = REACTION_TYPES.reduce(
        (rSum, r) => rSum + (reactionsData[r.id] || 0) * r.weight,
        0
      );
      extraReactionsAndLocalDelta += voteDelta + reactionsDelta;
    });

    const coreScore =
      userPosts.length > 0
        ? Math.max(baseUserRating, dbPostsLikesSum)
        : baseUserRating;

    return coreScore + extraReactionsAndLocalDelta;
  }, [
    targetUser?.rating,
    userPosts,
    postLikesMap,
    userVotes,
    postVoteFromServer,
    postReactions,
  ]);

  const displayLogin = targetUser?.login || t.guestName;
  const displayFullName =
    targetUser?.full_name || targetUser?.fullName || displayLogin;
  const avatarUrl = resolveAvatarUrl(
    targetUser?.profile_picture || targetUser?.avatar
  );
  const shouldShowImage = Boolean(avatarUrl && failedAvatarSrc !== avatarUrl);

  return (
    <div className="profile-page-container">
      <div className="profile-top-bar">
        <button
          type="button"
          className="back-to-feed-btn"
          onClick={() => dispatch(closeProfilePage())}
        >
          {t.backToFeedBtn}
        </button>

        {isViewingOtherUser && user && (
          <button
            type="button"
            className="role-switch-pill"
            onClick={() => dispatch(openProfilePage())}
          >
            {t.myOwnProfileBtn}
          </button>
        )}
      </div>

      <section className="profile-card">
        <div className="profile-avatar-block">
          <div className="profile-avatar-large">
            {shouldShowImage ? (
              <img
                src={avatarUrl}
                alt={displayLogin}
                onError={() => setFailedAvatarSrc(avatarUrl)}
              />
            ) : (
              <span>{getInitials(displayFullName, displayLogin)}</span>
            )}
          </div>
          {!isViewingOtherUser && (
            <label className="upload-avatar-label">
              {t.changeAvatarBtn}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                hidden
              />
            </label>
          )}
        </div>

        <div className="profile-info-block">
          <div className="profile-name-row">
            <h2>{displayFullName}</h2>
            <span
              className={`role-badge-large ${
                targetUser?.role === 'admin' ? 'admin' : 'user'
              }`}
            >
              {targetUser?.role === 'admin' ? t.roleAdmin : t.roleUser}
            </span>
            <span
              className={`author-rating-badge ${
                effectiveUserRating >= 0 ? 'positive' : 'negative'
              }`}
            >
              ★ {t.userRatingLabel} {effectiveUserRating}
            </span>
          </div>

          {!isViewingOtherUser ? (
            <form className="profile-edit-form" onSubmit={handleProfileSave}>
              <div className="profile-form-grid">
                <div className="form-field">
                  <label className="form-label">{t.loginLabel}</label>
                  <input
                    type="text"
                    name="profile_login"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">{t.fullNameLabel}</label>
                  <input
                    type="text"
                    name="profile_full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Tester Caser"
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    name="profile_email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
              <button type="submit" className="save-profile-btn">
                {t.saveProfileBtn}
              </button>
            </form>
          ) : (
            <p className="profile-permissions-hint">
              {t.loginLabel}: <strong>{displayLogin}</strong>
              {targetUser?.email ? ` • Email: ${targetUser.email}` : ''}
            </p>
          )}
        </div>
      </section>

      {isAdmin && (
        <section className="admin-panel-section">
          <h3 className="section-subtitle">{t.adminCategoriesTitle}</h3>

          <form className="admin-inline-form" onSubmit={handleAdminAddCategory}>
            <input
              type="text"
              value={catTitle}
              onChange={(e) => setCatTitle(e.target.value)}
              placeholder={t.newTopicTitlePlaceholder}
              className="form-input"
            />
            <input
              type="text"
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              placeholder={t.newTopicDescPlaceholder}
              className="form-input"
            />
            <button type="submit" className="save-profile-btn">
              +
            </button>
          </form>

          <div className="admin-categories-list">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="admin-cat-item"
                title={cat.description || cat.title}
              >
                {editingCatId === cat.id ? (
                  <>
                    <input
                      type="text"
                      value={editingCatTitle}
                      onChange={(e) => setEditingCatTitle(e.target.value)}
                      className="form-input"
                      style={{ width: '110px', padding: '3px 6px' }}
                    />
                    <input
                      type="text"
                      value={editingCatDesc}
                      onChange={(e) => setEditingCatDesc(e.target.value)}
                      placeholder="Description..."
                      className="form-input"
                      style={{ width: '140px', padding: '3px 6px' }}
                    />
                    <button
                      type="button"
                      className="admin-del-small-btn"
                      style={{ color: '#059669', fontWeight: 600 }}
                      onClick={() => handleAdminSaveCategory(cat.id)}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className="admin-del-small-btn"
                      onClick={() => setEditingCatId(null)}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <span>
                      <strong>{cat.title || cat.name}</strong>
                      {cat.description ? ` — ${cat.description}` : ''}
                    </span>
                    <button
                      type="button"
                      className="admin-del-small-btn"
                      style={{ color: '#374151' }}
                      onClick={() => {
                        setEditingCatId(cat.id);
                        setEditingCatTitle(cat.title || cat.name || '');
                        setEditingCatDesc(cat.description || '');
                      }}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="admin-del-small-btn"
                      onClick={() => dispatch(deleteCategory(cat.id))}
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <hr className="admin-divider" />

          <h3 className="section-subtitle">{t.adminUsersTitle}</h3>
          <form className="admin-inline-form" onSubmit={handleAdminAddUser}>
            <input
              type="text"
              value={newUserLogin}
              onChange={(e) => setNewUserLogin(e.target.value)}
              placeholder="Login..."
              className="form-input"
            />
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="Email..."
              className="form-input"
            />
            <input
              type="password"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              placeholder="Password..."
              className="form-input"
            />
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
              className="form-input"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <button type="submit" className="save-profile-btn">
              +
            </button>
          </form>

          {usersList.length > 0 && (
            <div className="admin-users-table">
              {usersList.map((u) => (
                <div key={u.id} className="admin-user-row">
                  <span>
                    <strong>{u.login}</strong> ({u.email || '—'})
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <select
                      value={u.role || 'user'}
                      onChange={(e) =>
                        handleChangeUserRole(u.id, e.target.value, u.login)
                      }
                      className="filter-select"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                    <button
                      type="button"
                      className="admin-del-small-btn"
                      onClick={() => dispatch(adminDeleteUser(u.id))}
                    >
                      {t.deleteBtn}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="my-posts-section">
        <h3 className="section-subtitle">
          {isViewingOtherUser ? t.userQuestionsTitle : t.myQuestionsTitle} (
          {userPosts.length})
        </h3>
        {userPosts.length === 0 ? (
          <p className="empty-hint">{t.noPostsFound}</p>
        ) : (
          <div className="my-posts-list">
            {userPosts.map((p) => (
              <div
                key={p.id}
                className="my-post-row"
                onClick={() => {
                  dispatch(closeProfilePage());
                  dispatch(openPostPage(p.id));
                }}
              >
                <span className="my-post-title">{p.title}</span>
                <span className={`post-status-badge ${p.status || 'active'}`}>
                  {p.status === 'inactive' ? t.badgeInactive : t.badgeActive}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ProfilePage;