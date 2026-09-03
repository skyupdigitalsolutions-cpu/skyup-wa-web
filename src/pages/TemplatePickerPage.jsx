// Ported from SkyUpWAFull's TemplatePickerScreen.js. One structural change:
// React Navigation let the caller pass an onTemplateSelected callback
// function through route params — react-router's location.state CAN hold a
// function in memory, but it doesn't survive a page refresh/back-forward
// correctly, so instead this navigates back to the chat with the selected
// template name in state, and ChatPage watches for it and sends it.
import React, {useState, useCallback, useEffect} from 'react';
import {useNavigate, useLocation} from 'react-router-dom';
import {ArrowLeft, ArrowRight} from 'lucide-react';
import {COLORS} from '../constants';
import {whatsappAPI} from '../services/apiService';

const DEFAULT_TEMPLATES = [
  {name: 'crm_followup_leads', category: 'UTILITY', body: 'Hi {{1}}, following up on your inquiry. Let us know if you have any questions.'},
  {name: 'crm_greeting', category: 'UTILITY', body: 'Hello {{1}}, thank you for reaching out! How can we assist you today?'},
  {name: 'crm_callback_request', category: 'UTILITY', body: 'Hi {{1}}, we tried reaching you. Please let us know a convenient time for a callback.'},
  {name: 'crm_offer_details', category: 'MARKETING', body: 'Hi {{1}}, we have an exclusive offer for you. Reply to know more!'},
  {name: 'crm_appointment_reminder', category: 'UTILITY', body: 'Hi {{1}}, reminder for your appointment. Please confirm your attendance.'},
];

export default function TemplatePickerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {returnTo, contactName, leadId, leadStatus} = location.state || {};

  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await whatsappAPI.getTemplates();
        const cached = res.data?.templates || [];
        if (!cancelled && cached.length > 0) {
          setTemplates(cached.map(t => ({
            name: t.name,
            category: t.category || 'UTILITY',
            body: t.bodyPreview || `${t.language || ''} · ${t.status || ''}`.trim() || 'Tap to send',
          })));
        }
      } catch {
        // keep the DEFAULT_TEMPLATES fallback silently
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = template => {
    if (!window.confirm(`Send "${template.name}"?`)) return;
    setSending(true);
    // Hand the selection back to ChatPage via navigation state — it watches
    // for `selectedTemplateName` and performs the actual send + optimistic
    // message the same way the RN app's onTemplateSelected callback did.
    navigate(returnTo || '/', {
      replace: true,
      state: {contactName, leadId, leadStatus, selectedTemplateName: template.name, selectedAt: Date.now()},
    });
  };

  return (
    <div className="screen">
      <div className="header">
        <button className="header-back" onClick={() => navigate(-1)}><ArrowLeft size={24} /></button>
        <div className="header-title">Select Template</div>
        <div style={{width: 30}} />
      </div>
      <div style={{background: '#fff', padding: 12, borderBottom: `1px solid ${COLORS.border}`}}>
        <input
          className="text-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search templates..."
        />
      </div>
      <div className="page-body">
        {filtered.length === 0 && (
          <div className="empty-state"><div>No templates found</div></div>
        )}
        {filtered.map(item => (
          <div key={item.name} className="card" style={{cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1}}
               onClick={() => !sending && handleSelect(item)}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
              <strong style={{fontSize: 14}}>{item.name}</strong>
              <span style={{
                fontSize: 10, fontWeight: 700, background: 'rgba(0,0,0,0.06)',
                borderRadius: 6, padding: '2px 8px', color: COLORS.textSecondary,
              }}>{item.category}</span>
            </div>
            <p style={{
              fontSize: 13, color: COLORS.textSecondary, margin: 0,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{item.body}</p>
            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 8}}>
              <span style={{fontSize: 12, color: COLORS.textMuted}}>Tap to send</span>
              <span style={{color: COLORS.primary, display: 'flex'}}><ArrowRight size={16} /></span>
            </div>
          </div>
        ))}
      </div>
      {sending && <div className="center" style={{position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.7)'}}><div className="spinner" /></div>}
    </div>
  );
}
