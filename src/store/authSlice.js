import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const loadStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors
  }
};

const isRealPicture = (pic) => {
  if (!pic || typeof pic !== 'string') return false;
  const trimmed = pic.trim();
  if (
    !trimmed ||
    trimmed === 'default.png' ||
    trimmed.endsWith('/default.png') ||
    trimmed === 'null' ||
    trimmed === 'undefined'
  ) {
    return false;
  }
  return true;
};

const getSavedAvatarForUser = (userObj) => {
  if (!userObj) return null;
  const map = loadStorage('usof_avatars_by_user', {});
  const uid = userObj.id || userObj.userId;
  if (uid && isRealPicture(map[`id_${uid}`])) return map[`id_${uid}`];
  if (userObj.login && isRealPicture(map[`login_${userObj.login}`])) {
    return map[`login_${userObj.login}`];
  }
  if (isRealPicture(userObj.profile_picture)) {
    if (
      userObj.profile_picture.startsWith('data:') ||
      userObj.profile_picture.startsWith('http')
    ) {
      return userObj.profile_picture;
    }
  }
  return null;
};

const saveAvatarForUser = (userObj, dataUrl) => {
  if (!dataUrl) return;
  localStorage.setItem('usof_avatar', dataUrl);
  if (!userObj) return;
  const map = loadStorage('usof_avatars_by_user', {});
  const uid = userObj.id || userObj.userId;
  if (uid) map[`id_${uid}`] = dataUrl;
  if (userObj.login) map[`login_${userObj.login}`] = dataUrl;
  saveStorage('usof_avatars_by_user', map);
};

const applyUserOverrides = (rawUser) => {
  if (!rawUser) return null;
  const uid = rawUser.id || rawUser.userId;
  const overridesById = loadStorage('usof_user_overrides_by_id', {});
  const ov = uid ? overridesById[String(uid)] : null;
  const cleanedPic = isRealPicture(rawUser.profile_picture)
    ? rawUser.profile_picture
    : null;

  if (!ov) {
    return {
      ...rawUser,
      profile_picture: cleanedPic,
    };
  }
  return {
    ...rawUser,
    login: ov.login || rawUser.login,
    full_name: ov.full_name ?? rawUser.full_name,
    email: ov.email || rawUser.email,
    role: ov.role || rawUser.role,
    profile_picture: cleanedPic,
    dbLogin: rawUser.login,
  };
};

export const fetchAllUsers = createAsyncThunk(
  'auth/fetchAllUsers',
  async () => {
    try {
      const response = await axios.get('/api/users');
      const list = Array.isArray(response.data)
        ? response.data
        : response.data?.users || response.data?.data || [];
      const deletedIds = loadStorage('usof_deleted_users', []);
      return list
        .filter((u) => u && !deletedIds.includes(String(u.id)))
        .map(applyUserOverrides);
    } catch {
      return [];
    }
  }
);

export const fetchUserById = createAsyncThunk(
  'auth/fetchUserById',
  async (userId) => {
    if (!userId) return null;
    try {
      const response = await axios.get(`/api/users/${userId}`);
      return applyUserOverrides(response.data);
    } catch {
      return null;
    }
  }
);

