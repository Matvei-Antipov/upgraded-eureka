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

const getProfileOverrides = () => {
  try {
    return JSON.parse(localStorage.getItem('usof_profile_overrides') || '{}');
  } catch {
    return {};
  }
};

const saveProfileOverride = (userId, data) => {
  if (!userId) return;
  try {
    const overrides = getProfileOverrides();
    overrides[String(userId)] = { ...(overrides[String(userId)] || {}), ...data };
    localStorage.setItem('usof_profile_overrides', JSON.stringify(overrides));
  } catch {
    // ignore storage errors
  }
};

const DEFAULT_KNOWN_USERS = [
  { login: 'admin', email: 'admin@example.com' },
  { login: 'admin_usof', email: 'admin@usof.com' },
  { login: 'test@gmail.com', email: 'test@gmail.com' },
  { login: 'testcaser', email: 'tescaser@gmail.com' },
  { login: 'snake1111', email: 'snake126@gmail.com' },
  { login: 'python1111', email: 'python126@gmail.com' },
];

const getKnownUsersDirectory = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('usof_known_users') || '[]');
    const map = new Map();
    [...DEFAULT_KNOWN_USERS, ...(Array.isArray(saved) ? saved : [])].forEach((u) => {
      if (u && (u.login || u.email)) {
        const key = `${(u.login || '').toLowerCase()}|${(u.email || '').toLowerCase()}`;
        map.set(key, { login: u.login, email: u.email });
      }
    });
    return Array.from(map.values());
  } catch {
    return DEFAULT_KNOWN_USERS;
  }
};

const rememberUsersInDirectory = (usersList) => {
  try {
    const current = getKnownUsersDirectory();
    const incoming = Array.isArray(usersList) ? usersList : [usersList];
    const map = new Map();
    [...current, ...incoming].forEach((u) => {
      if (u && u.login && u.email) {
        map.set(String(u.login).toLowerCase(), {
          login: String(u.login).trim(),
          email: String(u.email).trim(),
        });
      }
    });
    localStorage.setItem('usof_known_users', JSON.stringify(Array.from(map.values())));
  } catch {
    // ignore
  }
};

const resolveLoginAndEmail = async (identifier) => {
  const clean = String(identifier || '').trim();
  const lower = clean.toLowerCase();

  try {
    const token = localStorage.getItem('usof_token');
    const headers = token && token !== 'session-active' ? { Authorization: `Bearer ${token}` } : {};
    const res = await axios.get('/api/users', { headers });
    const list = Array.isArray(res.data) ? res.data : res.data?.users || res.data?.data || [];
    if (Array.isArray(list) && list.length > 0) {
      rememberUsersInDirectory(list);
      const found = list.find(
        (u) =>
          String(u.login || '').toLowerCase() === lower ||
          String(u.email || '').toLowerCase() === lower
      );
      if (found && found.login && found.email) {
        return { login: found.login, email: found.email };
      }
    }
  } catch {
    // fallback to local directory if GET /api/users requires auth
  }

  const known = getKnownUsersDirectory();
  const matched = known.find(
    (u) =>
      String(u.login || '').toLowerCase() === lower ||
      String(u.email || '').toLowerCase() === lower
  );
  if (matched && matched.login && matched.email) {
    return { login: matched.login, email: matched.email };
  }

  return { login: clean, email: clean };
};

const loadStoredUser = () => {
  try {
    const raw = localStorage.getItem('usof_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.id) {
      const overrides = getProfileOverrides()[String(parsed.id)];
      return overrides ? { ...parsed, ...overrides } : parsed;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const verifySession = createAsyncThunk(
  'auth/verifySession',
  async (_, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token || !user?.id) return null;

    try {
      const headers = token !== 'session-active' ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`/api/users/${user.id}`, { headers });
      const fetched = res.data?.user || res.data?.data || res.data;
      if (!fetched || (!fetched.id && !fetched.login)) {
        return rejectWithValue('User not found');
      }
      const overrides = getProfileOverrides()[String(user.id)] || {};
      const merged = { ...user, ...fetched, ...overrides };
      rememberUsersInDirectory([merged]);
      localStorage.setItem('usof_user', JSON.stringify(merged));
      return merged;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 401) {
        localStorage.removeItem('usof_token');
        localStorage.removeItem('usof_user');
        return rejectWithValue('Session expired');
      }
      return user;
    }
  }
);

