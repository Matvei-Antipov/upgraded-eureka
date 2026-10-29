import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, {
  TOKEN_KEY,
  parseJwt,
  isTokenExpired,
  toApiError,
} from '../api/client';
import { cleanupLegacyStorage } from '../utils/storage';

cleanupLegacyStorage();

const USER_CACHE_KEY = 'usof_current_user';
const pendingUserRequests = new Set();

const loadCachedUser = () => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || isTokenExpired(token)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_CACHE_KEY);
      return null;
    }
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveCachedUser = (user) => {
  try {
    if (user) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {
    // ignore storage errors
  }
};

export const verifySession = createAsyncThunk(
  'auth/verifySession',
  async (_, { getState, rejectWithValue }) => {
    const { token, user } = getState().auth;
    if (!token || isTokenExpired(token)) {
      localStorage.removeItem(TOKEN_KEY);
      saveCachedUser(null);
      return rejectWithValue(toApiError(null, 'sessionExpiredToast'));
    }

    const payload = parseJwt(token);
    const userId = payload?.userId || payload?.id || user?.id;
    if (!userId) {
      localStorage.removeItem(TOKEN_KEY);
      saveCachedUser(null);
      return rejectWithValue(toApiError(null, 'sessionExpiredToast'));
    }

    try {
      const res = await api.get(`/users/${userId}`);
      const fetched = res.data?.user || res.data?.data || res.data;
      if (!fetched || !fetched.id) {
        localStorage.removeItem(TOKEN_KEY);
        saveCachedUser(null);
        return rejectWithValue(toApiError(null, 'sessionExpiredToast'));
      }
      saveCachedUser(fetched);
      return fetched;
    } catch (error) {
      if (error.response?.status === 404 || error.response?.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        saveCachedUser(null);
        return rejectWithValue(toApiError(error, 'sessionExpiredToast'));
      }
      return user;
    }
  }
);

export const fetchUserById = createAsyncThunk(
  'auth/fetchUserById',
  async (userId, { rejectWithValue }) => {
    if (!userId) return rejectWithValue('No user ID');
    try {
      const res = await api.get(`/users/${userId}`);
      const fetched = res.data?.user || res.data?.data || res.data;
      if (!fetched || !fetched.id) {
        return { id: Number(userId), _notFound: true };
      }
      return fetched;
    } catch (error) {
      if (error.response?.status === 404) {
        return { id: Number(userId), _notFound: true };
      }
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    } finally {
      pendingUserRequests.delete(String(userId));
    }
  },
  {
    condition: (userId, { getState }) => {
      if (!userId) return false;
      const key = String(userId);
      const existing = getState().auth.usersMap[key];
      if (
        (existing && (existing.email || existing._notFound)) ||
        pendingUserRequests.has(key)
      ) {
        return false;
      }
      pendingUserRequests.add(key);
      return true;
    },
  }
);

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ identifier, login, email, password }, { rejectWithValue }) => {
    try {
      const rawIdentifier = String(identifier || login || email || '').trim();
      // Backend checks `WHERE login = ? OR email = ?`, so passing rawIdentifier
      // to both fields lets the user sign in with either login or email.
      const response = await api.post('/auth/login', {
        login: rawIdentifier,
        email: rawIdentifier,
        password,
      });

      const token = response.data?.token;
      const jwtPayload = parseJwt(token);
      if (!token || !jwtPayload?.userId) {
        return rejectWithValue(toApiError(null, 'loginFailedError'));
      }

      localStorage.setItem(TOKEN_KEY, token);

      const profileRes = await api.get(`/users/${jwtPayload.userId}`);
      let userObj = profileRes.data;

      if (userObj?.login) {
        try {
          const pendingKey = `usof_pending_fullname_${userObj.login.toLowerCase()}`;
          const pendingFullName = sessionStorage.getItem(pendingKey);
          if (
            pendingFullName &&
            (!userObj.full_name || userObj.full_name === userObj.login)
          ) {
            await api.patch(`/users/${userObj.id}`, {
              full_name: pendingFullName,
              email: userObj.email,
            });
            userObj = { ...userObj, full_name: pendingFullName };
          }
          if (pendingFullName) {
            sessionStorage.removeItem(pendingKey);
          }
        } catch {
          // ignore optional full_name sync error
        }
      }

      saveCachedUser(userObj);
      return { token, user: userObj };
    } catch (error) {
      return rejectWithValue(toApiError(error, 'loginFailedError'));
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async ({ login, email, fullName, password, passwordConfirmation }, { rejectWithValue }) => {
    try {
      const cleanLogin = login.trim();
      const cleanEmail = email.trim();
      const cleanFullName = (fullName || '').trim();

      const response = await api.post('/auth/register', {
        login: cleanLogin,
        email: cleanEmail,
        password,
        password_confirmation: passwordConfirmation,
      });

      // Remember desired full name until the user signs in so we can sync it
      // via PATCH /api/users/:id if needed.
      if (cleanFullName && cleanFullName !== cleanLogin) {
        try {
          sessionStorage.setItem(
            `usof_pending_fullname_${cleanLogin.toLowerCase()}`,
            cleanFullName
          );
        } catch {
          // ignore
        }
      }

      return response.data;
    } catch (error) {
      return rejectWithValue(toApiError(error, 'registerFailedError'));
    }
  }
);

export const logoutUser = createAsyncThunk('auth/logoutUser', async () => {
  try {
    await api.post('/auth/logout', {});
  } catch {
    // Even if server token is already expired, clear client session.
  } finally {
    localStorage.removeItem(TOKEN_KEY);
    saveCachedUser(null);
  }
  return null;
});

export const requestPasswordReset = createAsyncThunk(
  'auth/requestPasswordReset',
  async ({ email }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/password-reset', { email: email.trim() });
      return res.data;
    } catch (error) {
      return rejectWithValue(toApiError(error, 'resetRequestFailedError'));
    }
  }
);

