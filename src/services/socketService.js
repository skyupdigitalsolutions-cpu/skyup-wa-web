import {io} from 'socket.io-client';
import {SOCKET_URL, SOCKET_EVENTS, ROLES} from '../constants';

let _store = null;
let socket = null;
let _listeners = new Set(); // UI subscribers watching connection state (see subscribe())

function notifyListeners(status) {
  _listeners.forEach(fn => fn(status));
}

// FIX (Bug 5): determine whether the user is currently viewing a specific
// conversation so the slice can skip the unread-count increment for messages
// that arrive while the chat is already open.
function isViewingConversation(conversationId) {
  if (typeof document === 'undefined') return false;
  if (document.visibilityState !== 'visible') return false;
  return window.location.pathname === `/chat/${conversationId}`;
}

export const socketService = {
  injectStore(store) {
    _store = store;
  },

  // Lets UI components show a "reconnecting" banner instead of silently
  // failing to sync — call with a callback(status) where status is
  // 'connected' | 'disconnected' | 'error'.
  subscribe(callback) {
    _listeners.add(callback);
    callback(this.isConnected() ? 'connected' : 'disconnected');
    return () => _listeners.delete(callback);
  },

  connect() {
    if (socket?.connected) return;
    const token = _store?.getState()?.auth?.token;
    if (!token) return;

    // Reuse an existing (disconnected) socket instance if present, instead
    // of leaking a new one on every call — connect() can be called from
    // multiple triggers (token change, tab refocus, manual retry).
    if (socket) {
      socket.connect();
      return;
    }

    socket = io(SOCKET_URL, {
      // Polling FIRST, then upgrade to WebSocket only if that succeeds.
      // Behind a reverse proxy (nginx/Apache/Caddy) that hasn't been
      // configured to forward WebSocket upgrade headers, a direct
      // websocket-first attempt fails outright with no fallback — polling
      // works over plain HTTP through virtually any proxy with zero special
      // config, so this keeps the app usable even if WS upgrade is broken
      // server-side, while that gets fixed separately.
      transports: ['polling', 'websocket'],
      auth: {token},
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 50,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      this._joinRooms();
      notifyListeners('connected');
    });

    socket.on('disconnect', reason => {
      console.warn('[Socket] Disconnected:', reason);
      notifyListeners('disconnected');
    });

    socket.on('connect_error', err => {
      console.error('[Socket] Error:', err.message);
      notifyListeners('error');
    });

    socket.on(SOCKET_EVENTS.WA_MESSAGE, payload => {
      // FIX (Bug 5): if the user is actively viewing this conversation,
      // pass skipUnread so the slice doesn't bump the unread counter.
      // The message content still updates (lastMessage, lastMessageAt, status).
      const skipUnread = isViewingConversation(payload.conversationId);
      _store?.dispatch({
        type: 'conversations/socketNewMessage',
        payload: {...payload, skipUnread},
      });
      _store?.dispatch({type: 'messages/socketNewMessage', payload});
    });

    socket.on(SOCKET_EVENTS.WA_MESSAGE_STATUS, payload => {
      _store?.dispatch({type: 'messages/socketStatusUpdate', payload});
    });

    socket.on(SOCKET_EVENTS.WA_MEDIA_READY, payload => {
      _store?.dispatch({type: 'messages/socketMediaReady', payload});
    });

    // FIX (stale employee name after deletion): see the matching backend
    // change (deleteCompanyUser now clears dangling assignedAgent refs and
    // emits this) and the conversationReassigned reducer in
    // conversationsSlice.js.
    socket.on(SOCKET_EVENTS.WA_CONVERSATION_REASSIGNED, payload => {
      _store?.dispatch({type: 'conversations/conversationReassigned', payload});
    });
  },

  _joinRooms() {
    const user = _store?.getState()?.auth?.user;
    if (!user || !socket) return;
    const {companyId, userId, role} = user;

    if (role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN) {
      socket.emit(SOCKET_EVENTS.WA_ADMIN_JOIN);
    }
    if (companyId) {
      socket.emit(SOCKET_EVENTS.WA_COMPANY_JOIN, {companyId});
    }
    if (userId) {
      socket.emit(SOCKET_EVENTS.WA_AGENT_JOIN, {agentId: userId});
    }
  },

  disconnect() {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
      notifyListeners('disconnected');
    }
  },

  isConnected() {
    return socket?.connected ?? false;
  },
};

// ── Browser-specific resilience ────────────────────────────────────────────────
// Two failure modes native apps don't really have to worry about, but
// browser tabs do constantly:
//   1. Laptop sleeps / tab is backgrounded for a long time -> the OS/browser
//      can silently drop the WebSocket without ever firing a clean
//      'disconnect' event the socket.io client reacts to promptly.
//   2. Render's free tier spins the backend down after ~15 min idle -> the
//      socket connection dies with it, and won't necessarily know to retry
//      the moment the backend wakes back up.
// Reconnecting whenever the tab becomes visible again is a cheap, reliable
// fix for both: worst case it's a harmless no-op reconnect attempt.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !socketService.isConnected()) {
      console.log('[Socket] Tab refocused while disconnected — reconnecting...');
      socketService.connect();
    }
  });
  window.addEventListener('online', () => {
    if (!socketService.isConnected()) {
      console.log('[Socket] Network back online — reconnecting...');
      socketService.connect();
    }
  });
}