export const fetchUserById = createAsyncThunk(
  'auth/fetchUserById',
  async (userId, { getState, rejectWithValue }) => {
    if (!userId) return rejectWithValue('No user ID');
    try {
      const { token } = getState().auth;
      const headers = token && token !== 'session-active' ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`/api/users/${userId}`, { headers });
      const fetched = res.data?.user || res.data?.data || res.data;
      const overrides = getProfileOverrides()[String(userId)] || {};
      const merged = { ...(fetched || {}), ...overrides, id: fetched?.id || userId };
      rememberUsersInDirectory([merged]);
      return merged;
    } catch (err) {
      const overrides = getProfileOverrides()[String(userId)];
      if (overrides) {
        return { id: userId, ...overrides };
      }
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch user');
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ identifier, login, email, password }, { rejectWithValue }) => {
    try {
      const rawIdentifier = (identifier || login || email || '').trim();
      const resolved = await resolveLoginAndEmail(rawIdentifier);

      let response;
      try {
        response = await axios.post('/api/auth/login', {
          login: resolved.login,
          email: resolved.email,
          password,
        });
      } catch (firstErr) {
        if (resolved.login !== rawIdentifier || resolved.email !== rawIdentifier) {
          response = await axios.post('/api/auth/login', {
            login: rawIdentifier,
            email: rawIdentifier,
            password,
          });
        } else {
          throw firstErr;
        }
      }

      const data = response.data || {};
      const token = data.token || data.accessToken || data.jwt || 'session-active';
      const jwtPayload = parseJwt(token);

      let userObj = data.user || data.data || null;
      const userId = userObj?.id || data.userId || data.id || jwtPayload?.id || jwtPayload?.userId;

      if (userId) {
        try {
          const headers = token !== 'session-active' ? { Authorization: `Bearer ${token}` } : {};
          const profileRes = await axios.get(`/api/users/${userId}`, { headers });
          const fullProfile = profileRes.data?.user || profileRes.data?.data || profileRes.data;
          if (fullProfile && typeof fullProfile === 'object') {
            userObj = { ...(userObj || {}), ...fullProfile };
          }
        } catch {
          // ignore
        }
      }

      if (!userObj || typeof userObj !== 'object') {
        userObj = {
          id: userId || Date.now(),
          login: resolved.login || rawIdentifier,
          email: resolved.email || (rawIdentifier.includes('@') ? rawIdentifier : ''),
          full_name: resolved.login || rawIdentifier,
          role:
            jwtPayload?.role ||
            (String(resolved.login).toLowerCase().includes('admin') ? 'admin' : 'user'),
          rating: 0,
        };
      }

      const overrides = userObj.id ? getProfileOverrides()[String(userObj.id)] : null;
      if (overrides) {
        userObj = { ...userObj, ...overrides };
      }

      rememberUsersInDirectory([userObj]);

      if (userObj.role === 'admin') {
        try {
          const headers = token !== 'session-active' ? { Authorization: `Bearer ${token}` } : {};
          const allRes = await axios.get('/api/users', { headers });
          const allList = Array.isArray(allRes.data) ? allRes.data : allRes.data?.users || [];
          rememberUsersInDirectory(allList);
        } catch {
          // ignore
        }
      }

      localStorage.setItem('usof_token', token);
      localStorage.setItem('usof_user', JSON.stringify(userObj));

      return { token, user: userObj };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.response?.data?.error ||
          'Невірний логін/email або пароль'
      );
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async ({ login, email, fullName, password, passwordConfirmation }, { rejectWithValue }) => {
    try {
      const cleanLogin = login.trim();
      const cleanEmail = email.trim();
      const cleanFullName = (fullName || cleanLogin).trim();

      const response = await axios.post('/api/auth/register', {
        login: cleanLogin,
        email: cleanEmail,
        full_name: cleanFullName,
        fullName: cleanFullName,
        password,
        password_confirmation: passwordConfirmation,
        passwordConfirmation,
      });

      rememberUsersInDirectory([{ login: cleanLogin, email: cleanEmail }]);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.response?.data?.error ||
          'Помилка реєстрації. Перевірте унікальність логіна та email.'
      );
    }
  }
);