export const confirmPasswordReset = createAsyncThunk(
  'auth/confirmPasswordReset',
  async ({ token, newPassword }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/auth/password-reset/${encodeURIComponent(token.trim())}`, {
        new_password: newPassword,
      });
      return res.data;
    } catch (error) {
      return rejectWithValue(toApiError(error, 'resetConfirmFailedError'));
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'auth/updateUserProfile',
  async ({ userId, full_name, email }, { getState, rejectWithValue }) => {
    const { user } = getState().auth;
    const targetId = Number(userId || user?.id);
    const cleanFullName = full_name?.trim();
    const cleanEmail = email?.trim();

    try {
      await api.patch(`/users/${targetId}`, {
        full_name: cleanFullName,
        email: cleanEmail,
      });

      const refreshed = await api.get(`/users/${targetId}`);
      const updatedUser = refreshed.data;

      if (user && Number(user.id) === targetId) {
        saveCachedUser(updatedUser);
      }
      return updatedUser;
    } catch (error) {
      // Backend returns 404 when values are identical to current DB row
      if (
        error.response?.status === 404 &&
        String(error.response?.data?.error || '').includes('no changes')
      ) {
        const refreshed = await api.get(`/users/${targetId}`);
        return refreshed.data;
      }
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const uploadUserAvatar = createAsyncThunk(
  'auth/uploadUserAvatar',
  async (file, { getState, rejectWithValue }) => {
    const { user } = getState().auth;
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await api.patch('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const filename =
        res.data?.filename ||
        res.data?.profile_picture ||
        res.data?.avatar;

      if (!filename) {
        return rejectWithValue(toApiError(null, 'actionFailedError'));
      }

      const updated = { ...user, profile_picture: filename };
      saveCachedUser(updated);
      return updated;
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const fetchAllUsers = createAsyncThunk(
  'auth/fetchAllUsers',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/users');
      return Array.isArray(res.data) ? res.data : [];
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

export const adminCreateUser = createAsyncThunk(
  'auth/adminCreateUser',
  async ({ login, email, password, passwordConfirmation, role }, { dispatch, rejectWithValue }) => {
    try {
      const cleanLogin = login.trim();
      const cleanEmail = email.trim();
      const res = await api.post('/users', {
        login: cleanLogin,
        email: cleanEmail,
        password,
        password_confirmation: passwordConfirmation || password,
        role: role || 'user',
      });
      dispatch(fetchAllUsers());
      return res.data;
    } catch (error) {
      return rejectWithValue(toApiError(error, 'registerFailedError'));
    }
  }
);

export const adminDeleteUser = createAsyncThunk(
  'auth/adminDeleteUser',
  async (userId, { getState, dispatch, rejectWithValue }) => {
    try {
      await api.delete(`/users/${userId}`);
      const currentId = getState().auth.user?.id;
      if (Number(currentId) === Number(userId)) {
        dispatch(logoutUser());
      }
      return Number(userId);
    } catch (error) {
      return rejectWithValue(toApiError(error, 'actionFailedError'));
    }
  }
);

const initialUser = loadCachedUser();
const initialToken = initialUser ? localStorage.getItem(TOKEN_KEY) : null;
const initialUsersMap = initialUser?.id ? { [String(initialUser.id)]: initialUser } : {};

const initialState = {
  user: initialUser,
  token: initialToken,
  isAuthenticated: Boolean(initialToken && initialUser),
  language: localStorage.getItem('usof_lang') || 'uk',
  loading: false,
  error: null,
  registrationSuccess: false,
  resetSuccessKey: null,
  isAuthModalOpen: false,
  authModalMode: 'login',
  resetTokenFromUrl: '',
  isProfileOpen: false,
  viewedProfileUser: null,
  allUsers: [],
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
      }
    },
    openAuthModal: (state, action) => {
      const mode = action.payload || 'login';
      state.isAuthModalOpen = true;
      state.authModalMode = mode;
      state.error = null;
      state.registrationSuccess = false;
      state.resetSuccessKey = null;
    },
    closeAuthModal: (state) => {
      state.isAuthModalOpen = false;
      state.error = null;
      state.registrationSuccess = false;
      state.resetSuccessKey = null;
    },
    switchAuthMode: (state, action) => {
      state.authModalMode = action.payload;
      state.error = null;
      state.registrationSuccess = false;
      state.resetSuccessKey = null;
    },
    openProfilePage: (state, action) => {
      state.isProfileOpen = true;
      state.viewedProfileUser = action.payload || null;
    },
    openUserProfile: (state, action) => {
      state.isProfileOpen = true;
      const payload = action.payload;
      if (payload && typeof payload === 'object') {
        const existing = payload.id
          ? state.usersMap[String(payload.id)]
          : null;
        state.viewedProfileUser = existing && !existing._notFound
          ? { ...payload, ...existing }
          : payload;
        if (payload.id && payload.email) {
          state.usersMap[String(payload.id)] = {
            ...(existing || {}),
            ...payload,
          };
        }
      } else if (payload) {
        const cached = state.usersMap[String(payload)] || {
          id: Number(payload),
          login: `user_${payload}`,
        };
        state.viewedProfileUser = cached;
      } else {
        state.viewedProfileUser = null;
      }
    },
    closeProfilePage: (state) => {
      state.isProfileOpen = false;
      state.viewedProfileUser = null;
    },
    clearAuthError: (state) => {
      state.error = null;
    },
    handleSessionExpired: (state) => {
      localStorage.removeItem(TOKEN_KEY);
      saveCachedUser(null);
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isProfileOpen = false;
      state.viewedProfileUser = null;
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
          if (
            state.viewedProfileUser &&
            Number(state.viewedProfileUser.id) === Number(u.id) &&
            !u._notFound
          ) {
            state.viewedProfileUser = { ...state.viewedProfileUser, ...u };
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
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.isProfileOpen = false;
        state.viewedProfileUser = null;
      })
      .addCase(requestPasswordReset.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.resetSuccessKey = null;
      })
      .addCase(requestPasswordReset.fulfilled, (state) => {
        state.loading = false;
        state.resetSuccessKey = 'resetLinkSentToast';
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
        state.resetSuccessKey = 'passwordChangedToast';
        state.authModalMode = 'login';
        state.resetTokenFromUrl = '';
      })
      .addCase(confirmPasswordReset.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        const updated = action.payload;
        if (!updated?.id) return;
        state.usersMap[String(updated.id)] = updated;
        if (state.user && Number(state.user.id) === Number(updated.id)) {
          state.user = updated;
        }
        if (
          state.viewedProfileUser &&
          Number(state.viewedProfileUser.id) === Number(updated.id)
        ) {
          state.viewedProfileUser = updated;
        }
        state.allUsers = state.allUsers.map((u) =>
          Number(u.id) === Number(updated.id) ? updated : u
        );
      })
      .addCase(uploadUserAvatar.fulfilled, (state, action) => {
        state.user = action.payload;
        if (action.payload?.id) {
          state.usersMap[String(action.payload.id)] = action.payload;
        }
        if (
          state.viewedProfileUser &&
          Number(state.viewedProfileUser.id) === Number(action.payload?.id)
        ) {
          state.viewedProfileUser = action.payload;
        }
      })
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        state.allUsers = action.payload;
        action.payload.forEach((u) => {
          if (u?.id) {
            state.usersMap[String(u.id)] = u;
          }
        });
      })
      .addCase(adminDeleteUser.fulfilled, (state, action) => {
        const deletedId = Number(action.payload);
        state.allUsers = state.allUsers.filter((u) => Number(u.id) !== deletedId);
        delete state.usersMap[String(deletedId)];
        if (
          state.viewedProfileUser &&
          Number(state.viewedProfileUser.id) === deletedId
        ) {
          state.isProfileOpen = false;
          state.viewedProfileUser = null;
        }
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
  handleSessionExpired,
} = authSlice.actions;

export default authSlice.reducer;
