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
  openPostPage,
  openAskModal,
  createCategory,
  updateCategory,
  deleteCategory,
  deleteExistingPost,
  updateExistingPost,
} from '../../store/postsSlice';
import { translations } from '../../i18n/translations';
import './ProfilePage.css';

const ProfilePage = () => {
  const dispatch = useDispatch();
  const {
    user,
    viewedProfileUser,
    viewedUserProfile,
    allUsers = [],
    usersList = [],
    language: authLang,
  } = useSelector((state) => state.auth);
  const { items: posts = [], categories = [] } = useSelector((state) => state.posts);

  const language = authLang || 'uk';
  const t = translations[language] || translations.uk;

  const targetUser = viewedUserProfile || viewedProfileUser || user;
  const isOwnProfile = !targetUser || !user || Number(targetUser?.id) === Number(user?.id);
  const isAdmin = user?.role === 'admin';
  const usersToDisplay = allUsers.length > 0 ? allUsers : usersList;

  const [login, setLogin] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  // Админ-панель: категории
  const [catTitle, setCatTitle] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatTitle, setEditCatTitle] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');

  // Админ-панель: пользователи
  const [newUserLogin, setNewUserLogin] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [adminFeedback, setAdminFeedback] = useState('');

  // Фильтрация и сортировка постов в профиле
  const [profileCategoryFilter, setProfileCategoryFilter] = useState('all');
  const [profileSortBy, setProfileSortBy] = useState('date');
  const [profileSortOrder, setProfileSortOrder] = useState('desc');

  useEffect(() => {
    if (targetUser) {
      setLogin(targetUser.login || '');
      setFullName(targetUser.full_name || targetUser.fullName || targetUser.login || '');
      setEmail(targetUser.email || '');
    }
  }, [targetUser]);

  useEffect(() => {
    if (isAdmin && isOwnProfile) {
      dispatch(fetchAllUsers());
    }
  }, [isAdmin, isOwnProfile, dispatch]);

  const userPosts = useMemo(() => {
    if (!targetUser) return [];
    const targetLogin = String(targetUser.login || '').toLowerCase();
    const targetId = Number(targetUser.id);

    let list = posts.filter((p) => {
      const pAuthorId = Number(p.author_id || p.user_id || p.author?.id);
      const pAuthorLogin = String(p.author || p.author_login || p.user?.login || '').toLowerCase();
      return (targetId && pAuthorId === targetId) || (targetLogin && pAuthorLogin === targetLogin);
    });

    if (profileCategoryFilter !== 'all') {
      list = list.filter((p) => {
        const postCats = Array.isArray(p.categories) ? p.categories : [];
        return postCats.some((c) => {
          const cTitle = typeof c === 'object' ? c.title || c.name : String(c);
          return String(cTitle).toLowerCase() === String(profileCategoryFilter).toLowerCase();
        });
      });
    }

    list.sort((a, b) => {
      if (profileSortBy === 'likes') {
        const scoreA = Number(a.votes ?? a.likes_count ?? a.rating ?? 0);
        const scoreB = Number(b.votes ?? b.likes_count ?? b.rating ?? 0);
        return profileSortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      }
      const dateA = new Date(a.publish_date || a.created_at || 0).getTime();
      const dateB = new Date(b.publish_date || b.created_at || 0).getTime();
      return profileSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    return list;
  }, [posts, targetUser, profileCategoryFilter, profileSortBy, profileSortOrder]);

  if (!targetUser) return null;

  const getInitials = (nameStr) => {
    const clean = String(nameStr || 'U').trim();
    return clean.slice(0, 2).toUpperCase();
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!login.trim()) return;
    dispatch(
      updateUserProfile({
        userId: targetUser.id,
        login: login.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
      })
    );
    setSaveMessage(language === 'en' ? 'Profile saved!' : 'Профіль успішно збережено!');
    setTimeout(() => setSaveMessage(''), 2500);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      dispatch(uploadUserAvatar(file));
    }
  };

  const handleAdminAddCategory = (e) => {
    e.preventDefault();
    if (!catTitle.trim()) return;
    dispatch(createCategory({ title: catTitle.trim(), description: catDesc.trim() }));
    setCatTitle('');
    setCatDesc('');
  };

  const startEditingCategory = (cat) => {
    setEditingCatId(cat.id);
    setEditCatTitle(cat.title || '');
    setEditCatDesc(cat.description || '');
  };

  const handleSaveCategoryEdit = (catId) => {
    if (!editCatTitle.trim()) return;
    dispatch(
      updateCategory({
        id: catId,
        categoryId: catId,
        title: editCatTitle.trim(),
        description: editCatDesc.trim(),
      })
    );
    setEditingCatId(null);
  };

  const handleAdminCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserLogin.trim() || !newUserEmail.trim() || !newUserPass.trim()) return;
    const res = await dispatch(
      adminCreateUser({
        login: newUserLogin.trim(),
        email: newUserEmail.trim(),
        password: newUserPass,
        role: newUserRole,
      })
    );
    if (!res.error) {
      setNewUserLogin('');
      setNewUserEmail('');
      setNewUserPass('');
      setNewUserRole('user');
      setAdminFeedback(language === 'en' ? 'User created!' : 'Користувача створено!');
      setTimeout(() => setAdminFeedback(''), 2500);
    }
  };

  const handleTogglePostStatus = (post) => {
    const nextStatus = post.status === 'inactive' ? 'active' : 'inactive';
    dispatch(
      updateExistingPost({
        id: post.id,
        postId: post.id,
        title: post.title,
        content: post.content,
        status: nextStatus,
        categories: post.categories,
      })
    );
  };

  const avatarSrc = targetUser.profile_picture || targetUser.avatar;

  return (
    <div className="profile-page-container">
      <div className="profile-top-nav">
        <button
          type="button"
          className="profile-back-btn"
          onClick={() => dispatch(closeProfilePage())}
        >
          ← {t.backToFeedBtn || 'Повернутися до стрічки питань'}
        </button>

        {!isOwnProfile && user && (
          <button
            type="button"
            className="profile-own-btn"
            onClick={() => dispatch(openProfilePage(null))}
          >
            {t.myOwnProfileBtn || 'Мій власний профіль'}
          </button>
        )}
      </div>

      {/* Карточка профиля */}
      <section className="profile-section-card profile-main-card">
        <div className="profile-avatar-column">
          <div className="profile-avatar-circle">
            {avatarSrc ? (
              <img src={avatarSrc} alt={targetUser.login} className="profile-avatar-img" />
            ) : (
              <span>{getInitials(targetUser.login)}</span>
            )}
          </div>
          {isOwnProfile && (
            <label className="profile-upload-btn">
              {t.changeAvatarBtn || 'Змінити фото'}
              <input type="file" accept="image/*" onChange={handleAvatarChange} hidden />
            </label>
          )}
        </div>

        <div className="profile-details-column">
          <div className="profile-identity-header">
            <h2 className="profile-username">{targetUser.login}</h2>
            <span
              className={`profile-role-badge ${targetUser.role === 'admin' ? 'admin' : 'user'}`}
            >
              {targetUser.role === 'admin'
                ? t.roleAdmin || 'Адміністратор'
                : t.roleUser || 'Користувач'}
            </span>
            <span className="profile-rating-pill">
              ★ {t.userRatingLabel || 'Рейтинг'}: {targetUser.rating ?? 0}
            </span>
          </div>

          {isOwnProfile ? (
            <form className="profile-edit-form" onSubmit={handleSaveProfile}>
              <div className="profile-form-grid">
                <div className="profile-field">
                  <label>{t.loginLabel || 'Логін'}</label>
                  <input
                    type="text"
                    className="profile-input"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                  />
                </div>
                <div className="profile-field">
                  <label>{t.fullNameLabel || "Повне ім'я"}</label>
                  <input
                    type="text"
                    className="profile-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="profile-field full-width">
                  <label>Email</label>
                  <input
                    type="email"
                    className="profile-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="profile-form-actions">
                <button type="submit" className="profile-primary-btn">
                  {t.saveProfileBtn || 'Зберегти профіль'}
                </button>
                {saveMessage && <span className="profile-save-toast">{saveMessage}</span>}
              </div>
            </form>
          ) : (
            <div className="profile-readonly-info">
              <p>
                <strong>{t.fullNameLabel || "Повне ім'я"}:</strong>{' '}
                {targetUser.full_name || targetUser.login}
              </p>
              {targetUser.email && (
                <p>
                  <strong>Email:</strong> {targetUser.email}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Админ-панель: Категории */}
      {isAdmin && isOwnProfile && (
        <section className="profile-section-card">
          <div className="section-card-header">
            <div>
              <h3 className="section-card-title">
                🛡️ {t.adminCategoriesTitle || 'Панель адміністратора: Управління категоріями'}
              </h3>
              <p className="section-card-subtitle">
                {language === 'en'
                  ? 'Create, edit or remove discussion categories'
                  : 'Створення, редагування та видалення тематичних категорій'}
              </p>
            </div>
            <span className="section-count-badge">{categories.length}</span>
          </div>

          <form className="admin-bar-form categories-grid-form" onSubmit={handleAdminAddCategory}>
            <input
              type="text"
              className="profile-input"
              value={catTitle}
              onChange={(e) => setCatTitle(e.target.value)}
              placeholder={t.newTopicTitlePlaceholder || 'Назва нової теми...'}
            />
            <input
              type="text"
              className="profile-input"
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              placeholder={t.newTopicDescPlaceholder || 'Опис теми...'}
            />
            <button type="submit" className="profile-primary-btn">
              + {language === 'en' ? 'Add' : 'Додати'}
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
                      placeholder="Назва категорії"
                    />
                    <input
                      type="text"
                      className="profile-input compact"
                      value={editCatDesc}
                      onChange={(e) => setEditCatDesc(e.target.value)}
                      placeholder="Опис категорії"
                    />
                    <div className="admin-category-edit-actions">
                      <button
                        type="button"
                        className="admin-action-btn save"
                        onClick={() => handleSaveCategoryEdit(cat.id)}
                      >
                        ✓ Зберегти
                      </button>
                      <button
                        type="button"
                        className="admin-action-btn"
                        onClick={() => setEditingCatId(null)}
                      >
                        Скасувати
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="admin-category-info">
                      <span className="admin-category-name">{cat.title}</span>
                      <span className="admin-category-desc">
                        {cat.description || 'Без опису'}
                      </span>
                    </div>
                    <div className="admin-category-actions">
                      <button
                        type="button"
                        className="admin-icon-btn"
                        title="Редагувати категорію"
                        onClick={() => startEditingCategory(cat)}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn danger"
                        title="Видалити категорію"
                        onClick={() => dispatch(deleteCategory(cat.id))}
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

      {/* Админ-панель: Пользователи */}
      {isAdmin && isOwnProfile && (
        <section className="profile-section-card">
          <div className="section-card-header">
            <div>
              <h3 className="section-card-title">
                👥 {language === 'en' ? 'User Management' : 'Управління користувачами'}
              </h3>
              <p className="section-card-subtitle">
                {language === 'en'
                  ? 'Create accounts, assign roles or remove users'
                  : 'Створення облікових записів, зміна ролей та видалення користувачів'}
              </p>
            </div>
            <span className="section-count-badge">{usersToDisplay.length}</span>
          </div>

          <form className="admin-bar-form users-grid-form" onSubmit={handleAdminCreateUser}>
            <input
              type="text"
              className="profile-input"
              value={newUserLogin}
              onChange={(e) => setNewUserLogin(e.target.value)}
              placeholder="Login..."
            />
            <input
              type="email"
              className="profile-input"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="Email..."
            />
            <input
              type="password"
              className="profile-input"
              value={newUserPass}
              onChange={(e) => setNewUserPass(e.target.value)}
              placeholder="Password..."
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
              + {language === 'en' ? 'Create' : 'Створити'}
            </button>
          </form>

          {adminFeedback && <div className="profile-save-toast">{adminFeedback}</div>}

          <div className="admin-users-list">
            {usersToDisplay.map((u) => (
              <div key={u.id} className="admin-user-row">
                <div className="admin-user-meta">
                  <div className="admin-user-avatar">{getInitials(u.login)}</div>
                  <div className="admin-user-text">
                    <span className="admin-user-login">{u.login}</span>
                    <span className="admin-user-email">{u.email}</span>
                  </div>
                </div>

                <div className="admin-user-controls">
                  <select
                    className="profile-select compact"
                    value={u.role || 'user'}
                    onChange={(e) =>
                      dispatch(adminUpdateUserRole({ userId: u.id, role: e.target.value }))
                    }
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>

                  <button
                    type="button"
                    className="admin-delete-user-btn"
                    onClick={() => dispatch(adminDeleteUser(u.id))}
                    disabled={Number(u.id) === Number(user?.id)}
                  >
                    🗑️ {t.deleteBtn || 'Видалити'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Секция вопросов пользователя */}
      <section className="profile-section-card">
        <div className="section-card-header">
          <div>
            <h3 className="section-card-title">
              {isOwnProfile
                ? language === 'en'
                  ? 'My Questions'
                  : 'Мої питання'
                : `${language === 'en' ? 'Questions by' : 'Питання користувача'} ${
                    targetUser.login
                  }`}
            </h3>
          </div>
          <span className="section-count-badge">{userPosts.length}</span>
        </div>

        <div className="profile-posts-toolbar">
          <div className="profile-toolbar-group">
            <label>{t.categoryFilterLabel || 'Категорія:'}</label>
            <select
              className="profile-select compact"
              value={profileCategoryFilter}
              onChange={(e) => setProfileCategoryFilter(e.target.value)}
            >
              <option value="all">{t.allCategoriesOption || 'Усі теми'}</option>
              {categories.map((cat) => (
                <option key={cat.id || cat.title} value={cat.title}>
                  {cat.title}
                </option>
              ))}
            </select>
          </div>

          <div className="profile-toolbar-group">
            <label>{t.sortByLabel || 'Сортувати:'}</label>
            <select
              className="profile-select compact"
              value={profileSortBy}
              onChange={(e) => setProfileSortBy(e.target.value)}
            >
              <option value="date">{t.sortByDate || 'За датою'}</option>
              <option value="likes">{t.sortByLikesOption || 'За вподобайками'}</option>
            </select>

            <select
              className="profile-select compact"
              value={profileSortOrder}
              onChange={(e) => setProfileSortOrder(e.target.value)}
            >
              <option value="desc">{t.orderDesc || 'За спаданням (↓)'}</option>
              <option value="asc">{t.orderAsc || 'За зростанням (↑)'}</option>
            </select>
          </div>
        </div>

        {userPosts.length === 0 ? (
          <div className="profile-empty-posts">
            {language === 'en'
              ? 'No publications found for the selected filter.'
              : 'Публікацій за обраними параметрами ще немає.'}
          </div>
        ) : (
          <div className="profile-posts-list">
            {userPosts.map((post) => (
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
                        ? t.badgeInactive || 'Неактивний'
                        : t.badgeActive || 'Активний'}
                    </span>
                    <span className="profile-post-title">{post.title}</span>
                  </div>
                  <div className="profile-post-meta">
                    <span>★ {post.votes ?? post.likes_count ?? 0}</span>
                    <span>•</span>
                    <span>
                      {Array.isArray(post.categories) && post.categories.length > 0
                        ? post.categories
                            .map((c) => (typeof c === 'object' ? c.title : c))
                            .join(', ')
                        : t.generalTopic || 'Загальне'}
                    </span>
                  </div>
                </div>

                {(isOwnProfile || isAdmin) && (
                  <div className="profile-post-actions">
                    {isOwnProfile && (
                      <button
                        type="button"
                        className="admin-action-btn"
                        onClick={() => dispatch(openAskModal(post))}
                      >
                        ✎ {t.editBtn || 'Редагувати'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="admin-action-btn"
                      onClick={() => handleTogglePostStatus(post)}
                    >
                      {post.status === 'inactive'
                        ? t.activateBtn || 'Активувати'
                        : t.deactivateBtn || 'Деактивувати'}
                    </button>
                    <button
                      type="button"
                      className="admin-delete-user-btn"
                      onClick={() => dispatch(deleteExistingPost(post.id))}
                    >
                      {t.deleteBtn || 'Видалити'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ProfilePage;