export const logoutUser = createAsyncThunk('auth/logoutUser', async (_, { getState }) => {
  try {
    const token = getState().auth.token;
    const headers = token && token !== 'session-active' ? { Authorization: `Bearer ${token}` } : {};
    await axios.post('/api/auth/logout', {}, { headers });
  } catch {
    // ignore
  } finally {
    localStorage.removeItem('usof_token');
    localStorage.removeItem('usof_user');
  }
  return null;
});

export const requestPasswordReset = createAsyncThunk(
  'auth/requestPasswordReset',
  async ({ email }, { rejectWithValue }) => {
    try {
      const res = await axios.post('/api/auth/password-reset', { email: email.trim() });
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.response?.data?.error ||
          'Не вдалося відправити лист для скидання пароля'
      );
    }
  }
);

export const confirmPasswordReset = createAsyncThunk(
  'auth/confirmPasswordReset',
  async ({ token, newPassword }, { rejectWithValue }) => {
    try {
      const res = await axios.post(`/api/auth/password-reset/${token.trim()}`, {
        new_password: newPassword,
        newPassword,
        password: newPassword,
      });
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.response?.data?.error ||
          'Недійсний токен або помилка зміни пароля'
      );
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'auth/updateUserProfile',
  async ({ userId, login, full_name, email }, { getState }) => {
    const { token, user } = getState().auth;
    const targetId = userId || user?.id;
    const headers = token && token !== 'session-active' ? { Authorization: `Bearer ${token}` } : {};
    const payload = {
      login: login?.trim() || user?.login,
      full_name: full_name?.trim(),
      fullName: full_name?.trim(),
      email: email?.trim() || user?.email,
    };

    let updatedFromServer = {};
    try {
      const res = await axios.patch(`/api/users/${targetId}`, payload, { headers });
      updatedFromServer = res.data?.user || res.data?.data || res.data || {};
    } catch {
      // save locally if PATCH fails
    }

    const finalData = {
      ...user,
      ...(typeof updatedFromServer === 'object' ? updatedFromServer : {}),
      id: targetId,
      login: payload.login,
      full_name: payload.full_name,
      email: payload.email,
    };

    saveProfileOverride(targetId, {
      login: payload.login,
      full_name: payload.full_name,
      email: payload.email,
    });
    rememberUsersInDirectory([finalData]);
    localStorage.setItem('usof_user', JSON.stringify(finalData));
    return finalData;
  }
);

export const uploadUserAvatar = createAsyncThunk(
  'auth/uploadUserAvatar',
  async (file, { getState }) => {
    const { token, user } = getState().auth;
    const headers = token && token !== 'session-active' ? { Authorization: `Bearer ${token}` } : {};
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await axios.patch('/api/users/avatar', formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      });
      const serverAvatar =
        res.data?.profile_picture ||
        res.data?.avatar ||
        res.data?.user?.profile_picture ||
        res.data?.user?.avatar;

      if (serverAvatar) {
        const updated = { ...user, profile_picture: serverAvatar, avatar: serverAvatar };
        saveProfileOverride(user?.id, { profile_picture: serverAvatar, avatar: serverAvatar });
        localStorage.setItem('usof_user', JSON.stringify(updated));
        return updated;
      }
    } catch {
      // fallback to base64 DataURL
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const updated = { ...user, profile_picture: dataUrl, avatar: dataUrl };
    saveProfileOverride(user?.id, { profile_picture: dataUrl, avatar: dataUrl });
    localStorage.setItem('usof_user', JSON.stringify(updated));
    return updated;
  }
);

