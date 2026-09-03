import {configureStore} from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import conversationsReducer from './slices/conversationsSlice';
import messagesReducer from './slices/messagesSlice';
import {injectStore} from '../services/apiService';
import {socketService} from '../services/socketService';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    conversations: conversationsReducer,
    messages: messagesReducer,
  },
  middleware: getDefault =>
    getDefault({serializableCheck: false}),
});

injectStore(store);
socketService.injectStore(store);

// Auto connect/disconnect socket on auth change
let prevToken = null;
store.subscribe(() => {
  const token = store.getState().auth.token;
  if (token && token !== prevToken) {
    prevToken = token;
    socketService.connect();
  }
  if (!token && prevToken) {
    prevToken = null;
    socketService.disconnect();
  }
});
