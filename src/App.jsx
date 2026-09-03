import React, {useEffect} from 'react';
import {BrowserRouter, Routes, Route, Navigate, useNavigate} from 'react-router-dom';
import {useDispatch, useSelector} from 'react-redux';
import {loadTokenFromStorage} from './store/slices/authSlice';
import {setupNotifications, setNavigate} from './services/notificationService';

import LoginPage from './pages/LoginPage';
import InboxPage from './pages/InboxPage';
import ChatPage from './pages/ChatPage';
import NewConversationPage from './pages/NewConversationPage';
import TemplatePickerPage from './pages/TemplatePickerPage';
import BlastPage from './pages/BlastPage';
import NurtureReportPage from './pages/NurtureReportPage';

function PrivateRoute({children}) {
  const token = useSelector(s => s.auth.token);
  return token ? children : <Navigate to="/login" replace />;
}

function LoginRoute() {
  const token = useSelector(s => s.auth.token);
  return token ? <Navigate to="/" replace /> : <LoginPage />;
}

// Sets up push notifications once logged in (fresh login or a restored
// localStorage session), same pattern as the RN app's NotificationsGate.
function NotificationsGate() {
  const user = useSelector(s => s.auth.user);
  const navigate = useNavigate();
  const userId = user?.userId || null;
  const role = user?.role || null;

  useEffect(() => {
    setNavigate(navigate);
  }, [navigate]);

  useEffect(() => {
    if (!userId || !role) return undefined;
    let cleanup;
    setupNotifications(role).then(fn => { cleanup = fn; });
    return () => cleanup?.();
  }, [userId, role]);

  return null;
}

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(loadTokenFromStorage());
  }, [dispatch]);

  return (
    <BrowserRouter>
      <NotificationsGate />
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/" element={<PrivateRoute><InboxPage /></PrivateRoute>} />
        <Route path="/chat/:conversationId" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
        <Route path="/new-conversation" element={<PrivateRoute><NewConversationPage /></PrivateRoute>} />
        <Route path="/template-picker" element={<PrivateRoute><TemplatePickerPage /></PrivateRoute>} />
        <Route path="/blast" element={<PrivateRoute><BlastPage /></PrivateRoute>} />
        <Route path="/nurture-report" element={<PrivateRoute><NurtureReportPage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
