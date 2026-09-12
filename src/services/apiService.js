// src/services/apiService.js
// Ported directly from SkyUpWAFull (React Native) — this file had zero
// React Native-specific code to begin with, so it's unchanged besides the
// import path for API_BASE_URL.

import axios from 'axios';
import {API_BASE_URL} from '../constants';

let _store = null;

export function injectStore(store) {
  _store = store;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {'Content-Type': 'application/json'},
});

// Inject token on every request
api.interceptors.request.use(config => {
  const token = _store?.getState()?.auth?.token;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 - logout
// FIX (random auto-logout bug): only treat this as "your session is
// genuinely invalid" if the FAILING request actually had a token attached.
// A 401 on a request that went out with NO Authorization header just means
// "you weren't logged in for this call" — which, before the App.jsx
// render-gating fix, could happen to a request that fired before the stored
// token had even loaded yet. Logging out (and wiping localStorage) in that
// case destroyed an otherwise-valid session over a false alarm. Only a 401
// on a request that DID carry a token means the token itself was rejected
// as invalid/expired, which is the only case that should actually log
// someone out.
api.interceptors.response.use(
  response => response,
  error => {
    const hadToken = !!error.config?.headers?.Authorization;
    if (error.response?.status === 401 && hadToken) {
      _store?.dispatch({type: 'auth/logout'});
    }
    return Promise.reject(error);
  },
);

export default api;

// ── Auth API ──────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post('/auth/login', {email, password}),
  logout: () => api.post('/auth/logout'),
  updateDevice: payload => api.patch('/auth/update-device', payload),
  updateAdminDevice: payload => api.patch('/admin/update-device', payload),
};

// FIX (feature gap): super admin login is a completely separate, two-step
// flow from regular login — email/password sends an OTP to the super
// admin's email; a second call with that OTP returns the actual token.
// There was previously no way to reach this from the web app at all.
export const superAdminAPI = {
  login: (email, password) => api.post('/superadmin/login', {email, password}),
  verifyOtp: (email, otp) => api.post('/superadmin/verify-otp', {email, otp}),
  resendOtp: email => api.post('/superadmin/resend-otp', {email}),
};

// ── WhatsApp API ──────────────────────────────────────────────────────────────
export const whatsappAPI = {
  getConversations: () => api.get('/whatsapp/conversations'),

  getMessages: (conversationId, limit = 150) =>
    api.get(`/whatsapp/conversations/${conversationId}/messages?limit=${limit}`),

  markRead: conversationId =>
    api.post(`/whatsapp/conversations/${conversationId}/mark-read`),

  sendMessage: (conversationId, text) =>
    api.post('/whatsapp/send', {conversationId, text}),

  sendTemplate: payload => api.post('/whatsapp/send-template', payload),

  sendMedia: formData =>
    api.post('/whatsapp/send-media', formData, {
      headers: {'Content-Type': 'multipart/form-data'},
      timeout: 60000,
    }),

  startConversation: payload =>
    api.post('/whatsapp/start-conversation', payload),

  assignConversation: (conversationId, agentId) =>
    api.patch(`/whatsapp/conversations/${conversationId}/assign`, {agentId}),

  closeConversation: conversationId =>
    api.patch(`/whatsapp/conversations/${conversationId}/close`),

  getUnreadCounts: () => api.get('/whatsapp/unread-counts'),

  getLeads: () => api.get('/whatsapp/leads'),

  refreshMedia: messageId =>
    api.post(`/whatsapp/messages/${messageId}/refresh-media`),

  getTemplateBody: name =>
    api.get(`/whatsapp/template-body?name=${encodeURIComponent(name)}`),

  getTemplates: () => api.get('/whatsapp/templates'),

  syncTemplates: () => api.post('/whatsapp/templates/sync'),

  bulkSend: payload => api.post('/whatsapp/bulk-send', payload),

  getLeadSources: () => api.get('/whatsapp/leads/sources'),
};

// ── Nurture report (admin) ────────────────────────────────────────────────────
export const nurtureAPI = {
  getReport: (params = {}) => api.get('/nurture/report', {params}),
};
