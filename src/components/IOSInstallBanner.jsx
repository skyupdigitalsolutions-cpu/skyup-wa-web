// src/components/IOSInstallBanner.jsx
// ─────────────────────────────────────────────────────────────────────────────
// iOS only supports web push for a site installed to the Home Screen and
// opened from that icon — never from a regular Safari tab, even with
// notification permission granted. Without this banner, a user in plain
// Safari has zero indication why notifications silently never arrive.
// Dismissible, remembered in localStorage so it doesn't nag every visit.
// ─────────────────────────────────────────────────────────────────────────────
import React, {useState, useEffect} from 'react';
import {Share, X} from 'lucide-react';
import {COLORS} from '../constants';

const DISMISS_KEY = 'skyup_wa_ios_banner_dismissed';

function isIOS() {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return true;
  // iPadOS 13+ reports itself as "Macintosh" but has touch support — a real
  // Mac with a trackpad does not.
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

function isStandalone() {
  return (
    window.navigator.standalone === true || // iOS-specific flag for a Home Screen-launched app
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export default function IOSInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const alreadyDismissed = localStorage.getItem(DISMISS_KEY) === 'true';
    if (!alreadyDismissed && isIOS() && !isStandalone()) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {}
  };

  if (!visible) return null;

  return (
    <div style={{
      background: COLORS.primary, color: '#fff', padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
      position: 'relative', zIndex: 20,
    }}>
      <Share size={16} style={{flexShrink: 0}} />
      <span style={{flex: 1}}>
        For WhatsApp notifications on iPhone: tap the Share icon, then{' '}
        <strong>"Add to Home Screen"</strong>, and open the app from that icon instead of Safari.
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{background: 'none', border: 'none', color: '#fff', padding: 4, flexShrink: 0, display: 'flex'}}>
        <X size={16} />
      </button>
    </div>
  );
}
