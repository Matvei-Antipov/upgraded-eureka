import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const parseJwt = (token) => {
  try {
    if (!token || !token.includes('.')) return null;
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

const sanitizeAvatarPath = (rawPath) => {
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
  return trimmed;
};

const getPendingProfilesMap = () => {
  try {
    const raw = localStorage.getItem('usof_registered_profiles');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const getUserOverridesByIdMap = () => {
  try {
    const raw = localStorage.getItem('usof_user_overrides_by_id');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveUserOverrideById = (
  userId,
  { login, email, fullName, avatar, role, dbLogin }
) => {
  if (!userId) return;
  try {
    const map = getUserOverridesByIdMap();
    const key = String(userId);
    const existing = map[key] || {};

    const cleanLogin =
      login !== undefined ? String(login).trim() : existing.login;
    const cleanEmail =
      email !== undefined ? String(email).trim() : existing.email;
    const cleanFullName =
      fullName !== undefined ? String(fullName).trim() : existing.full_name;
    const cleanAvatar =
      avatar !== undefined ? sanitizeAvatarPath(avatar) : existing.avatar;

    map[key] = {
      ...existing,
      id: Number(userId),
      login: cleanLogin || existing.login || '',
      email: cleanEmail || existing.email || '',
      full_name: cleanFullName || existing.full_name || '',
      avatar: cleanAvatar || existing.avatar || null,
      role: role || existing.role || undefined,
      // Сохраняем исходный dbLogin из БД, чтобы вход работал и по старому, и по новому логину
      dbLogin: existing.dbLogin || dbLogin || cleanLogin || '',
    };

    localStorage.setItem('usof_user_overrides_by_id', JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
};

const savePendingProfile = ({
  login,
  email,
  fullName,
  avatar,
  role,
  userId,
  dbLogin,
}) => {
  try {
    const map = getPendingProfilesMap();
    const cleanLogin = login ? login.trim() : '';
    const cleanEmail = email ? email.trim() : '';
    const cleanFullName = fullName ? fullName.trim() : '';
    const cleanAvatar = sanitizeAvatarPath(avatar);

    const existingByLogin = cleanLogin ? map[cleanLogin.toLowerCase()] : null;
    const existingByEmail = cleanEmail ? map[cleanEmail.toLowerCase()] : null;
    const existing = existingByLogin || existingByEmail || {};

    const resolvedDbLogin = existing.dbLogin || dbLogin || cleanLogin || '';

    const record = {
      login: cleanLogin || existing.login || '',
      email: cleanEmail || existing.email || '',
      full_name: cleanFullName || existing.full_name || '',
      avatar: cleanAvatar || existing.avatar || null,
      dbLogin: resolvedDbLogin,
    };

    if (record.login) map[record.login.toLowerCase()] = record;
    if (record.email) map[record.email.toLowerCase()] = record;
    if (record.dbLogin) map[record.dbLogin.toLowerCase()] = record;
    localStorage.setItem('usof_registered_profiles', JSON.stringify(map));

    if (userId) {
      saveUserOverrideById(userId, {
        login: record.login,
        email: record.email,
        fullName: record.full_name,
        avatar: record.avatar,
        role,
        dbLogin: resolvedDbLogin,
      });
    }
  } catch {
    // Ignore storage quota errors
  }
};

const pickBestFullName = (
  overrideFullName,
  dbFullName,
  cachedFullName,
  userFullName,
  login,
  email
) => {
  const isDistinct = (val) => {
    if (!val || typeof val !== 'string') return false;
    const clean = val.trim().toLowerCase();
    if (!clean) return false;
    const loginClean = String(login || '').trim().toLowerCase();
    const emailClean = String(email || '').trim().toLowerCase();
    return clean !== loginClean && clean !== emailClean;
  };

  if (isDistinct(overrideFullName)) return overrideFullName.trim();
  if (isDistinct(dbFullName)) return dbFullName.trim();
  if (isDistinct(cachedFullName)) return cachedFullName.trim();
  if (isDistinct(userFullName)) return userFullName.trim();

  return (
    overrideFullName ||
    dbFullName ||
    cachedFullName ||
    userFullName ||
    login ||
    ''
  );
};

// Всегда отдаём приоритет сохранённым изменениям профиля (idOverride) для ВСЕХ пользователей
const applyUserOverrides = (rawUser, fallbackUser = null) => {
  if (!rawUser && !fallbackUser) return null;
  const merged = { ...(fallbackUser || {}), ...(rawUser || {}) };
  const uid = merged.id || merged.userId;

  const overridesById = getUserOverridesByIdMap();
  const idOverride = uid ? overridesById[String(uid)] : null;

  const pendingMap = getPendingProfilesMap();
  const rawLogin = merged.login || '';
  const rawEmail = merged.email || '';
  const cached =
    (idOverride?.login && pendingMap[idOverride.login.toLowerCase()]) ||
    (rawLogin && pendingMap[rawLogin.toLowerCase()]) ||
    (rawEmail && pendingMap[rawEmail.toLowerCase()]);

  const resolvedLogin =
    idOverride?.login ||
    rawUser?.login ||
    fallbackUser?.login ||
    cached?.login ||
    '';

  const resolvedEmail =
    idOverride?.email ||
    rawUser?.email ||
    fallbackUser?.email ||
    cached?.email ||
    '';

  const resolvedFullName = pickBestFullName(
    idOverride?.full_name,
    rawUser?.full_name || rawUser?.fullName,
    cached?.full_name,
    fallbackUser?.full_name || fallbackUser?.fullName,
    resolvedLogin,
    resolvedEmail
  );

  const cleanAvatar =
    idOverride?.avatar ||
    sanitizeAvatarPath(rawUser?.profile_picture || rawUser?.avatar) ||
    cached?.avatar ||
    sanitizeAvatarPath(fallbackUser?.profile_picture || fallbackUser?.avatar);

  const resolvedRole =
    idOverride?.role || rawUser?.role || fallbackUser?.role || 'user';

  return {
    ...merged,
    id: uid,
    userId: uid,
    dbLogin:
      rawUser?.login || idOverride?.dbLogin || merged.dbLogin || resolvedLogin,
    login: resolvedLogin,
    full_name: resolvedFullName,
    fullName: resolvedFullName,
    email: resolvedEmail,
    profile_picture: cleanAvatar,
    avatar: cleanAvatar,
    role: resolvedRole,
  };
};

export const verifySession = createAsyncThunk(
  'auth/verifySession',
  async (_, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token) return null;

    const decoded = parseJwt(token);
    if (!decoded) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return rejectWithValue('Invalid token');
    }

    const userId = decoded.userId || decoded.id || user?.id || user?.userId;
    if (!userId) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return rejectWithValue('No userId in token');
    }

    try {
      const response = await axios.get(`/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dbUser = response.data?.user || response.data;
      if (!dbUser || (!dbUser.id && !dbUser.login)) {
        throw new Error('User not found in DB');
      }

      const verifiedUser = applyUserOverrides(
        {
          ...dbUser,
          id: dbUser.id || userId,
          role: dbUser.role || decoded.role || user?.role || 'user',
        },
        user
      );

      localStorage.setItem('user', JSON.stringify(verifiedUser));
      return verifiedUser;
    } catch (error) {
      const status = error.response?.status;
      if (status === 404 || status === 401 || status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return rejectWithValue('Session user no longer exists in DB');
      }
      return user ? applyUserOverrides(user) : null;
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ login, email, password }, { getState, rejectWithValue }) => {
    try {
      const cleanLoginInput = (login || '').trim();
      const cleanEmailInput = (email || '').trim();
      const pendingMap = getPendingProfilesMap();
      const overridesById = getUserOverridesByIdMap();

      const overrideMatch = Object.values(overridesById).find(
        (o) =>
          (o.login &&
            o.login.toLowerCase() === cleanLoginInput.toLowerCase()) ||
          (o.dbLogin &&
            o.dbLogin.toLowerCase() === cleanLoginInput.toLowerCase()) ||
          (o.email && o.email.toLowerCase() === cleanLoginInput.toLowerCase())
      );

      const cached =
        pendingMap[cleanLoginInput.toLowerCase()] ||
        pendingMap[cleanEmailInput.toLowerCase()] ||
        overrideMatch;

      let matchedFromUsersList = null;
      const existingUsers = getState().auth.usersList || [];
      if (existingUsers.length > 0) {
        matchedFromUsersList = existingUsers.find((u) => {
          const uLogin = (u.login || '').toLowerCase();
          const uDbLogin = (u.dbLogin || '').toLowerCase();
          const uEmail = (u.email || '').toLowerCase();
          const target = cleanLoginInput.toLowerCase();
          return uLogin === target || uDbLogin === target || uEmail === target;
        });
      }

      const finalLogin =
        (!cleanLoginInput.includes('@') ? cleanLoginInput : '') ||
        cached?.login ||
        matchedFromUsersList?.login ||
        cleanLoginInput;

      const finalEmail =
        cleanEmailInput ||
        (cleanLoginInput.includes('@') ? cleanLoginInput : '') ||
        cached?.email ||
        matchedFromUsersList?.email ||
        cleanLoginInput;

      let response;
      try {
        response = await axios.post('/api/auth/login', {
          login: finalLogin,
          email: finalEmail,
          password,
        });
      } catch (firstErr) {
        const fallbackDbLogin =
          overrideMatch?.dbLogin ||
          cached?.dbLogin ||
          matchedFromUsersList?.dbLogin;
        if (fallbackDbLogin && fallbackDbLogin !== finalLogin) {
          response = await axios.post('/api/auth/login', {
            login: fallbackDbLogin,
            email: finalEmail,
            password,
          });
        } else {
          throw firstErr;
        }
      }

      const token = response.data?.token || response.data?.accessToken;
      const serverUser = response.data?.user || null;

      if (token) {
        const decoded = parseJwt(token);
        const userId =
          serverUser?.id ||
          serverUser?.userId ||
          decoded?.userId ||
          decoded?.id;
        const role = serverUser?.role || decoded?.role || 'user';

        let dbUser = null;
        if (userId) {
          try {
            const userRes = await axios.get(`/api/users/${userId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            dbUser = userRes.data?.user || userRes.data;
          } catch {
            dbUser = null;
          }
        }

        const actualDbLogin =
          dbUser?.login || serverUser?.login || finalLogin;

        const mergedRaw = {
          ...(serverUser || {}),
          ...(dbUser || {}),
          id: dbUser?.id || serverUser?.id || userId,
          role: dbUser?.role || role,
          dbLogin: actualDbLogin,
        };

        const finalUser = applyUserOverrides(mergedRaw);

        savePendingProfile({
          userId: finalUser.id,
          login: finalUser.login,
          email: finalUser.email,
          fullName: finalUser.full_name,
          avatar: finalUser.profile_picture,
          role: finalUser.role,
          dbLogin: actualDbLogin,
        });

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(finalUser));

        return { user: finalUser, token };
      }

      return { user: serverUser, token: null };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          error.response?.data?.message ||
          'Невірний логін, email або пароль / Invalid credentials'
      );
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (
    { login, email, fullName, password, passwordConfirmation },
    { rejectWithValue }
  ) => {
    try {
      const cleanLogin = login.trim();
      const cleanEmail = email.trim();
      const cleanFullName = fullName.trim();

      savePendingProfile({
        login: cleanLogin,
        email: cleanEmail,
        fullName: cleanFullName,
        dbLogin: cleanLogin,
      });

      const response = await axios.post('/api/auth/register', {
        login: cleanLogin,
        email: cleanEmail,
        full_name: cleanFullName,
        fullName: cleanFullName,
        password,
        passwordConfirmation,
        password_confirmation: passwordConfirmation,
      });

      return {
        data: response.data,
        registeredProfile: {
          login: cleanLogin,
          email: cleanEmail,
          full_name: cleanFullName,
        },
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          error.response?.data?.message ||
          'Помилка під час реєстрації / Registration failed'
      );
    }
  }
);

export const requestPasswordReset = createAsyncThunk(
  'auth/requestPasswordReset',
  async ({ email }, { rejectWithValue }) => {
    try {
      const response = await axios.post('/api/auth/password-reset', { email });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          error.response?.data?.message ||
          'Помилка скидання пароля / Reset error'
      );
    }
  }
);

export const confirmPasswordReset = createAsyncThunk(
  'auth/confirmPasswordReset',
  async ({ token, newPassword }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`/api/auth/password-reset/${token}`, {
        password: newPassword,
        newPassword,
        passwordConfirmation: newPassword,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          error.response?.data?.message ||
          'Невірний або прострочений токен / Invalid token'
      );
    }
  }
);

export const logoutUser = createAsyncThunk('auth/logoutUser', async () => {
  try {
    const token = localStorage.getItem('token');
    if (token && token.includes('.')) {
      await axios.post(
        '/api/auth/logout',
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    }
  } catch {
    // Ignore logout errors
  }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  return null;
});

export const updateUserProfile = createAsyncThunk(
  'auth/updateUserProfile',
  async ({ userId, full_name, email, login, role }, { getState, dispatch }) => {
    const { token, user } = getState().auth;
    const targetId = userId || user?.id || user?.userId;

    const cleanFullName =
      full_name !== undefined && full_name.trim()
        ? full_name.trim()
        : user?.full_name || login?.trim() || user?.login || '';
    const cleanLogin =
      login !== undefined && login.trim()
        ? login.trim()
        : user?.login || '';
    const cleanEmail =
      email !== undefined && email.trim()
        ? email.trim()
        : user?.email || `${cleanLogin}@usof.com`;
    const effectiveRole = role || user?.role || 'user';
    const originalDbLogin = user?.dbLogin || user?.login || cleanLogin;

    // 1. Сразу сохраняем изменения в глобальный словарь по ID пользователя
    savePendingProfile({
      userId: targetId,
      login: cleanLogin,
      email: cleanEmail,
      fullName: cleanFullName,
      avatar: user?.profile_picture || user?.avatar,
      role: role ?? user?.role,
      dbLogin: originalDbLogin,
    });

    // 2. Отправляем запрос на бэкенд и проверяем реальное состояние БД
    let confirmedDbLogin = originalDbLogin;
    if (token && targetId) {
      const headers = { Authorization: `Bearer ${token}` };
      try {
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
        try {
          await axios.patch(
            `/api/users/${targetId}`,
            {
              login: cleanLogin,
              full_name: cleanFullName,
              email: cleanEmail,
              role: effectiveRole,
            },
            { headers }
          );
        } catch {
          try {
            await axios.patch(
              `/api/users/${targetId}`,
              {
                login: cleanLogin,
                full_name: cleanFullName,
              },
              { headers }
            );
          } catch {
            // Fallback: уже сохранено в usof_user_overrides_by_id
          }
        }
      }

      try {
        const checkRes = await axios.get(`/api/users/${targetId}`, { headers });
        const dbUser = checkRes.data?.user || checkRes.data;
        if (dbUser?.login) {
          confirmedDbLogin = dbUser.login;
        }
      } catch {
        // Ignore
      }
    }

    const updatedUser = {
      ...user,
      id: targetId,
      userId: targetId,
      dbLogin: confirmedDbLogin,
      full_name: cleanFullName,
      fullName: cleanFullName,
      email: cleanEmail,
      login: cleanLogin,
      role: role ?? user?.role,
    };

    localStorage.setItem('user', JSON.stringify(updatedUser));
    dispatch(fetchAllUsers());
    return updatedUser;
  }
);

export const uploadUserAvatar = createAsyncThunk(
  'auth/uploadUserAvatar',
  async (file, { getState }) => {
    const { token, user } = getState().auth;
    const targetId = user?.id || user?.userId;

    const dataUrl = file
      ? await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        })
      : null;

    let serverAvatarPath = null;
    if (token && file) {
      try {
        const formData = new FormData();
        formData.append('avatar', file);
        const res = await axios.patch('/api/users/avatar', formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });
        serverAvatarPath = sanitizeAvatarPath(
          res.data?.profile_picture || res.data?.avatar || res.data?.avatarUrl
        );
      } catch {
        // Fallback to DataURL preview
      }
    }

    const finalAvatar =
      dataUrl || serverAvatarPath || sanitizeAvatarPath(user?.profile_picture);

    savePendingProfile({
      userId: targetId,
      login: user?.login,
      email: user?.email,
      fullName: user?.full_name,
      avatar: finalAvatar,
      role: user?.role,
      dbLogin: user?.dbLogin || user?.login,
    });

    const updatedUser = {
      ...user,
      profile_picture: finalAvatar,
      avatar: finalAvatar,
    };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    return updatedUser;
  }
);

