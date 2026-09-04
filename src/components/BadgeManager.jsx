// src/components/BadgeManager.jsx
// Mounted once at the App level (not per-page) so the icon badge reflects
// total unread count regardless of which screen is currently open — reading
// conversations.items directly from Redux rather than depending on
// InboxPage's own local computation, since that state persists globally
// once fetched even while viewing a Chat or other page.
import {useEffect, useMemo} from 'react';
import {useSelector} from 'react-redux';
import {updateBadge, clearBadge} from '../services/badgeService';

export default function BadgeManager() {
  const items = useSelector(s => s.conversations.items);
  const token = useSelector(s => s.auth.token);

  const totalUnread = useMemo(
    () => items.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [items],
  );

  useEffect(() => {
    if (!token) {
      clearBadge();
      return;
    }
    updateBadge(totalUnread);
  }, [totalUnread, token]);

  return null;
}
