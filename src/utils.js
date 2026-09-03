import {formatDistanceToNow, format, isToday, isYesterday} from 'date-fns';
import {SESSION_WARNING_MINUTES} from './constants';

export function formatMessageTime(isoDate) {
  return format(new Date(isoDate), 'HH:mm');
}

export function formatConversationTime(isoDate) {
  const d = new Date(isoDate);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd/MM/yy');
}

export function getSessionState(sessionExpiresAt) {
  if (!sessionExpiresAt) return 'expired';
  const now = Date.now();
  const expiry = new Date(sessionExpiresAt).getTime();
  if (expiry <= now) return 'expired';
  const minsLeft = (expiry - now) / 60000;
  if (minsLeft <= SESSION_WARNING_MINUTES) return 'expiring';
  return 'active';
}

export function getSessionCountdown(sessionExpiresAt) {
  if (!sessionExpiresAt) return '';
  const ms = new Date(sessionExpiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

export function formatDisplayPhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    const local = digits.slice(2);
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return `+${digits}`;
}

export function normalizePhoneToE164(input) {
  const digits = String(input).replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

export function resolveContactName(conv) {
  return (
    conv?.lead?.name ||
    conv?.contactName ||
    formatDisplayPhone(conv?.waPhone || '')
  );
}

export function generateTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function avatarColor(name) {
  const colors = [
    '#25D366','#128C7E','#075E54','#34B7F1',
    '#9C27B0','#F44336','#FF9800','#2196F3',
  ];
  const idx = ((name || '').charCodeAt(0) || 0) % colors.length;
  return colors[idx];
}
