// src/constants/index.js
// Mirrors SkyUpWAFull's (React Native) constants/index.js — same backend,
// same roles, same conversation/message status enums. Kept as a separate
// file (not shared via a monorepo package) per the decision to keep this a
// standalone web project rather than a single react-native-web codebase.

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://skyup-crm-backend.onrender.com';
export const API_BASE_URL = `${BACKEND_URL}/api`;
export const SOCKET_URL = BACKEND_URL;
export const MESSAGES_MAX = 300;
export const MESSAGES_LIMIT = 150;
export const SESSION_WARNING_MINUTES = 120;

export const STORAGE_KEY_TOKEN = 'skyup_wa_auth';

export const ROLES = {
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  EMPLOYEE: 'employee',
};

export const SOCKET_EVENTS = {
  WA_ADMIN_JOIN: 'wa_admin_join',
  WA_COMPANY_JOIN: 'wa_company_join',
  WA_AGENT_JOIN: 'wa_agent_join',
  WA_MESSAGE: 'wa_message',
  WA_MESSAGE_STATUS: 'wa_message_status',
  WA_MEDIA_READY: 'wa_media_ready',
  // FIX (stale employee name after deletion): backend emits this when a
  // deleted employee's dangling assignedAgent reference gets cleared on
  // their conversations.
  WA_CONVERSATION_REASSIGNED: 'wa_conversation_reassigned',
};

export const CONV_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
};

export const MSG_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
};

// Same WhatsApp-green theme used in the mobile app, expressed as CSS-ready values.
export const COLORS = {
  primary: '#075E54',
  primaryDark: '#054C44',
  primaryLight: '#DCF8C6',
  header: '#075E54',
  accent: '#25D366',
  background: '#ECE5DD',
  text: '#111B21',
  textSecondary: '#667781',
  textMuted: '#8696A0',
  border: '#E9EDEF',
  inputBorder: '#D1D7DB',
  danger: '#D32F2F',
  statusWaiting: '#F0A030',
  statusOpen: '#25D366',
  statusClosed: '#9E9E9E',
  badge: '#25D366',
  bubbleOutbound: '#DCF8C6',
  bubbleInbound: '#FFFFFF',
  tickSent: '#9E9E9E',
  tickDelivered: '#9E9E9E',
  tickRead: '#34B7F1',
  tickFailed: '#FF3B30',
};
