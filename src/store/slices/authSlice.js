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
import {authAPI, superAdminAPI} from '../../services/apiService';
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

// FIX (feature gap): super admin login, added as its own two-step flow —
// this endpoint only ever sends an OTP; it never returns a token itself, so
// this thunk deliberately does NOT touch state.token/state.user. It just
// records which email is now awaiting an OTP, which the login screen uses
// to switch to the OTP-entry step.
export const superAdminLoginThunk = createAsyncThunk(
  'auth/superAdminLogin',
  async ({email, password}, {rejectWithValue}) => {
    try {
      const res = await superAdminAPI.login(email, password);
      return {email: res.data.email || email};
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Login failed';
      return rejectWithValue(msg);
    }
  },
);

// Step 2 of super admin login — this is the call that actually returns a
// usable token, same shape as the regular loginThunk above.
export const verifySuperAdminOtpThunk = createAsyncThunk(
  'auth/verifySuperAdminOtp',
  async ({email, otp}, {rejectWithValue}) => {
    try {
      const res = await superAdminAPI.verifyOtp(email, otp);
      const data = res.data;
      const user = {
        userId: data._id,
        name: data.name,
        email: data.email,
        role: data.role || 'super_admin',
        companyId: data.companyId || data.company?._id,
        companyName: data.companyName,
      };
      saveToStorage(data.token, user);
      return {token: data.token, user};
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Invalid OTP';
      return rejectWithValue(msg);
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: null,
    user: null,
    loading: false,
    error: null,
    // FIX (random auto-logout bug): tracks whether loadTokenFromStorage has
    // actually finished. Before this existed, the app rendered its routes
    // with token:null for one tick BEFORE the real stored token was even
    // read — if anything fired an API call in that gap, it went out with no
    // Authorization header, got a 401, and the interceptor below
    // unconditionally logged the user out and wiped their actually-valid
    // session. See App.jsx for the render-gating half of this fix.
    tokenLoaded: false,
    // FIX (feature gap): super-admin OTP-pending state — set once step 1
    // (email/password) succeeds, cleared on success/logout/cancel.
    otpPendingEmail: null,
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
    // Lets the login screen go back from the OTP step to the credentials
    // step without a full page reload.
    cancelSuperAdminOtp(state) {
      state.otpPendingEmail = null;
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder.addCase(loadTokenFromStorage.fulfilled, (state, action) => {
      if (action.payload) {
        state.token = action.payload.token;
        state.user = action.payload.user;
      }
      state.tokenLoaded = true;
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
    builder.addCase(superAdminLoginThunk.pending, state => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(superAdminLoginThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.otpPendingEmail = action.payload.email;
    });
    builder.addCase(superAdminLoginThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
    builder.addCase(verifySuperAdminOtpThunk.pending, state => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(verifySuperAdminOtpThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.otpPendingEmail = null;
      state.token = action.payload.token;
      state.user = action.payload.user;
    });
    builder.addCase(verifySuperAdminOtpThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
  },
});

export const {logout, clearError, cancelSuperAdminOtp} = authSlice.actions;
export default authSlice.reducer;
