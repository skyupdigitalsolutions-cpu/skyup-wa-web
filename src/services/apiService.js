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
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
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
