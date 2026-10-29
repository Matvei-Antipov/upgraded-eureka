import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  closeProfilePage,
  openProfilePage,
  openUserProfile,
  fetchUserById,
  verifySession,
  getJwtSession,
  updateUserProfile,
  uploadUserAvatar,
  fetchAllUsers,
  adminCreateUser,
  adminDeleteUser,
} from '../../store/authSlice';
import {
  openPostPage,
  openAskModal,
  fetchPostPreviewComments,
  createCategory,
  updateCategory,
  deleteCategory,
  deleteExistingPost,
  updateExistingPost,
  showNotification,
} from '../../store/postsSlice';
import { translations, translateMessage } from '../../i18n/translations';
import {
  PROFILE_POSTS_STEP,
  MAX_AVATAR_SIZE_MB,
  ALLOWED_IMAGE_TYPES,
} from '../../config';
import {
  avatarUrl,
  getInitials,
  formatDate,
  computeUserRating,
} from '../../utils/format';
import './ProfilePage.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ProfilePage = () => {
  const dispatch = useDispatch();
  const {
    user,
    viewedProfileUser,
    allUsers = [],
    language: authLang,
  } = useSelector((state) => state.auth);
  const postsState = useSelector((state) => state.posts);
  const {
    items: posts = [],
    categories = [],
    previewCategoriesByPost = {},
    postLikesMap = {},
  } = postsState;

  const language = authLang || 'uk';
  const t = translations[language] || translations.uk;

  const jwtSession = getJwtSession();
  const effectiveOwnId = jwtSession?.userId || user?.id;
  const isOwnProfile =
    !viewedProfileUser ||
    !viewedProfileUser.id ||
    Boolean(
      effectiveOwnId &&
        Number(viewedProfileUser.id) === Number(effectiveOwnId)
    );
  const targetUser = isOwnProfile
    ? user || viewedProfileUser
    : viewedProfileUser;
  const isAdmin =
    (jwtSession ? jwtSession.role === 'admin' : user?.role === 'admin') &&
    user?.role === 'admin';
  const canEditProfile = Boolean(
    (jwtSession || user) && (isOwnProfile || isAdmin)
  );

  const [loginInput, setLoginInput] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [profileFormError, setProfileFormError] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);

  const [catTitle, setCatTitle] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatTitle, setEditCatTitle] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');

  const [newUserLogin, setNewUserLogin] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserPassConfirm, setNewUserPassConfirm] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [adminUserError, setAdminUserError] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  const [profileCategoryFilter, setProfileCategoryFilter] = useState('all');
  const [profileSortBy, setProfileSortBy] = useState('date');
  const [profileSortOrder, setProfileSortOrder] = useState('desc');
  const [visiblePostsCount, setVisiblePostsCount] =
    useState(PROFILE_POSTS_STEP);

  useEffect(() => {
    const session = getJwtSession();
    if (
      session &&
      (!user ||
        Number(user.id) !== Number(session.userId) ||
        user.role !== session.role ||
        !user.email ||
        !user.login)
    ) {
      dispatch(verifySession());
    }
  }, [user, dispatch]);

  useEffect(() => {
    setAvatarFailed(false);
    setProfileFormError('');
    setVisiblePostsCount(PROFILE_POSTS_STEP);
    if (targetUser) {
      setLoginInput(targetUser.login || '');
      setFullName(targetUser.full_name || targetUser.login || '');
      setEmail(targetUser.email || '');
      if (targetUser.id && !targetUser.email) {
        dispatch(fetchUserById(targetUser.id));
      }
    }
  }, [targetUser, dispatch]);

  useEffect(() => {
    if (isAdmin && isOwnProfile) {
      dispatch(fetchAllUsers());
    }
  }, [isAdmin, isOwnProfile, dispatch]);

  const rawUserPosts = useMemo(() => {
    if (!targetUser) return [];
    const targetId = Number(targetUser.id);
    return posts.filter((p) => {
      if (Number(p.author_id) !== targetId) return false;
      if (p.status === 'inactive' && !isAdmin && !isOwnProfile) return false;
      return true;
    });
  }, [posts, targetUser, isAdmin, isOwnProfile]);

  useEffect(() => {
    rawUserPosts.forEach((p) => {
      if (p?.id) {
        dispatch(fetchPostPreviewComments(p.id));
      }
    });
  }, [rawUserPosts, dispatch]);

  const filteredAdminUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    return allUsers.filter((u) => {
      const roleMatch =
        userRoleFilter === 'all'
          ? true
          : String(u.role || 'user') === userRoleFilter;
      const textMatch =
        !q ||
        String(u.login || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.full_name || '').toLowerCase().includes(q);
      return roleMatch && textMatch;
    });
  }, [allUsers, userSearchQuery, userRoleFilter]);

  const adminCount = useMemo(
    () => allUsers.filter((u) => u.role === 'admin').length,
    [allUsers]
  );

  const regularUserCount = useMemo(
    () => allUsers.filter((u) => (u.role || 'user') !== 'admin').length,
    [allUsers]
  );

  const userPosts = useMemo(() => {
    let list = [...rawUserPosts];

    if (profileCategoryFilter !== 'all') {
      list = list.filter((p) => {
        const postCats =
          previewCategoriesByPost[p.id] ||
          (Array.isArray(p.categories) ? p.categories : []);
        return postCats.some(
          (c) =>
            Number(typeof c === 'object' ? c.id : c) ===
            Number(profileCategoryFilter)
        );
      });
    }

    list.sort((a, b) => {
      if (profileSortBy === 'likes') {
        const scoreA = Number(postLikesMap[a.id] ?? a.likes_count ?? 0);
        const scoreB = Number(postLikesMap[b.id] ?? b.likes_count ?? 0);
        if (scoreA !== scoreB) {
          return profileSortOrder === 'asc'
            ? scoreA - scoreB
            : scoreB - scoreA;
        }
      }
      const dateA = new Date(a.publish_date || 0).getTime();
      const dateB = new Date(b.publish_date || 0).getTime();
      return profileSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    return list;
  }, [
    rawUserPosts,
    previewCategoriesByPost,
    postLikesMap,
    profileCategoryFilter,
    profileSortBy,
    profileSortOrder,
  ]);

  if (!targetUser) return null;

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileFormError('');

    const cleanLogin = loginInput.trim();
    if (!cleanLogin || cleanLogin.length < 3) {
      setProfileFormError(t.loginTooShortError);
      return;
    }

    const effectiveTargetId = isOwnProfile
      ? jwtSession?.userId || user?.id
      : targetUser.id;

    const loginTaken = allUsers.some(
      (u) =>
        Number(u.id) !== Number(effectiveTargetId) &&
        String(u.login || '').toLowerCase() === cleanLogin.toLowerCase()
    );
    if (loginTaken) {
      setProfileFormError(t.loginAlreadyTakenError);
      return;
    }

    if (!fullName.trim() || fullName.trim().length < 2) {
      setProfileFormError(t.fillAllFieldsError);
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setProfileFormError(t.invalidEmailError);
      return;
    }

    try {
      await dispatch(
        updateUserProfile({
          userId: effectiveTargetId,
          isOwnProfile,
          login: cleanLogin,
          full_name: fullName.trim(),
          email: email.trim(),
        })
      ).unwrap();
      dispatch(showNotification({ key: 'profileSavedToast', type: 'success' }));
    } catch (err) {
      setProfileFormError(
        err?.detail || translateMessage(language, err?.key, t.actionFailedError)
      );
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      dispatch(
        showNotification({ key: 'avatarInvalidTypeError', type: 'error' })
      );
      e.target.value = '';
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_MB * 1024 * 1024) {
      dispatch(showNotification({ key: 'avatarTooBigError', type: 'error' }));
      e.target.value = '';
      return;
    }
    setAvatarFailed(false);
    dispatch(uploadUserAvatar(file));
    e.target.value = '';
  };

  const handleAdminAddCategory = (e) => {
    e.preventDefault();
    if (catTitle.trim().length < 2) return;
    dispatch(
      createCategory({ title: catTitle.trim(), description: catDesc.trim() })
    );
    setCatTitle('');
    setCatDesc('');
  };

  const startEditingCategory = (cat) => {
    setEditingCatId(cat.id);
    setEditCatTitle(cat.title || '');
    setEditCatDesc(cat.description || '');
  };

  const handleSaveCategoryEdit = (catId) => {
    if (editCatTitle.trim().length < 2) return;
    dispatch(
      updateCategory({
        categoryId: catId,
        title: editCatTitle.trim(),
        description: editCatDesc.trim(),
      })
    );
    setEditingCatId(null);
  };

  const handleDeleteCategory = (catId) => {
    if (!window.confirm(t.confirmDeleteCategory)) return;
    dispatch(deleteCategory(catId));
  };

  const handleAdminCreateUser = async (e) => {
    e.preventDefault();
    setAdminUserError('');

    if (newUserLogin.trim().length < 3) {
      setAdminUserError(t.loginTooShortError);
      return;
    }
    if (!EMAIL_RE.test(newUserEmail.trim())) {
      setAdminUserError(t.invalidEmailError);
      return;
    }
    if (newUserPass.length < 6) {
      setAdminUserError(t.passwordTooShortError);
      return;
    }
    if (newUserPass !== newUserPassConfirm) {
      setAdminUserError(t.passwordsDoNotMatchError);
      return;
    }

    try {
      await dispatch(
        adminCreateUser({
          login: newUserLogin.trim(),
          email: newUserEmail.trim(),
          password: newUserPass,
          passwordConfirmation: newUserPassConfirm,
          role: newUserRole,
        })
      ).unwrap();
      setNewUserLogin('');
      setNewUserEmail('');
      setNewUserPass('');
      setNewUserPassConfirm('');
      setNewUserRole('user');
    } catch (err) {
      setAdminUserError(
        err?.detail ||
          translateMessage(language, err?.key, t.registerFailedError)
      );
    }
  };

  const handleDeleteUser = (userId) => {
    if (!window.confirm(t.confirmDeleteUser)) return;
    dispatch(adminDeleteUser(userId));
  };

  const handleTogglePostStatus = (post) => {
    const nextStatus = post.status === 'inactive' ? 'active' : 'inactive';
    dispatch(
      updateExistingPost({
        postId: post.id,
        status: nextStatus,
      })
    );
  };

  const handleDeletePost = (postId) => {
    if (!window.confirm(t.confirmDeletePost)) return;
    dispatch(deleteExistingPost(postId));
  };

  const resolvedAvatar = !avatarFailed ? avatarUrl(targetUser) : null;
  const visibleUserPosts = userPosts.slice(0, visiblePostsCount);
  const targetUserRating = computeUserRating(
    targetUser.id,
    postsState,
    targetUser.rating
  );

  return (
    <div className="profile-page-container">
      <div className="profile-top-nav">
        <button
          type="button"
          className="profile-back-btn"
          onClick={() => dispatch(closeProfilePage())}
        >
          {t.backToFeedBtn}
        </button>

        {!isOwnProfile && user && (
          <button
            type="button"
            className="profile-own-btn"
            onClick={() => dispatch(openProfilePage(null))}
          >
            {t.myOwnProfileBtn}
          </button>
        )}
      </div>

      <section className="profile-section-card profile-main-card">
        <div className="profile-avatar-column">
          <div className="profile-avatar-circle">
            {resolvedAvatar ? (
              <img
                src={resolvedAvatar}
                alt={targetUser.login}
                className="profile-avatar-img"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <span>{getInitials(targetUser.login)}</span>
            )}
          </div>
          {isOwnProfile && user && (
            <label className="profile-upload-btn">
              {t.changeAvatarBtn}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatarChange}
                hidden
              />
            </label>
          )}
        </div>

        <div className="profile-details-column">
          <div className="profile-identity-header">
            <h2 className="profile-username">{targetUser.login}</h2>
            <span
              className={`profile-role-badge ${
                targetUser.role === 'admin' ? 'admin' : 'user'
              }`}
            >
              {targetUser.role === 'admin' ? t.roleAdmin : t.roleUser}
            </span>
            <span
              className="profile-rating-pill"
              title={t.ratingBreakdownHint}
            >
              ★ {t.userRatingLabel} {targetUserRating.total}
            </span>
          </div>

          {canEditProfile ? (
            <form className="profile-edit-form" onSubmit={handleSaveProfile}>
              {!isOwnProfile && isAdmin && (
                <p className="section-card-subtitle">
                  🛡 {t.adminEditUserTitle}
                </p>
              )}
              {profileFormError && (
                <div className="modal-error-banner">{profileFormError}</div>
              )}
              <div className="profile-form-grid">
                <div className="profile-field">
                  <label>{t.loginLabel}</label>
                  <input
                    type="text"
                    className="profile-input"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    minLength={3}
                    title={t.loginReadonlyHint}
                    required
                  />
                </div>
                <div className="profile-field">
                  <label>{t.fullNameLabel}</label>
                  <input
                    type="text"
                    className="profile-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="profile-field full-width">
                  <label>Email</label>
                  <input
                    type="email"
                    className="profile-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="profile-form-actions">
                <button type="submit" className="profile-primary-btn">
                  {t.saveProfileBtn}
                </button>
                {!isOwnProfile && isAdmin && (
                  <button
                    type="button"
                    className="admin-delete-user-btn"
                    onClick={() => handleDeleteUser(targetUser.id)}
                  >
                    {t.deleteBtn}
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="profile-readonly-info">
              <p>
                <strong>{t.fullNameLabel}:</strong>{' '}
                {targetUser.full_name || targetUser.login}
              </p>
            </div>
          )}
        </div>
      </section>

      {isAdmin && isOwnProfile && (
        <section className="profile-section-card">
          <div className="section-card-header">
            <div>
              <h3 className="section-card-title">
                🛡️ {t.adminCategoriesTitle}
              </h3>
              <p className="section-card-subtitle">
                {t.adminCategoriesSubtitle}
              </p>
            </div>
            <span className="section-count-badge">{categories.length}</span>
          </div>

          <form
            className="admin-bar-form categories-grid-form"
            onSubmit={handleAdminAddCategory}
          >
            <input
              type="text"
              className="profile-input"
              value={catTitle}
              onChange={(e) => setCatTitle(e.target.value)}
              placeholder={t.newTopicTitlePlaceholder}
              required
            />
            <input
              type="text"
              className="profile-input"
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              placeholder={t.newTopicDescPlaceholder}
            />
            <button type="submit" className="profile-primary-btn">
              {t.addCategoryBtn}
            </button>
          </form>

          <div className="admin-categories-grid">
            {categories.map((cat) => (
              <div key={cat.id || cat.title} className="admin-category-item">
                {editingCatId === cat.id ? (
                  <div className="admin-category-edit-box">
                    <input
                      type="text"
                      className="profile-input compact"
                      value={editCatTitle}
                      onChange={(e) => setEditCatTitle(e.target.value)}
                      placeholder={t.newTopicTitlePlaceholder}
                    />
                    <input
                      type="text"
                      className="profile-input compact"
                      value={editCatDesc}
                      onChange={(e) => setEditCatDesc(e.target.value)}
                      placeholder={t.newTopicDescPlaceholder}
                    />
                    <div className="admin-category-edit-actions">
                      <button
                        type="button"
                        className="admin-action-btn save"
                        onClick={() => handleSaveCategoryEdit(cat.id)}
                      >
                        ✓ {t.saveBtn}
                      </button>
                      <button
                        type="button"
                        className="admin-action-btn"
                        onClick={() => setEditingCatId(null)}
                      >
                        {t.cancelBtn}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="admin-category-info">
                      <span className="admin-category-name">{cat.title}</span>
                      <span className="admin-category-desc">
                        {cat.description || t.noDescriptionLabel}
                      </span>
                    </div>
                    <div className="admin-category-actions">
                      <button
                        type="button"
                        className="admin-icon-btn"
                        title={t.editBtn}
                        onClick={() => startEditingCategory(cat)}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn danger"
                        title={t.deleteBtn}
                        onClick={() => handleDeleteCategory(cat.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {isAdmin && isOwnProfile && (
        <section className="profile-section-card">
          <div className="section-card-header">
            <div>
              <h3 className="section-card-title">👥 {t.adminUsersTitle}</h3>
              <p className="section-card-subtitle">{t.adminUsersSubtitle}</p>
            </div>
            <span className="section-count-badge">
              {filteredAdminUsers.length}
            </span>
          </div>

          {adminUserError && (
            <div className="modal-error-banner">{adminUserError}</div>
          )}

          <form
            className="admin-bar-form users-grid-form"
            onSubmit={handleAdminCreateUser}
          >
            <input
              type="text"
              className="profile-input"
              value={newUserLogin}
              onChange={(e) => setNewUserLogin(e.target.value)}
              placeholder={t.loginLabel}
              required
            />
            <input
              type="email"
              className="profile-input"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="Email"
              required
            />
            <input
              type="password"
              className="profile-input"
              value={newUserPass}
              onChange={(e) => setNewUserPass(e.target.value)}
              placeholder={t.passwordLabel}
              required
            />
            <input
              type="password"
              className="profile-input"
              value={newUserPassConfirm}
              onChange={(e) => setNewUserPassConfirm(e.target.value)}
              placeholder={t.confirmPasswordLabel}
              required
            />
            <select
              className="profile-select"
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <button type="submit" className="profile-primary-btn">
              {t.createUserBtn}
            </button>
          </form>

          <div className="admin-users-filter-bar">
            <div className="admin-users-search-wrap">
              <input
                type="text"
                className="profile-input compact"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder={t.searchUsersPlaceholder}
              />
              {userSearchQuery && (
                <button
                  type="button"
                  className="admin-search-clear-btn"
                  onClick={() => setUserSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="admin-role-filter-pills">
              <button
                type="button"
                className={`role-filter-pill ${
                  userRoleFilter === 'all' ? 'active' : ''
                }`}
                onClick={() => setUserRoleFilter('all')}
              >
                {t.filterAllUsers} ({allUsers.length})
              </button>
              <button
                type="button"
                className={`role-filter-pill ${
                  userRoleFilter === 'admin' ? 'active' : ''
                }`}
                onClick={() => setUserRoleFilter('admin')}
              >
                {t.filterAdmins} ({adminCount})
              </button>
              <button
                type="button"
                className={`role-filter-pill ${
                  userRoleFilter === 'user' ? 'active' : ''
                }`}
                onClick={() => setUserRoleFilter('user')}
              >
                {t.filterRegularUsers} ({regularUserCount})
              </button>
            </div>
          </div>

          <div className="admin-users-list">
            {filteredAdminUsers.length === 0 ? (
              <div className="profile-empty-posts">{t.noUsersFound}</div>
            ) : (
              filteredAdminUsers.map((u) => {
                const uAvatar = avatarUrl(u);
                const uRating = computeUserRating(u.id, postsState, u.rating);
                return (
                  <div key={u.id} className="admin-user-row">
                    <div
                      className="admin-user-meta"
                      style={{ cursor: 'pointer' }}
                      onClick={() => dispatch(openUserProfile(u))}
                    >
                      <div className="admin-user-avatar">
                        {uAvatar ? (
                          <img
                            src={uAvatar}
                            alt={u.login}
                            className="user-avatar-img"
                          />
                        ) : (
                          getInitials(u.login)
                        )}
                      </div>
                      <div className="admin-user-text">
                        <span className="admin-user-login">{u.login}</span>
                        <span className="admin-user-email">{u.email}</span>
                      </div>
                    </div>

                    <div className="admin-user-controls">
                      <span
                        className="profile-rating-pill"
                        title={t.ratingBreakdownHint}
                      >
                        ★ {uRating.total}
                      </span>
                      <span
                        className={`profile-role-badge ${
                          u.role === 'admin' ? 'admin' : 'user'
                        }`}
                        title={t.roleSetAtCreationHint}
                      >
                        {u.role === 'admin' ? t.roleAdmin : t.roleUser}
                      </span>

                      <button
                        type="button"
                        className="admin-action-btn"
                        onClick={() => dispatch(openUserProfile(u))}
                      >
                        {t.editBtn}
                      </button>

                      <button
                        type="button"
                        className="admin-delete-user-btn"
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={Number(u.id) === Number(user?.id)}
                      >
                        {t.deleteBtn}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      <section className="profile-section-card">
        <div className="section-card-header">
          <div>
            <h3 className="section-card-title">
              {isOwnProfile
                ? t.myQuestionsTitle
                : `${t.userQuestionsTitle} ${targetUser.login}`}
            </h3>
          </div>
          <span className="section-count-badge">{userPosts.length}</span>
        </div>

        <div className="profile-posts-toolbar">
          <div className="profile-toolbar-group">
            <label>{t.categoryFilterLabel}</label>
            <select
              className="profile-select compact"
              value={profileCategoryFilter}
              onChange={(e) => setProfileCategoryFilter(e.target.value)}
            >
              <option value="all">{t.allCategoriesOption}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.title}
                </option>
              ))}
            </select>
          </div>

          <div className="profile-toolbar-group">
            <label>{t.sortByLabel}</label>
            <select
              className="profile-select compact"
              value={profileSortBy}
              onChange={(e) => setProfileSortBy(e.target.value)}
            >
              <option value="date">{t.sortByDate}</option>
              <option value="likes">{t.sortByLikesOption}</option>
            </select>

            <select
              className="profile-select compact"
              value={profileSortOrder}
              onChange={(e) => setProfileSortOrder(e.target.value)}
            >
              <option value="desc">{t.orderDesc}</option>
              <option value="asc">{t.orderAsc}</option>
            </select>
          </div>
        </div>

        {visibleUserPosts.length === 0 ? (
          <div className="profile-empty-posts">{t.noUserPosts}</div>
        ) : (
          <div className="profile-posts-list">
            {visibleUserPosts.map((post) => {
              const postCats =
                previewCategoriesByPost[post.id] ||
                (Array.isArray(post.categories) ? post.categories : []);
              const postScore = Number(
                postLikesMap[post.id] ?? post.likes_count ?? 0
              );

              return (
                <div key={post.id} className="profile-post-item">
                  <div
                    className="profile-post-main"
                    onClick={() => {
                      dispatch(closeProfilePage());
                      dispatch(openPostPage(post.id));
                    }}
                  >
                    <div className="profile-post-top">
                      <span
                        className={`profile-post-status ${
                          post.status === 'inactive' ? 'inactive' : 'active'
                        }`}
                      >
                        {post.status === 'inactive'
                          ? t.badgeInactive
                          : t.badgeActive}
                      </span>
                      <span className="profile-post-title">{post.title}</span>
                    </div>
                    <div className="profile-post-meta">
                      <span>★ {postScore}</span>
                      <span>•</span>
                      <span>{formatDate(post.publish_date, language)}</span>
                      <span>•</span>
                      <span>
                        {postCats.length > 0
                          ? postCats
                              .map((c) => (typeof c === 'object' ? c.title : c))
                              .join(', ')
                          : t.generalTopic}
                      </span>
                    </div>
                  </div>

                  {(isOwnProfile || isAdmin) && (
                    <div className="profile-post-actions">
                      {isOwnProfile && (
                        <button
                          type="button"
                          className="admin-action-btn"
                          onClick={() =>
                            dispatch(
                              openAskModal({
                                ...post,
                                categories: postCats,
                              })
                            )
                          }
                        >
                          {t.editBtn}
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          type="button"
                          className="admin-action-btn"
                          onClick={() => handleTogglePostStatus(post)}
                        >
                          {post.status === 'inactive'
                            ? t.activateBtn
                            : t.deactivateBtn}
                        </button>
                      )}
                      <button
                        type="button"
                        className="admin-delete-user-btn"
                        onClick={() => handleDeletePost(post.id)}
                      >
                        {t.deleteBtn}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {visibleUserPosts.length < userPosts.length && (
              <button
                type="button"
                className="profile-back-btn"
                onClick={() =>
                  setVisiblePostsCount((prev) => prev + PROFILE_POSTS_STEP)
                }
              >
                {t.showMoreUserPostsBtn} ({visibleUserPosts.length} /{' '}
                {userPosts.length})
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default ProfilePage;
