// Ported from SkyUpWAFull's InboxScreen.js.
import React, {useEffect, useState, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useNavigate} from 'react-router-dom';
import {BarChart3, Megaphone, SquarePen, AlertTriangle, Lock, MessageCircle, User, Paperclip} from 'lucide-react';
import {fetchConversations} from '../store/slices/conversationsSlice';
import {logoutThunk} from '../store/slices/authSlice';
import {socketService} from '../services/socketService';
import {COLORS, ROLES} from '../constants';
import {resolveContactName, formatConversationTime, getSessionState, avatarColor} from '../utils';

const FILTERS = [
  {key: 'all', label: 'All'},
  {key: 'unread', label: 'Unread'},
  {key: 'waiting', label: 'Waiting'},
  {key: 'open', label: 'Open'},
  {key: 'closed', label: 'Closed'},
];

export default function InboxPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {items, loading} = useSelector(s => s.conversations);
  const {user} = useSelector(s => s.auth);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const isAdmin = user?.role === ROLES.ADMIN || user?.role === ROLES.SUPER_ADMIN;
  const [connStatus, setConnStatus] = useState('connected');

  useEffect(() => {
    dispatch(fetchConversations());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resilience layer ─────────────────────────────────────────────────────
  // Real-time updates come from the socket (see socketService.js), but
  // browsers can silently drop a WebSocket (laptop sleep, tab backgrounded
  // for a long time, Render's free tier spinning the backend down after
  // idle) without the app immediately knowing. Three fallbacks so inbound
  // messages never require a manual page reload to show up:
  //   1. A visible banner whenever the socket isn't connected, so this is
  //      diagnosable instead of silently stale.
  //   2. Re-fetch conversations whenever the tab regains focus.
  //   3. A 30s background poll as a last-resort safety net.
  useEffect(() => {
    const unsubscribe = socketService.subscribe(setConnStatus);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') dispatch(fetchConversations());
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [dispatch]);

  useEffect(() => {
    const interval = setInterval(() => dispatch(fetchConversations()), 30000);
    return () => clearInterval(interval);
  }, [dispatch]);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === 'unread') list = list.filter(c => c.unreadCount > 0);
    else if (filter !== 'all') list = list.filter(c => c.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        resolveContactName(c).toLowerCase().includes(q) ||
        (c.waPhone || '').includes(q),
      );
    }
    return list;
  }, [items, filter, search]);

  const totalUnread = useMemo(
    () => items.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [items],
  );

  const handleLogout = () => {
    if (window.confirm('Logout?')) dispatch(logoutThunk());
  };

  const openChat = conv => {
    navigate(`/chat/${conv._id}`, {
      state: {
        contactName: resolveContactName(conv),
        leadId: conv.lead?._id,
        leadStatus: conv.lead?.status,
      },
    });
  };

  return (
    <div className="screen">
      <div className="header" style={{alignItems: 'flex-end', flexWrap: 'wrap', gap: 8}}>
        <div style={{flex: 1}}>
          <div className="header-title">WhatsApp Inbox</div>
          {totalUnread > 0 && <div style={{fontSize: 12, color: 'rgba(255,255,255,0.7)'}}>{totalUnread} unread</div>}
        </div>
        <div className="header-actions">
          {isAdmin && <button className="icon-btn" onClick={() => navigate('/nurture-report')} title="Nurture Report"><BarChart3 size={18} /></button>}
          {isAdmin && <button className="icon-btn" onClick={() => navigate('/blast')} title="Blast"><Megaphone size={18} /></button>}
          {isAdmin && <button className="icon-btn" onClick={() => navigate('/new-conversation')} title="New Conversation"><SquarePen size={18} /></button>}
          <button className="icon-btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div style={{background: COLORS.header, padding: '0 12px 10px'}}>
        <input
          className="select-input"
          style={{borderRadius: 22, border: 'none'}}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search conversations..."
        />
      </div>

      {connStatus !== 'connected' && (
        <div style={{
          background: '#FFF3CD', color: '#664D03', fontSize: 12, fontWeight: 600,
          textAlign: 'center', padding: '6px 8px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 6,
        }}>
          <AlertTriangle size={13} /> Live updates disconnected — reconnecting… (new messages may be delayed up to 30s)
        </div>
      )}

      <div className="chip-row" style={{background: '#fff', margin: 0, padding: '8px 12px', borderBottom: `1px solid ${COLORS.border}`}}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="conv-list">
        {loading && filtered.length === 0 && <div className="center" style={{padding: 40}}><div className="spinner" /></div>}
        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon" style={{display: 'flex', justifyContent: 'center'}}><MessageCircle size={40} color={COLORS.textMuted} /></div>
            <div style={{fontWeight: 600, marginBottom: 6}}>No conversations</div>
            <div style={{fontSize: 13}}>
              {filter !== 'all' ? 'Try a different filter' : 'Conversations appear here when customers message you'}
            </div>
          </div>
        )}
        {filtered.map(item => {
          const name = resolveContactName(item);
          const time = formatConversationTime(item.lastMessageAt);
          const sessionState = getSessionState(item.sessionExpiresAt);
          const isWaiting = item.status === 'waiting';
          const isClosed = item.status === 'closed';
          return (
            <div className="conv-row" key={item._id} onClick={() => openChat(item)}>
              <div className="avatar" style={{background: avatarColor(name)}}>{(name[0] || '?').toUpperCase()}</div>
              <div className="conv-main">
                <div className="conv-top">
                  <div className="conv-name">{name}</div>
                  <div className="conv-time" style={isWaiting ? {color: COLORS.primary, fontWeight: 600} : undefined}>{time}</div>
                </div>
                <div className="conv-bottom">
                  <div className="conv-preview" style={{display: 'flex', alignItems: 'center', gap: 4, ...(item.unreadCount > 0 ? {color: COLORS.text, fontWeight: 600} : {})}}>
                    {['Image', 'Video', 'Document', 'Audio', 'Template', 'Location', 'Sticker', 'Reaction'].includes(item.lastMessage) && (
                      <Paperclip size={12} style={{flexShrink: 0}} />
                    )}
                    <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                      {item.lastMessage || 'No messages yet'}
                    </span>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: 5}}>
                    {sessionState === 'expiring' && <AlertTriangle size={13} color={COLORS.statusWaiting} />}
                    {sessionState === 'expired' && <Lock size={13} color={COLORS.textMuted} />}
                    <span style={{
                      width: 8, height: 8, borderRadius: 4,
                      background: isClosed ? COLORS.statusClosed : isWaiting ? COLORS.statusWaiting : COLORS.statusOpen,
                    }} />
                    {item.unreadCount > 0 && (
                      <span className="unread-badge">{item.unreadCount > 99 ? '99+' : item.unreadCount}</span>
                    )}
                  </div>
                </div>
                {isAdmin && item.assignedAgent && (
                  <div style={{display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: COLORS.textMuted, marginTop: 2}}>
                    <User size={11} /> {item.assignedAgent.name}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <button className="fab" onClick={() => navigate('/new-conversation')} title="New conversation" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <SquarePen size={22} />
        </button>
      )}
    </div>
  );
}
