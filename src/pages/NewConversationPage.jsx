import React, {useState, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {useDispatch} from 'react-redux';
import {Check, ArrowLeft, ArrowRight} from 'lucide-react';
import {whatsappAPI} from '../services/apiService';
import {fetchConversations} from '../store/slices/conversationsSlice';
import {COLORS} from '../constants';
import {normalizePhoneToE164, formatDisplayPhone} from '../utils';

const QUICK_TEMPLATES = ['crm_followup_leads', 'crm_greeting', 'crm_callback_request'];

export default function NewConversationPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [tab, setTab] = useState('lead');
  const [phone, setPhone] = useState('');
  const [template, setTemplate] = useState(QUICK_TEMPLATES[0]);
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingLeads(true);
      try {
        const res = await whatsappAPI.getLeads();
        const data = res.data.leads || res.data || [];
        setLeads(Array.isArray(data) ? data : []);
      } catch {
        setLeads([]);
      } finally {
        setLoadingLeads(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (leadSearch.trim()) {
      const q = leadSearch.toLowerCase();
      setFilteredLeads(leads.filter(l =>
        l.name?.toLowerCase().includes(q) || l.mobile?.includes(q),
      ));
    } else {
      setFilteredLeads(leads.slice(0, 50));
    }
  }, [leadSearch, leads]);

  const handleStart = async () => {
    const targetPhone = tab === 'phone'
      ? normalizePhoneToE164(phone)
      : normalizePhoneToE164(selectedLead?.mobile || '');

    if (!targetPhone || targetPhone.length < 10) {
      alert('Please enter a valid phone number.');
      return;
    }
    if (!template.trim()) {
      alert('Please select a template.');
      return;
    }

    setStarting(true);
    try {
      const res = await whatsappAPI.startConversation({
        phone: targetPhone, templateName: template, leadId: selectedLead?._id,
      });
      const convoId = res.data.conversation?._id || res.data.conversationId;
      dispatch(fetchConversations());
      if (window.confirm('Template sent! Open the chat now? (Cancel to return to Inbox)')) {
        navigate(`/chat/${convoId}`, {
          replace: true,
          state: {contactName: selectedLead?.name || formatDisplayPhone(targetPhone), leadId: selectedLead?._id},
        });
      } else {
        navigate('/');
      }
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Could not start conversation');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="screen">
      <div className="header">
        <button className="header-back" onClick={() => navigate(-1)}><ArrowLeft size={24} /></button>
        <div className="header-title">New Conversation</div>
        <div style={{width: 30}} />
      </div>

      <div className="page-body">
        <div style={{display: 'flex', background: '#fff', borderRadius: 10, marginBottom: 12, overflow: 'hidden'}}>
          {['lead', 'phone'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: 12, border: 'none', background: 'transparent',
                fontWeight: tab === t ? 700 : 500,
                color: tab === t ? COLORS.primary : COLORS.textSecondary,
                borderBottom: tab === t ? `2px solid ${COLORS.primary}` : '2px solid transparent',
              }}>
              {t === 'lead' ? 'Select Lead' : 'Enter Phone'}
            </button>
          ))}
        </div>

        <div className="card">
          {tab === 'phone' ? (
            <>
              <div className="filter-label" style={{textTransform: 'uppercase', fontWeight: 700, margin: 0}}>Phone Number</div>
              <input
                className="text-input" style={{marginTop: 8}}
                value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="9876543210 (10-digit)" type="tel"
              />
              {phone.length >= 10 && (
                <div style={{fontSize: 12, color: COLORS.primary, marginTop: 6, fontWeight: 600}}>
                  Will send to: +{normalizePhoneToE164(phone)}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="filter-label" style={{textTransform: 'uppercase', fontWeight: 700, margin: 0}}>
                Search Lead {selectedLead ? `(${selectedLead.name})` : ''}
              </div>
              <input
                className="text-input" style={{marginTop: 8, marginBottom: 10}}
                value={leadSearch} onChange={e => setLeadSearch(e.target.value)}
                placeholder="Search by name or phone..."
              />
              {loadingLeads ? <div className="spinner" style={{margin: '20px auto'}} /> : (
                filteredLeads.map(item => {
                  const isSel = selectedLead?._id === item._id;
                  return (
                    <div
                      key={item._id}
                      onClick={() => setSelectedLead(isSel ? null : item)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px',
                        borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer',
                        background: isSel ? COLORS.primaryLight : 'transparent',
                      }}>
                      <div className="avatar" style={{width: 38, height: 38, background: COLORS.primary, fontSize: 15}}>
                        {(item.name || item.mobile || '?')[0].toUpperCase()}
                      </div>
                      <div style={{flex: 1}}>
                        <div style={{fontWeight: 600, fontSize: 15}}>{item.name || 'Unknown'}</div>
                        <div style={{fontSize: 13, color: COLORS.textSecondary}}>{item.mobile || 'No phone'}</div>
                      </div>
                      {isSel && <Check size={18} color={COLORS.primary} />}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        <div className="card">
          <div className="filter-label" style={{textTransform: 'uppercase', fontWeight: 700, margin: 0, marginBottom: 10}}>
            Template (required)
          </div>
          {QUICK_TEMPLATES.map(t => (
            <div
              key={t}
              onClick={() => setTemplate(t)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 8, border: `1px solid ${template === t ? COLORS.primary : COLORS.border}`,
                marginBottom: 8, cursor: 'pointer',
                background: template === t ? COLORS.primaryLight : 'transparent',
              }}>
              <div style={{
                width: 18, height: 18, borderRadius: 9, border: `2px solid ${COLORS.primary}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {template === t && <div style={{width: 9, height: 9, borderRadius: 5, background: COLORS.primary}} />}
              </div>
              <span style={{fontSize: 14, fontWeight: 500}}>{t}</span>
            </div>
          ))}
          <input
            className="text-input" style={{marginTop: 6}}
            value={template} onChange={e => setTemplate(e.target.value)}
            placeholder="Or type a custom template name..."
          />
        </div>

        <div style={{padding: '4px 4px 24px'}}>
          <button className="btn-primary" onClick={handleStart} disabled={starting} style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8}}>
            {starting ? 'Starting…' : <>Start Conversation <ArrowRight size={18} /></>}
          </button>
          <p style={{fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: 10}}>
            WhatsApp requires a pre-approved template to start a new conversation.
          </p>
        </div>
      </div>
    </div>
  );
}