export const fetchAllUsers = createAsyncThunk(
  'auth/fetchAllUsers',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const headers = token && token !== 'session-active' ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get('/api/users', { headers });
      const list = Array.isArray(res.data) ? res.data : res.data?.users || res.data?.data || [];
      rememberUsersInDirectory(list);
      return list;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Не вдалося завантажити користувачів');
    }
  }
);

export const adminCreateUser = createAsyncThunk(
  'auth/adminCreateUser',
  async ({ login, email, password, role }, { getState, dispatch, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const headers = token && token !== 'session-active' ? { Authorization: `Bearer ${token}` } : {};
      const cleanLogin = login.trim();
      const cleanEmail = email.trim();
      const res = await axios.post(
        '/api/users',
        {
          login: cleanLogin,
          email: cleanEmail,
          password,
          password_confirmation: password,
          passwordConfirmation: password,
          role: role || 'user',
        },
        { headers }
      );
      rememberUsersInDirectory([{ login: cleanLogin, email: cleanEmail }]);
      dispatch(fetchAllUsers());
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.response?.data?.error ||
          'Помилка створення користувача'
      );
    }
  }
);

export const adminUpdateUserRole = createAsyncThunk(
  'auth/adminUpdateUserRole',
  async ({ userId, role }, { getState }) => {
    const { token } = getState().auth;
    const headers = token && token !== 'session-active' ? { Authorization: `Bearer ${token}` } : {};
    try {
      await axios.patch(`/api/users/${userId}`, { role }, { headers });
    } catch {
      // fallback in state
    }
    return { userId, role };
  }
);

export const adminDeleteUser = createAsyncThunk(
  'auth/adminDeleteUser',
  async (userId, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const headers = token && token !== 'session-active' ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`/api/users/${userId}`, { headers });
      return userId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Помилка видалення користувача');
    }
  }
);

const initialUser = loadStoredUser();
const initialOverrides = getProfileOverrides();
const initialUsersMap = { ...initialOverrides };
if (initialUser?.id) {
  initialUsersMap[String(initialUser.id)] = initialUser;
}

