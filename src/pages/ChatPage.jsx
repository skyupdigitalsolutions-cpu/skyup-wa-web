// Ported from SkyUpWAFull's ChatScreen.js. Same Redux actions, same session
// logic — swapped FlatList/KeyboardAvoidingView for a plain scrollable div
// (browsers don't need keyboard-avoidance the way native does).
import React, {useEffect, useRef, useState, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useNavigate, useParams, useLocation} from 'react-router-dom';
import {ArrowLeft} from 'lucide-react';
import {
  fetchMessages, sendTextMessage, sendTemplateMessage,
  sendMediaMessage, addOptimisticMessage,
} from '../store/slices/messagesSlice';
import {
  markConversationRead, closeConversationThunk, updateSession,
} from '../store/slices/conversationsSlice';
import {MESSAGES_MAX, ROLES} from '../constants';
import {resolveContactName, getSessionState, generateTempId} from '../utils';
import MessageBubble from '../components/MessageBubble';
import SessionBanner from '../components/SessionBanner';
import ChatInputBar from '../components/ChatInputBar';

export default function ChatPage() {
  const {conversationId} = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const {contactName, leadId, leadStatus, selectedTemplateName, selectedAt} = location.state || {};
  const dispatch = useDispatch();

  const {user} = useSelector(s => s.auth);
  const conversation = useSelector(s => s.conversations.items.find(c => c._id === conversationId));
  const messagesData = useSelector(s => s.messages.byConversation[conversationId]);
  const isAdmin = user?.role === ROLES.ADMIN || user?.role === ROLES.SUPER_ADMIN;

  const listRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const messages = messagesData?.messages || [];
  const hasMore = messagesData?.hasMore || false;
  const loading = messagesData?.loading || false;

  const sessionState = useMemo(
    () => getSessionState(conversation?.sessionExpiresAt || null),
    [conversation?.sessionExpiresAt],
  );

  useEffect(() => {
    dispatch(fetchMessages({conversationId}));
    dispatch(markConversationRead(conversationId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Same resilience reasoning as InboxPage — re-fetch on tab refocus so a
  // message that arrived while the socket was briefly disconnected doesn't
  // require manually leaving and reopening the chat to appear.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') dispatch(fetchMessages({conversationId}));
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [conversationId, dispatch]);

  // Fires when TemplatePickerPage navigates back here with a chosen template.
  // `selectedAt` (a timestamp) makes this re-fire even if the same template
  // is picked twice in a row, since selectedTemplateName alone wouldn't change.
  useEffect(() => {
    if (!selectedTemplateName) return;
    const tempId = generateTempId();
    dispatch(addOptimisticMessage({
      conversationId,
      message: {
        _id: tempId, direction: 'outbound', body: '', messageType: 'template',
        mediaUrl: null, mediaMimeType: null, mediaCaption: null,
        status: 'pending', waTimestamp: new Date().toISOString(),
        sentBy: null, isTemplate: true, templateName: selectedTemplateName,
        originalBody: null, editedAt: null, _optimistic: true,
      },
    }));
    dispatch(sendTemplateMessage({conversationId, templateName: selectedTemplateName, leadId, tempId}))
      .unwrap()
      .then(result => {
        if (result.sessionExpiresAt) {
          dispatch(updateSession({conversationId, sessionExpiresAt: result.sessionExpiresAt, status: 'open'}));
        }
      })
      .catch(e => alert(e?.error || 'Could not send template'));
    // Clear the state so navigating back/forward doesn't resend it.
    navigate(location.pathname, {replace: true, state: {contactName, leadId, leadStatus}});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateName, selectedAt]);

  useEffect(() => {
    if (messages.length > 0 && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await dispatch(fetchMessages({conversationId, limit: MESSAGES_MAX}));
    setLoadingMore(false);
  };

  const handleSendText = async text => {
    setSending(true);
    const tempId = generateTempId();
    dispatch(addOptimisticMessage({
      conversationId,
      message: {
        _id: tempId, direction: 'outbound', body: text, messageType: 'text',
        mediaUrl: null, mediaMimeType: null, mediaCaption: null,
        status: 'pending', waTimestamp: new Date().toISOString(),
        sentBy: null, isTemplate: false, templateName: null,
        originalBody: null, editedAt: null, _optimistic: true,
      },
    }));
    try {
      await dispatch(sendTextMessage({conversationId, text, tempId})).unwrap();
    } catch (e) {
      alert(e?.error || 'Message could not be sent');
    } finally {
      setSending(false);
    }
  };

  const handleSendMedia = async (formData, type) => {
    setSending(true);
    const tempId = generateTempId();
    dispatch(addOptimisticMessage({
      conversationId,
      message: {
        _id: tempId, direction: 'outbound', body: '', messageType: type,
        mediaUrl: null, mediaMimeType: null, mediaCaption: null,
        status: 'pending', waTimestamp: new Date().toISOString(),
        sentBy: null, isTemplate: false, templateName: null,
        originalBody: null, editedAt: null, _optimistic: true,
      },
    }));
    formData.append('conversationId', conversationId);
    try {
      await dispatch(sendMediaMessage({formData, conversationId, tempId})).unwrap();
    } catch (e) {
      alert(e?.error || 'Media could not be sent');
    } finally {
      setSending(false);
    }
  };

  const handleTemplatePress = () => {
    navigate('/template-picker', {
      state: {
        returnTo: `/chat/${conversationId}`,
        contactName, leadId, leadStatus,
      },
    });
  };

  const handleClose = () => {
    if (!window.confirm('Mark this conversation as closed?')) return;
    dispatch(closeConversationThunk(conversationId));
    navigate('/');
  };

  const displayName = contactName || resolveContactName(conversation || {});

  return (
    <div className="screen">
      <div className="header">
        <button className="header-back" onClick={() => navigate('/')}><ArrowLeft size={24} /></button>
        <div className="avatar" style={{background: 'rgba(255,255,255,0.3)', width: 38, height: 38}}>
          {(displayName[0] || '?').toUpperCase()}
        </div>
        <div style={{flex: 1, minWidth: 0}}>
          <div className="header-title" style={{fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
            {displayName}
          </div>
          {leadStatus && <div style={{fontSize: 12, color: 'rgba(255,255,255,0.75)'}}>{leadStatus}</div>}
        </div>
        {isAdmin && (
          <button className="icon-btn" onClick={handleClose} title="Close conversation">⋮</button>
        )}
      </div>

      <SessionBanner
        sessionState={sessionState}
        sessionExpiresAt={conversation?.sessionExpiresAt || null}
        onSendTemplate={handleTemplatePress}
      />

      {loading && messages.length === 0 ? (
        <div className="center"><div className="spinner" /></div>
      ) : (
        <div className="chat-messages" ref={listRef}>
          {hasMore && (
            <div style={{textAlign: 'center', padding: 12}}>
              <button
                onClick={handleLoadMore}
                style={{background: 'none', border: 'none', color: '#054C44', fontWeight: 600, fontSize: 13}}>
                {loadingMore ? 'Loading…' : 'Load older messages'}
              </button>
            </div>
          )}
          {messages.map(m => <MessageBubble key={m._id} message={m} />)}
        </div>
      )}

      <ChatInputBar
        sessionState={sessionState}
        sending={sending}
        onSendText={handleSendText}
        onSendMedia={handleSendMedia}
        onTemplatePress={handleTemplatePress}
      />
    </div>
  );
}
