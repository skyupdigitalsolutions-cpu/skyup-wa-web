import React from 'react';
import {Lock, AlertTriangle} from 'lucide-react';
import {getSessionCountdown} from '../utils';

export default function SessionBanner({sessionState, sessionExpiresAt, onSendTemplate}) {
  if (sessionState === 'active') return null;
  const isExpired = sessionState === 'expired';
  return (
    <div className={`session-banner ${isExpired ? 'expired' : 'warning'}`}>
      {isExpired ? <Lock size={20} color="#664D03" /> : <AlertTriangle size={20} color="#664D03" />}
      <div className="session-banner-text">
        <p className="session-banner-title">{isExpired ? 'Session Expired' : 'Session Expiring Soon'}</p>
        <p className="session-banner-sub">
          {isExpired
            ? '24h window closed. Send a template to restart.'
            : `${getSessionCountdown(sessionExpiresAt)} — Use a template to extend.`}
        </p>
      </div>
      <button className="session-banner-btn" onClick={onSendTemplate}>
        {isExpired ? 'Send Template' : 'Template'}
      </button>
    </div>
  );
}