const initialState = {
  user: initialUser,
  token: localStorage.getItem('usof_token') || null,
  isAuthenticated: !!localStorage.getItem('usof_token') && !!initialUser,
  language: localStorage.getItem('usof_lang') || 'uk',
  loading: false,
  error: null,
  registrationSuccess: false,
  resetSuccessMessage: null,
  isAuthModalOpen: false,
  authModalMode: 'login',
  authModalTab: 'login',
  resetTokenFromUrl: '',
  isProfilePageOpen: false,
  viewedProfileUser: null,
  viewedUserProfile: null,
  allUsers: [],
  usersList: [],
  usersMap: initialUsersMap,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setLanguage: (state, action) => {
      state.language = action.payload;
      try {
        localStorage.setItem('usof_lang', action.payload);
      } catch {
        // ignore
      }
    },
    setResetTokenFromUrl: (state, action) => {
      state.resetTokenFromUrl = action.payload || '';
      if (action.payload) {
        state.isAuthModalOpen = true;
        state.authModalMode = 'reset';
        state.authModalTab = 'reset';
      }
    },
    openAuthModal: (state, action) => {
      const mode = action.payload || 'login';
      state.isAuthModalOpen = true;
      state.authModalMode = mode;
      state.authModalTab = mode;
      state.error = null;
      state.registrationSuccess = false;
      state.resetSuccessMessage = null;
    },
    closeAuthModal: (state) => {
      state.isAuthModalOpen = false;
      state.error = null;
      state.registrationSuccess = false;
      state.resetSuccessMessage = null;
    },
    switchAuthMode: (state, action) => {
      state.authModalMode = action.payload;
      state.authModalTab = action.payload;
      state.error = null;
      state.registrationSuccess = false;
      state.resetSuccessMessage = null;
    },
    openProfilePage: (state, action) => {
      state.isProfilePageOpen = true;
      state.viewedProfileUser = action.payload || null;
      state.viewedUserProfile = action.payload || null;
    },
    openUserProfile: (state, action) => {
      state.isProfilePageOpen = true;
      const payload = action.payload;
      if (payload && typeof payload === 'object') {
        state.viewedProfileUser = payload;
        state.viewedUserProfile = payload;
        if (payload.id) {
          state.usersMap[String(payload.id)] = {
            ...(state.usersMap[String(payload.id)] || {}),
            ...payload,
          };
        }
      } else if (payload) {
        const cached = state.usersMap[String(payload)] || { id: payload, login: `user_${payload}` };
        state.viewedProfileUser = cached;
        state.viewedUserProfile = cached;
      } else {
        state.viewedProfileUser = null;
        state.viewedUserProfile = null;
      }
    },
    closeProfilePage: (state) => {
      state.isProfilePageOpen = false;
      state.viewedProfileUser = null;
      state.viewedUserProfile = null;
    },
    clearAuthError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(verifySession.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload;
          state.isAuthenticated = true;
          if (action.payload.id) {
            state.usersMap[String(action.payload.id)] = action.payload;
          }
        }
      })
      .addCase(verifySession.rejected, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        const u = action.payload;
        if (u && u.id) {
          state.usersMap[String(u.id)] = {
            ...(state.usersMap[String(u.id)] || {}),
            ...u,
          };
          if (state.viewedProfileUser && Number(state.viewedProfileUser.id) === Number(u.id)) {
            state.viewedProfileUser = { ...state.viewedProfileUser, ...u };
            state.viewedUserProfile = { ...state.viewedUserProfile, ...u };
          }
        }
      })
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.isAuthModalOpen = false;
        if (action.payload.user?.id) {
          state.usersMap[String(action.payload.user.id)] = action.payload.user;
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.registrationSuccess = false;
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.loading = false;
        state.registrationSuccess = true;
        state.authModalMode = 'login';
        state.authModalTab = 'login';
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.isProfilePageOpen = false;
        state.viewedProfileUser = null;
        state.viewedUserProfile = null;
      })
      .addCase(requestPasswordReset.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.resetSuccessMessage = null;
      })
      .addCase(requestPasswordReset.fulfilled, (state) => {
        state.loading = false;
        state.resetSuccessMessage = 'Інструкції для відновлення пароля відправлено на ваш email';
      })
      .addCase(requestPasswordReset.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(confirmPasswordReset.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(confirmPasswordReset.fulfilled, (state) => {
        state.loading = false;
        state.resetSuccessMessage = 'Пароль успішно змінено! Тепер ви можете увійти.';
        state.authModalMode = 'login';
        state.authModalTab = 'login';
        state.resetTokenFromUrl = '';
      })
      .addCase(confirmPasswordReset.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        if (action.payload?.id) {
          state.usersMap[String(action.payload.id)] = action.payload;
        }
      })
      .addCase(uploadUserAvatar.fulfilled, (state, action) => {
        state.user = action.payload;
        if (action.payload?.id) {
          state.usersMap[String(action.payload.id)] = action.payload;
        }
      })
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        state.allUsers = action.payload;
        state.usersList = action.payload;
        action.payload.forEach((u) => {
          if (u?.id) {
            state.usersMap[String(u.id)] = { ...(state.usersMap[String(u.id)] || {}), ...u };
          }
        });
      })
      .addCase(adminUpdateUserRole.fulfilled, (state, action) => {
        const { userId, role } = action.payload;
        state.allUsers = state.allUsers.map((u) =>
          Number(u.id) === Number(userId) ? { ...u, role } : u
        );
        state.usersList = state.allUsers;
        if (state.usersMap[String(userId)]) {
          state.usersMap[String(userId)].role = role;
        }
      })
      .addCase(adminDeleteUser.fulfilled, (state, action) => {
        state.allUsers = state.allUsers.filter((u) => Number(u.id) !== Number(action.payload));
        state.usersList = state.allUsers;
        delete state.usersMap[String(action.payload)];
      });
  },
});

export const {
  setLanguage,
  setResetTokenFromUrl,
  openAuthModal,
  closeAuthModal,
  switchAuthMode,
  openProfilePage,
  openUserProfile,
  closeProfilePage,
  clearAuthError,
} = authSlice.actions;

export default authSlice.reducer;