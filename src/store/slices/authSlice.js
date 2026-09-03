// src/store/slices/authSlice.js
// Ported from SkyUpWAFull (React Native)'s authSlice.js. The ONLY change is
// the storage layer: react-native-keychain (iOS Keychain / Android Keystore)
// has no browser equivalent, so this uses localStorage instead.
//
// Security note: localStorage is NOT as secure as a hardware-backed
// keystore — it's readable by any JS running on the page (e.g. an XSS bug),
// with no OS-level encryption. It's the standard, expected approach for web
// apps, but if this is holding an admin token that can send WhatsApp blasts,
// keep the CSP and dependency hygiene here stricter than usual.
import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {STORAGE_KEY_TOKEN} from '../../constants';
import {authAPI} from '../../services/apiService';
import {socketService} from '../../services/socketService';

function saveToStorage(token, user) {
  try {
    localStorage.setItem(STORAGE_KEY_TOKEN, JSON.stringify({token, user}));
  } catch (e) {
    console.warn('[auth] localStorage save failed:', e.message);
  }
}

function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
  } catch (e) {}
}

// Load saved session on app start
export const loadTokenFromStorage = createAsyncThunk(
  'auth/loadToken',
  async () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TOKEN);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  },
);

// Login
export const loginThunk = createAsyncThunk(
  'auth/login',
  async ({email, password}, {rejectWithValue}) => {
    try {
      const res = await authAPI.login(email, password);
      const data = res.data;
      const user = {
        userId: data._id,
        name: data.name,
        email: data.email,
        role: data.role,
        companyId: data.company || data.companyId,
        plan: data.plan,
      };
      saveToStorage(data.token, user);
      return {token: data.token, user};
    } catch (err) {
      const msg =
        err?.response?.data?.message || err.message || 'Login failed';
      return rejectWithValue(msg);
    }
  },
);

// Logout
export const logoutThunk = createAsyncThunk('auth/logoutThunk', async () => {
  try {
    await authAPI.logout();
  } catch (e) {}
  clearStorage();
  socketService.disconnect();
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: null,
    user: null,
    loading: false,
    error: null,
  },
  reducers: {
    logout(state) {
      state.token = null;
      state.user = null;
      state.error = null;
      clearStorage();
      socketService.disconnect();
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder.addCase(loadTokenFromStorage.fulfilled, (state, action) => {
      if (action.payload) {
        state.token = action.payload.token;
        state.user = action.payload.user;
      }
    });
    builder.addCase(loginThunk.pending, state => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(loginThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.token = action.payload.token;
      state.user = action.payload.user;
    });
    builder.addCase(loginThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
    builder.addCase(logoutThunk.fulfilled, state => {
      state.token = null;
      state.user = null;
    });
  },
});

export const {logout, clearError} = authSlice.actions;
export default authSlice.reducer;
