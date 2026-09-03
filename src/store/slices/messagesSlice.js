import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {whatsappAPI} from '../../services/apiService';
import {MESSAGES_LIMIT} from '../../constants';

function emptyConv() {
  return {messages: [], hasMore: false, loading: false, error: null};
}

export const fetchMessages = createAsyncThunk(
  'messages/fetch',
  async ({conversationId, limit = MESSAGES_LIMIT}, {rejectWithValue}) => {
    try {
      const res = await whatsappAPI.getMessages(conversationId, limit);
      return {
        conversationId,
        messages: res.data.messages,
        hasMore: res.data.hasMore,
      };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.error || err.message);
    }
  },
);

export const sendTextMessage = createAsyncThunk(
  'messages/sendText',
  async ({conversationId, text, tempId}, {rejectWithValue}) => {
    try {
      const res = await whatsappAPI.sendMessage(conversationId, text);
      return {conversationId, tempId, message: res.data.message};
    } catch (err) {
      return rejectWithValue({
        conversationId,
        tempId,
        error: err?.response?.data?.error || err.message,
      });
    }
  },
);

export const sendTemplateMessage = createAsyncThunk(
  'messages/sendTemplate',
  async ({conversationId, templateName, leadId, tempId}, {rejectWithValue}) => {
    try {
      const res = await whatsappAPI.sendTemplate({
        conversationId,
        templateName,
        leadId,
      });
      return {
        conversationId,
        tempId,
        message: res.data.message,
        sessionExpiresAt: res.data.sessionExpiresAt,
      };
    } catch (err) {
      return rejectWithValue({
        conversationId,
        tempId,
        error: err?.response?.data?.error || err.message,
      });
    }
  },
);

export const sendMediaMessage = createAsyncThunk(
  'messages/sendMedia',
  async ({formData, conversationId, tempId}, {rejectWithValue}) => {
    try {
      const res = await whatsappAPI.sendMedia(formData);
      return {conversationId, tempId, message: res.data.message};
    } catch (err) {
      return rejectWithValue({
        conversationId,
        tempId,
        error: err?.response?.data?.error || err.message,
      });
    }
  },
);

const messagesSlice = createSlice({
  name: 'messages',
  initialState: {byConversation: {}},
  reducers: {
    addOptimisticMessage(state, action) {
      const {conversationId, message} = action.payload;
      if (!state.byConversation[conversationId]) {
        state.byConversation[conversationId] = emptyConv();
      }
      state.byConversation[conversationId].messages.push(message);
    },
    socketStatusUpdate(state, action) {
      const {conversationId, messageId, status} = action.payload;
      const conv = state.byConversation[conversationId];
      if (!conv) return;
      const msg = conv.messages.find(m => m._id === messageId);
      if (msg) msg.status = status;
    },
    socketMediaReady(state, action) {
      const {conversationId, messageId, mediaUrl} = action.payload;
      const conv = state.byConversation[conversationId];
      if (!conv) return;
      const msg = conv.messages.find(m => m._id === messageId);
      if (msg) msg.mediaUrl = mediaUrl;
    },
    socketNewMessage(state, action) {
      const {conversationId, message} = action.payload;
      if (!state.byConversation[conversationId]) return;
      const existing = state.byConversation[conversationId].messages;
      const already = existing.find(m => m._id === message._id);
      if (!already) {
        existing.push({
          _id: message._id,
          direction: 'inbound',
          body: message.body,
          messageType: message.messageType,
          mediaUrl: message.mediaUrl || null,
          mediaMimeType: null,
          mediaCaption: null,
          status: 'delivered',
          waTimestamp: message.waTimestamp,
          sentBy: null,
          isTemplate: false,
          templateName: null,
          originalBody: null,
          editedAt: null,
        });
      }
    },
    clearConversation(state, action) {
      delete state.byConversation[action.payload];
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchMessages.pending, (state, action) => {
      const cid = action.meta.arg.conversationId;
      if (!state.byConversation[cid]) state.byConversation[cid] = emptyConv();
      state.byConversation[cid].loading = true;
    });
    builder.addCase(fetchMessages.fulfilled, (state, action) => {
      const {conversationId, messages, hasMore} = action.payload;
      state.byConversation[conversationId] = {
        messages,
        hasMore,
        loading: false,
        error: null,
      };
    });
    builder.addCase(fetchMessages.rejected, (state, action) => {
      const cid = action.meta.arg.conversationId;
      if (!state.byConversation[cid]) state.byConversation[cid] = emptyConv();
      state.byConversation[cid].loading = false;
      state.byConversation[cid].error = action.payload;
    });

    // sendText
    builder.addCase(sendTextMessage.fulfilled, (state, action) => {
      const {conversationId, tempId, message} = action.payload;
      const conv = state.byConversation[conversationId];
      if (!conv) return;
      const idx = conv.messages.findIndex(m => m._id === tempId);
      if (idx !== -1) conv.messages[idx] = message;
      else conv.messages.push(message);
    });
    builder.addCase(sendTextMessage.rejected, (state, action) => {
      const {conversationId, tempId} = action.payload || {};
      if (!conversationId) return;
      const conv = state.byConversation[conversationId];
      const msg = conv?.messages.find(m => m._id === tempId);
      if (msg) msg.status = 'failed';
    });

    // sendTemplate
    builder.addCase(sendTemplateMessage.fulfilled, (state, action) => {
      const {conversationId, tempId, message} = action.payload;
      const conv = state.byConversation[conversationId];
      if (!conv) return;
      const idx = conv.messages.findIndex(m => m._id === tempId);
      if (idx !== -1) conv.messages[idx] = message;
      else conv.messages.push(message);
    });
    builder.addCase(sendTemplateMessage.rejected, (state, action) => {
      const {conversationId, tempId} = action.payload || {};
      if (!conversationId) return;
      const conv = state.byConversation[conversationId];
      const msg = conv?.messages.find(m => m._id === tempId);
      if (msg) msg.status = 'failed';
    });

    // sendMedia
    builder.addCase(sendMediaMessage.fulfilled, (state, action) => {
      const {conversationId, tempId, message} = action.payload;
      const conv = state.byConversation[conversationId];
      if (!conv) return;
      const idx = conv.messages.findIndex(m => m._id === tempId);
      if (idx !== -1) conv.messages[idx] = message;
      else conv.messages.push(message);
    });
    builder.addCase(sendMediaMessage.rejected, (state, action) => {
      const {conversationId, tempId} = action.payload || {};
      if (!conversationId) return;
      const conv = state.byConversation[conversationId];
      const msg = conv?.messages.find(m => m._id === tempId);
      if (msg) msg.status = 'failed';
    });
  },
});

export const {
  addOptimisticMessage,
  socketStatusUpdate,
  socketMediaReady,
  socketNewMessage,
  clearConversation,
} = messagesSlice.actions;
export default messagesSlice.reducer;