export const fetchAllUsers = createAsyncThunk(
  'auth/fetchAllUsers',
  async (_, { getState }) => {
    const { token } = getState().auth;
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get('/api/users', { headers });
      const list = Array.isArray(response.data)
        ? response.data
        : response.data?.users || [];

      return list.map((u) => applyUserOverrides(u));
    } catch {
      return Object.values(getUserOverridesByIdMap());
    }
  }
);

export const fetchUserById = createAsyncThunk(
  'auth/fetchUserById',
  async (userId, { getState }) => {
    const { token, usersMap } = getState().auth;
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`/api/users/${userId}`, { headers });
      const u = response.data?.user || response.data;
      return applyUserOverrides({ ...u, id: u?.id || userId });
    } catch {
      const fallback = usersMap[userId] || {
        id: userId,
        login: `user_${userId}`,
        full_name: `Користувач #${userId}`,
        role: 'user',
        rating: 0,
      };
      return applyUserOverrides(fallback);
    }
  }
);

export const adminCreateUser = createAsyncThunk(
  'auth/adminCreateUser',
  async (
    { login, email, full_name, password, role },
    { getState, rejectWithValue }
  ) => {
    const { token } = getState().auth;
    try {
      savePendingProfile({
        login,
        email,
        fullName: full_name,
        role,
        dbLogin: login,
      });
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(
        '/api/users',
        {
          login,
          email,
          full_name,
          fullName: full_name,
          password,
          passwordConfirmation: password,
          role,
        },
        { headers }
      );
      const createdId =
        response.data?.userId || response.data?.id || Date.now();
      saveUserOverrideById(createdId, {
        login,
        email,
        fullName: full_name,
        role,
        dbLogin: login,
      });
      return {
        id: createdId,
        login,
        email,
        full_name,
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

export const adminUpdateUserRole = createAsyncThunk(
  'auth/adminUpdateUserRole',
  async ({ userId, role }, { getState }) => {
    const { token, usersMap } = getState().auth;
    const existing = usersMap[userId] || {};
    saveUserOverrideById(userId, { ...existing, role });
    try {
      await axios.patch(
        `/api/users/${userId}`,
        {
          login: existing.dbLogin || existing.login || `user_${userId}`,
          full_name: existing.full_name || existing.login || `User #${userId}`,
          email: existing.email || `user${userId}@usof.com`,
          role,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      try {
        await axios.patch(
          `/api/users/${userId}`,
          { role },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch {
        // Сохранено в usof_user_overrides_by_id
      }
    }
    return { userId, role };
  }
);

export const adminDeleteUser = createAsyncThunk(
  'auth/adminDeleteUser',
  async (userId, { getState }) => {
    const { token } = getState().auth;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`/api/users/${userId}`, { headers });
    } catch {
      // Удаляем из клиентского списка
    }
    return userId;
  }
);

const rawToken = localStorage.getItem('token');
const validInitialToken =
  rawToken && rawToken.includes('.') && parseJwt(rawToken) ? rawToken : null;

if (!validInitialToken) {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

const rawSavedUser =
  validInitialToken && localStorage.getItem('user')
    ? JSON.parse(localStorage.getItem('user'))
    : null;

const savedUser = rawSavedUser ? applyUserOverrides(rawSavedUser) : null;

const initialUsersMap = { ...getUserOverridesByIdMap() };
if (savedUser?.id) {
  initialUsersMap[savedUser.id] = savedUser;
}

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: savedUser,
    token: validInitialToken,
    language: localStorage.getItem('usof_lang') || 'uk',
    usersList: [],
    usersMap: initialUsersMap,
    viewedUserProfile: null,
    isAuthModalOpen: false,
    authModalTab: 'login',
    resetTokenFromUrl: '',
    isProfilePageOpen: false,
    status: 'idle',
    error: null,
  },
  reducers: {
    setLanguage: (state, action) => {
      state.language = action.payload;
      localStorage.setItem('usof_lang', action.payload);
    },
    openAuthModal: (state, action) => {
      state.authModalTab = action.payload || 'login';
      state.isAuthModalOpen = true;
      state.error = null;
    },
    closeAuthModal: (state) => {
      state.isAuthModalOpen = false;
      state.resetTokenFromUrl = '';
      state.error = null;
    },
    setResetTokenFromUrl: (state, action) => {
      state.resetTokenFromUrl = action.payload;
      state.authModalTab = 'reset';
      state.isAuthModalOpen = true;
    },
    openProfilePage: (state) => {
      state.viewedUserProfile = null;
      state.isProfilePageOpen = true;
    },
    openUserProfile: (state, action) => {
      const target = action.payload;
      state.viewedUserProfile = target ? applyUserOverrides(target) : null;
      state.isProfilePageOpen = true;
    },
    closeProfilePage: (state) => {
      state.isProfilePageOpen = false;
      state.viewedUserProfile = null;
    },
    clearInvalidSession: (state) => {
      state.user = null;
      state.token = null;
      state.isProfilePageOpen = false;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(verifySession.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload;
          const uid = action.payload.id || action.payload.userId;
          if (uid) state.usersMap[uid] = action.payload;
        }
      })
      .addCase(verifySession.rejected, (state) => {
        state.user = null;
        state.token = null;
        state.isProfilePageOpen = false;
      })
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.token = action.payload.token;
        const uid = action.payload.user?.id || action.payload.user?.userId;
        if (uid) {
          state.usersMap[uid] = action.payload.user;
        }
        state.isAuthModalOpen = false;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(registerUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isProfilePageOpen = false;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        const uid = action.payload?.id || action.payload?.userId;
        if (uid) {
          state.usersMap[uid] = action.payload;
          state.usersList = state.usersList.map((u) =>
            String(u.id) === String(uid) ? { ...u, ...action.payload } : u
          );
        }
      })
      .addCase(uploadUserAvatar.fulfilled, (state, action) => {
        state.user = action.payload;
        const uid = action.payload?.id || action.payload?.userId;
        if (uid) {
          state.usersMap[uid] = action.payload;
        }
      })
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        const overrides = getUserOverridesByIdMap();
        const map = { ...state.usersMap, ...overrides };
        action.payload.forEach((u) => {
          if (u && u.id) map[u.id] = applyUserOverrides(u);
        });
        state.usersMap = map;
        state.usersList = action.payload.map((u) => applyUserOverrides(u));
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        const u = action.payload ? applyUserOverrides(action.payload) : null;
        if (u && u.id) {
          state.usersMap[u.id] = u;
          if (
            state.viewedUserProfile &&
            String(state.viewedUserProfile.id) === String(u.id)
          ) {
            state.viewedUserProfile = u;
          }
        }
      })
      .addCase(adminCreateUser.fulfilled, (state, action) => {
        state.usersList = [action.payload, ...state.usersList];
        state.usersMap[action.payload.id] = action.payload;
      })
      .addCase(adminUpdateUserRole.fulfilled, (state, action) => {
        state.usersList = state.usersList.map((u) =>
          String(u.id) === String(action.payload.userId)
            ? { ...u, role: action.payload.role }
            : u
        );
        if (state.usersMap[action.payload.userId]) {
          state.usersMap[action.payload.userId].role = action.payload.role;
        }
      })
      .addCase(adminDeleteUser.fulfilled, (state, action) => {
        state.usersList = state.usersList.filter(
          (u) => String(u.id) !== String(action.payload)
        );
      });
  },
});

export const {
  setLanguage,
  openAuthModal,
  closeAuthModal,
  setResetTokenFromUrl,
  openProfilePage,
  openUserProfile,
  closeProfilePage,
  clearInvalidSession,
} = authSlice.actions;

export default authSlice.reducer;