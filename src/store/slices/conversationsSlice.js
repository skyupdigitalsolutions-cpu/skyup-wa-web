import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {whatsappAPI} from '../../services/apiService';

function sortByTime(items) {
  return [...items].sort(
    (a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}

// Was `📎 ${type}` — plain capitalized text instead, since this string lives
// in Redux state (not JSX) so it can't hold an actual icon component. The
// Paperclip icon shown next to it in InboxPage.jsx (for non-text messages)
// covers the "icon instead of emoji" ask visually.
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Message';
}

export const fetchConversations = createAsyncThunk(
  'conversations/fetchAll',
  async (_, {rejectWithValue}) => {
    try {
      const res = await whatsappAPI.getConversations();
      return res.data.conversations;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.error || err.message || 'Failed',
      );
    }
  },
);

export const markConversationRead = createAsyncThunk(
  'conversations/markRead',
  async (conversationId, {rejectWithValue}) => {
    try {
      await whatsappAPI.markRead(conversationId);
      return conversationId;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const assignConversation = createAsyncThunk(
  'conversations/assign',
  async ({conversationId, agentId, agentName}, {rejectWithValue}) => {
    try {
      await whatsappAPI.assignConversation(conversationId, agentId);
      return {conversationId, agentId, agentName};
    } catch (err) {
      return rejectWithValue(err?.response?.data?.error || err.message);
    }
  },
);

export const closeConversationThunk = createAsyncThunk(
  'conversations/close',
  async (conversationId, {rejectWithValue}) => {
    try {
      await whatsappAPI.closeConversation(conversationId);
      return conversationId;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.error || err.message);
    }
  },
);

const conversationsSlice = createSlice({
  name: 'conversations',
  initialState: {
    items: [],
    loading: false,
    error: null,
  },
  reducers: {
    socketNewMessage(state, action) {
      const {conversationId, message, contactName, leadName, sessionExpiresAt} =
        action.payload;
      const idx = state.items.findIndex(c => c._id === conversationId);
      if (idx !== -1) {
        const conv = state.items[idx];
        conv.lastMessage =
          message.messageType === 'text'
            ? message.body
            : capitalize(message.messageType);
        conv.lastMessageAt = message.waTimestamp || new Date().toISOString();
        conv.unreadCount = (conv.unreadCount || 0) + 1;
        conv.status = 'waiting';
        if (sessionExpiresAt) conv.sessionExpiresAt = sessionExpiresAt;
        state.items = sortByTime(state.items);
      } else {
        const newConv = {
          _id: conversationId,
          waPhone: action.payload.waPhone || '',
          contactName: contactName || leadName || '',
          status: 'waiting',
          lastMessage:
            message.messageType === 'text'
              ? message.body
              : capitalize(message.messageType),
          lastMessageAt: message.waTimestamp || new Date().toISOString(),
          unreadCount: 1,
          sessionExpiresAt: sessionExpiresAt || null,
          lead: action.payload.leadId
            ? {_id: action.payload.leadId, name: leadName}
            : null,
          assignedAgent: null,
        };
        state.items = sortByTime([newConv, ...state.items]);
      }
    },
    clearUnread(state, action) {
      const conv = state.items.find(c => c._id === action.payload);
      if (conv) conv.unreadCount = 0;
    },
    updateSession(state, action) {
      const conv = state.items.find(
        c => c._id === action.payload.conversationId,
      );
      if (conv) {
        conv.sessionExpiresAt = action.payload.sessionExpiresAt;
        conv.status = action.payload.status;
      }
    },
    // FIX (stale employee name after deletion): backend clears the dangling
    // assignedAgent reference and pushes this event when an employee whose
    // name was still showing on open conversations gets deleted — without
    // this, an already-loaded Inbox tab had no signal to update and would
    // keep showing the deleted employee's name until the next full refetch.
    conversationReassigned(state, action) {
      const conv = state.items.find(
        c => c._id === action.payload.conversationId,
      );
      if (conv) conv.assignedAgent = action.payload.assignedAgent;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchConversations.pending, state => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchConversations.fulfilled, (state, action) => {
      state.loading = false;
      state.items = sortByTime(action.payload);
    });
    builder.addCase(fetchConversations.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
    builder.addCase(markConversationRead.fulfilled, (state, action) => {
      const conv = state.items.find(c => c._id === action.payload);
      if (conv) conv.unreadCount = 0;
    });
    builder.addCase(assignConversation.fulfilled, (state, action) => {
      const conv = state.items.find(
        c => c._id === action.payload.conversationId,
      );
      if (conv) {
        conv.assignedAgent = {
          _id: action.payload.agentId,
          name: action.payload.agentName,
        };
      }
    });
    builder.addCase(closeConversationThunk.fulfilled, (state, action) => {
      const conv = state.items.find(c => c._id === action.payload);
      if (conv) conv.status = 'closed';
    });
  },
});

export const {socketNewMessage, clearUnread, updateSession, conversationReassigned} =
  conversationsSlice.actions;
export default conversationsSlice.reducer;