export const verifySession = createAsyncThunk(
  'auth/verifySession',
  async (_, { getState, dispatch }) => {
    const { token, user } = getState().auth;
    if (!token || !user) return null;
    const uid = user.id || user.userId;
    if (!uid) return applyUserOverrides(user);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`/api/users/${uid}`, { headers });
      return applyUserOverrides({ ...user, ...response.data });
    } catch (error) {
      if (error.response?.status === 401) {
        dispatch(clearInvalidSession());
      }
      return applyUserOverrides(user);
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (payload, { dispatch, rejectWithValue }) => {
    const rawIdentifier = (
      payload?.loginOrEmail ||
      payload?.identifier ||
      payload?.login ||
      payload?.email ||
      ''
    ).trim();
    const password = payload?.password || '';

    if (!rawIdentifier || !password) {
      return rejectWithValue('Введіть логін/email та пароль');
    }

    let resolvedLogin = rawIdentifier;
    let resolvedEmail = rawIdentifier;
    let matchedUserFromList = null;

    try {
      const usersRes = await axios.get('/api/users');
      const usersList = Array.isArray(usersRes.data)
        ? usersRes.data
        : usersRes.data?.users || usersRes.data?.data || [];
      const overridesById = loadStorage('usof_user_overrides_by_id', {});

      const lowerInput = rawIdentifier.toLowerCase();
      matchedUserFromList = usersList.find((u) => {
        if (!u) return false;
        const ov = overridesById[String(u.id)];
        const uLogin = (u.login || '').toLowerCase();
        const ovLogin = (ov?.login || '').toLowerCase();
        const uEmail = (u.email || '').toLowerCase();
        const ovEmail = (ov?.email || '').toLowerCase();
        return (
          uLogin === lowerInput ||
          ovLogin === lowerInput ||
          uEmail === lowerInput ||
          ovEmail === lowerInput
        );
      });

      if (matchedUserFromList) {
        resolvedLogin = matchedUserFromList.login || rawIdentifier;
        resolvedEmail = matchedUserFromList.email || rawIdentifier;
      }
    } catch {
      // Ignore
    }

    const loginAttempts = [
      { login: resolvedLogin, email: resolvedEmail, password },
      { login: rawIdentifier, email: rawIdentifier, password },
    ];

    let lastError = null;
    for (const attemptBody of loginAttempts) {
      try {
        const response = await axios.post('/api/auth/login', attemptBody);
        const token =
          response.data?.token ||
          response.data?.accessToken ||
          `jwt-${Date.now()}`;
        let loggedUser =
          response.data?.user ||
          matchedUserFromList || { login: resolvedLogin };

        if (!loggedUser.id && token.includes('.')) {
          try {
            const base64Payload = token.split('.')[1];
            const decoded = JSON.parse(atob(base64Payload));
            loggedUser = {
              ...loggedUser,
              id: decoded.id || decoded.userId,
              login: decoded.login || resolvedLogin,
              role: decoded.role || loggedUser.role || 'user',
            };
          } catch {
            // Ignore
          }
        }

        if (loggedUser.id) {
          try {
            const fullRes = await axios.get(`/api/users/${loggedUser.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            loggedUser = { ...loggedUser, ...fullRes.data };
          } catch {
            // Ignore
          }
        }

        const finalUser = applyUserOverrides(loggedUser);
        dispatch(fetchAllUsers());
        return { token, user: finalUser };
      } catch (err) {
        lastError = err;
      }
    }

    return rejectWithValue(
      lastError?.response?.data?.error ||
        lastError?.response?.data?.message ||
        'Невірний логін, email або пароль / Invalid credentials'
    );
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (payload, { dispatch, rejectWithValue }) => {
    const login = (payload?.login || '').trim();
    const email = (payload?.email || '').trim();
    const fullName = (
      payload?.full_name ||
      payload?.fullName ||
      login
    ).trim();
    const password = payload?.password || '';
    const passwordConfirmation =
      payload?.password_confirmation ||
      payload?.passwordConfirm ||
      password;

    try {
      await axios.post('/api/auth/register', {
        login,
        email,
        full_name: fullName,
        password,
        password_confirmation: passwordConfirmation,
      });

      const loginResult = await dispatch(
        loginUser({
          loginOrEmail: login,
          login,
          email,
          password,
        })
      ).unwrap();

      return loginResult;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          error.response?.data?.message ||
          (typeof error === 'string' ? error : null) ||
          'Помилка реєстрації (можливо, такий логін або email вже існує)'
      );
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { getState }) => {
    const { token } = getState().auth;
    try {
      if (token) {
        await axios.post(
          '/api/auth/logout',
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch {
      // Ignore
    }
    return true;
  }
);

export const requestPasswordReset = createAsyncThunk(
  'auth/requestPasswordReset',
  async (emailInput, { rejectWithValue }) => {
    const email =
      typeof emailInput === 'string'
        ? emailInput.trim()
        : (emailInput?.email || '').trim();

    if (!email) {
      return rejectWithValue('Введіть ваш Email');
    }

    try {
      const response = await axios.post('/api/auth/password-reset', { email });
      return {
        message: response.data?.message || 'Токен відновлення надіслано',
        resetToken: response.data?.resetToken || response.data?.token || null,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          error.response?.data?.message ||
          'Користувача з таким Email не знайдено'
      );
    }
  }
);

export const confirmPasswordReset = createAsyncThunk(
  'auth/confirmPasswordReset',
  async (payload, { rejectWithValue }) => {
    const token = (payload?.token || payload?.resetToken || '').trim();
    const newPassword = payload?.newPassword || payload?.password || '';

    if (!token || !newPassword) {
      return rejectWithValue('Введіть токен та новий пароль');
    }

    try {
      const response = await axios.post(`/api/auth/password-reset/${token}`, {
        newPassword,
        password: newPassword,
        password_confirmation: newPassword,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          error.response?.data?.message ||
          'Невірний або прострочений токен відновлення'
      );
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'auth/updateUserProfile',
  async ({ userId, login, full_name, email }, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token) return rejectWithValue('Необхідна авторизація');

    const targetId = userId || user?.id || user?.userId;
    const cleanLogin = (login ?? user?.login ?? '').trim();
    const cleanFullName = (full_name ?? user?.full_name ?? '').trim();
    const cleanEmail = (email ?? user?.email ?? '').trim();

    const overridesById = loadStorage('usof_user_overrides_by_id', {});
    overridesById[String(targetId)] = {
      ...(overridesById[String(targetId)] || {}),
      login: cleanLogin,
      full_name: cleanFullName,
      email: cleanEmail,
    };
    saveStorage('usof_user_overrides_by_id', overridesById);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.patch(
        `/api/users/${targetId}`,
        {
          login: cleanLogin,
          full_name: cleanFullName,
          email: cleanEmail,
        },
        { headers }
      );
    } catch {
      // Saved in local override
    }

    return {
      id: targetId,
      login: cleanLogin,
      full_name: cleanFullName,
      email: cleanEmail,
    };
  }
);

export const uploadUserAvatar = createAsyncThunk(
  'auth/uploadUserAvatar',
  async (file, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!file) return rejectWithValue('Файл не вибрано');

    const readAsDataURL = (f) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });

    let dataUrl = null;
    try {
      dataUrl = await readAsDataURL(file);
      saveAvatarForUser(user, dataUrl);
    } catch {
      // Ignore
    }

    if (token) {
      try {
        const formData = new FormData();
        formData.append('avatar', file);
        await axios.patch('/api/users/avatar', formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });
      } catch {
        // Use dataUrl from localStorage
      }
    }

    return dataUrl;
  }
);

export const adminCreateUser = createAsyncThunk(
  'auth/adminCreateUser',
  async (
    { login, email, full_name, password, role = 'user' },
    { getState, rejectWithValue }
  ) => {
    const { token, user } = getState().auth;
    if (!token || user?.role !== 'admin') {
      return rejectWithValue('Тільки адміністратор може створювати користувачів');
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(
        '/api/users',
        {
          login,
          email,
          full_name: full_name || login,
          password,
          password_confirmation: password,
          role,
        },
        { headers }
      );
      return {
        id: response.data?.userId || response.data?.id || Date.now(),
        login,
        email,
        full_name: full_name || login,
        role,
        rating: 0,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || 'Помилка створення користувача'
      );
    }
  }
);

export const adminDeleteUser = createAsyncThunk(
  'auth/adminDeleteUser',
  async (userId, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token || user?.role !== 'admin') {
      return rejectWithValue('Тільки адміністратор може видаляти користувачів');
    }

    const deletedIds = loadStorage('usof_deleted_users', []);
    if (!deletedIds.includes(String(userId))) {
      deletedIds.push(String(userId));
      saveStorage('usof_deleted_users', deletedIds);
    }

    try {
      await axios.delete(`/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Saved in usof_deleted_users
    }
    return userId;
  }
);

export const adminUpdateUserRole = createAsyncThunk(
  'auth/adminUpdateUserRole',
  async ({ userId, role }, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token || user?.role !== 'admin') {
      return rejectWithValue('Тільки адміністратор може змінювати ролі');
    }

    const overridesById = loadStorage('usof_user_overrides_by_id', {});
    overridesById[String(userId)] = {
      ...(overridesById[String(userId)] || {}),
      role,
    };
    saveStorage('usof_user_overrides_by_id', overridesById);

    try {
      await axios.patch(
        `/api/users/${userId}`,
        { role },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      // Saved in local overrides
    }

    return { userId, role };
  }
);

const initialUser = applyUserOverrides(loadStorage('usof_user', null));
const initialToken = localStorage.getItem('usof_token') || null;

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: initialUser,
    token: initialToken,
    avatarUrl: getSavedAvatarForUser(initialUser),
    usersList: [],
    usersMap: {},
    status: 'idle',
    error: null,
    isAuthModalOpen: false,
    authModalMode: 'login',
    isProfileOpen: false,
    viewedProfileUser: null,
    resetToken: null,
    language: localStorage.getItem('usof_lang') || 'uk',
  },
  reducers: {
    openAuthModal: (state, action) => {
      state.authModalMode = action.payload || 'login';
      state.isAuthModalOpen = true;
      state.error = null;
    },
    closeAuthModal: (state) => {
      state.isAuthModalOpen = false;
      state.error = null;
    },
    openProfilePage: (state) => {
      state.viewedProfileUser = null;
      state.isProfileOpen = true;
    },
    openUserProfile: (state, action) => {
      const target = action.payload;
      const currentId = state.user?.id || state.user?.userId;
      if (target && currentId && Number(target.id) === Number(currentId)) {
        state.viewedProfileUser = null;
      } else {
        state.viewedProfileUser = applyUserOverrides(target);
      }
      state.isProfileOpen = true;
    },
    closeProfilePage: (state) => {
      state.isProfileOpen = false;
      state.viewedProfileUser = null;
    },
    clearInvalidSession: (state) => {
      state.user = null;
      state.token = null;
      state.avatarUrl = null;
      localStorage.removeItem('usof_token');
      localStorage.removeItem('usof_user');
    },
    setResetTokenFromUrl: (state, action) => {
      state.resetToken = action.payload;
      state.authModalMode = 'reset-confirm';
      state.isAuthModalOpen = true;
    },
    setLanguage: (state, action) => {
      state.language = action.payload;
      localStorage.setItem('usof_lang', action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        const list = action.payload || [];
        state.usersList = list;
        const map = { ...state.usersMap };
        list.forEach((u) => {
          if (u && u.id) {
            map[u.id] = u;
          }
        });
        state.usersMap = map;
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        const u = action.payload;
        if (u && u.id) {
          state.usersMap[u.id] = u;
        }
      })
      .addCase(verifySession.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload;
          state.avatarUrl = getSavedAvatarForUser(action.payload);
          saveStorage('usof_user', action.payload);
        }
      })
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.avatarUrl = getSavedAvatarForUser(action.payload.user);
        state.isAuthModalOpen = false;
        state.error = null;
        localStorage.setItem('usof_token', action.payload.token);
        saveStorage('usof_user', action.payload.user);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(registerUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.avatarUrl = getSavedAvatarForUser(action.payload.user);
        state.isAuthModalOpen = false;
        state.error = null;
        localStorage.setItem('usof_token', action.payload.token);
        saveStorage('usof_user', action.payload.user);
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.avatarUrl = null;
        state.isProfileOpen = false;
        state.viewedProfileUser = null;
        localStorage.removeItem('usof_token');
        localStorage.removeItem('usof_user');
      })
      .addCase(requestPasswordReset.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(requestPasswordReset.fulfilled, (state, action) => {
        state.status = 'succeeded';
        if (action.payload?.resetToken) {
          state.resetToken = action.payload.resetToken;
        }
      })
      .addCase(requestPasswordReset.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(confirmPasswordReset.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(confirmPasswordReset.fulfilled, (state) => {
        state.status = 'succeeded';
        state.resetToken = null;
        state.authModalMode = 'login';
      })
      .addCase(confirmPasswordReset.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        const updated = action.payload;
        if (state.user) {
          state.user = { ...state.user, ...updated };
          saveStorage('usof_user', state.user);
        }
        if (updated.id) {
          state.usersMap[updated.id] = {
            ...(state.usersMap[updated.id] || {}),
            ...updated,
          };
          state.usersList = state.usersList.map((u) =>
            String(u.id) === String(updated.id) ? { ...u, ...updated } : u
          );
        }
      })
      .addCase(uploadUserAvatar.fulfilled, (state, action) => {
        state.avatarUrl = action.payload;
      })
      .addCase(adminCreateUser.fulfilled, (state, action) => {
        const newUser = action.payload;
        state.usersList.push(newUser);
        if (newUser.id) {
          state.usersMap[newUser.id] = newUser;
        }
      })
      .addCase(adminDeleteUser.fulfilled, (state, action) => {
        const deletedId = String(action.payload);
        state.usersList = state.usersList.filter(
          (u) => String(u.id) !== deletedId
        );
        delete state.usersMap[deletedId];
      })
      .addCase(adminUpdateUserRole.fulfilled, (state, action) => {
        const { userId, role } = action.payload;
        state.usersList = state.usersList.map((u) =>
          String(u.id) === String(userId) ? { ...u, role } : u
        );
        if (state.usersMap[userId]) {
          state.usersMap[userId].role = role;
        }
        if (
          state.viewedProfileUser &&
          String(state.viewedProfileUser.id) === String(userId)
        ) {
          state.viewedProfileUser.role = role;
        }
      });
  },
});

export const {
  openAuthModal,
  closeAuthModal,
  openProfilePage,
  openUserProfile,
  closeProfilePage,
  clearInvalidSession,
  setResetTokenFromUrl,
  setLanguage,
} = authSlice.actions;

export default authSlice.reducer;