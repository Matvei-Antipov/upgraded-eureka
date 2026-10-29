import { configureStore } from '@reduxjs/toolkit';
import postsReducer from './postsSlice';
import authReducer, { handleSessionExpired } from './authSlice';
import { setUnauthorizedHandler } from '../api/client';

export const store = configureStore({
  reducer: {
    posts: postsReducer,
    auth: authReducer,
  },
});

setUnauthorizedHandler(() => {
  store.dispatch(handleSessionExpired());
});
