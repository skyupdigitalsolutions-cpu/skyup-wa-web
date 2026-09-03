// Ported from SkyUpWAFull's BlastScreen.js — same API calls, same filters
// (status, source, campaign), same confirm-then-send flow.
import React, {useState, useCallback, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {RefreshCw, ClipboardList, ArrowLeft} from 'lucide-react';
import {whatsappAPI} from '../services/apiService';
import {COLORS} from '../constants';

const STATUS_OPTIONS = ['Any status', 'New', 'Contacted', 'Interested', 'Not Interested', 'Converted'];

export default function BlastPage() {
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState(null);
  const [campaign, setCampaign] = useState('');
  const [status, setStatus] = useState('Any status');
  const [sources, setSources] = useState([]);
  const [source, setSource] = useState('Any source');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await whatsappAPI.getTemplates();
      setTemplates(res.data?.templates || []);
      setLastSyncedAt(res.data?.lastSyncedAt || null);
    } catch (e) {
      if (e?.response?.status === 403) {
        alert('This company doesn\u2019t have the WhatsApp Blast feature enabled.');
      } else {
        alert(e?.response?.data?.error || 'Could not load templates');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    whatsappAPI.getLeadSources().then(res => setSources(res.data?.sources || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await whatsappAPI.syncTemplates();
      alert(`Fetched ${res.data?.synced ?? res.data?.count ?? 'the latest'} template(s) from MSG91.`);
      await loadTemplates();
    } catch (e) {
      alert(e?.response?.data?.error || e?.response?.data?.message || 'Could not reach MSG91. Check your WhatsApp config.');
    } finally {
      setSyncing(false);
    }
  };

  const filteredTemplates = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  const sendBlast = async () => {
    if (!selected) {
      alert('Choose a template first.');
      return;
    }
    const filterSummary = [
      campaign.trim() ? `campaign "${campaign.trim()}"` : null,
      status !== 'Any status' ? `status "${status}"` : null,
      source !== 'Any source' ? `source "${source}"` : null,
    ].filter(Boolean).join(' + ') || 'ALL leads with a phone number';
    if (!window.confirm(`Send "${selected.name}" to ${filterSummary}?\n\nThis cannot be undone.`)) return;

    setSending(true);
    setResult(null);
    try {
      const payload = {templateName: selected.name, languageCode: selected.language || 'en_US'};
      if (campaign.trim()) payload.campaign = campaign.trim();
      const blastFilter = {};
      if (status !== 'Any status') blastFilter.status = status;
      if (source !== 'Any source') blastFilter.source = source;
      if (Object.keys(blastFilter).length > 0) payload.filter = blastFilter;

      const res = await whatsappAPI.bulkSend(payload);
      const {sent = 0, failed = 0, total = 0} = res.data || {};
      setResult({sent, failed, total});
      alert(`Blast complete\nSent: ${sent}\nFailed: ${failed}\nTotal matched: ${total}`);
    } catch (e) {
      alert(e?.response?.data?.error || e?.message || 'Something went wrong');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="screen">
      <div className="header">
        <button className="header-back" onClick={() => navigate(-1)}><ArrowLeft size={24} /></button>
        <div className="header-title">Blast Template</div>
        <button className="icon-btn" onClick={handleSync} disabled={syncing}>
          {syncing ? <RefreshCw size={16} className="spin-icon" /> : <><RefreshCw size={14} style={{marginRight: 4}} /> Sync</>}
        </button>
      </div>

      {lastSyncedAt && (
        <div style={{fontSize: 11, color: COLORS.textMuted, textAlign: 'center', padding: 6, background: '#fff'}}>
          Last synced {new Date(lastSyncedAt).toLocaleString()}
        </div>
      )}

      <div style={{background: '#fff', padding: 12, borderBottom: `1px solid ${COLORS.border}`}}>
        <input className="text-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..." />
      </div>

      <div className="page-body" style={{flex: '1 1 auto'}}>
        {loading ? <div className="center"><div className="spinner" /></div> : (
          filteredTemplates.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" style={{display: 'flex', justifyContent: 'center'}}><ClipboardList size={40} color={COLORS.textMuted} /></div>
              <div style={{fontWeight: 600, marginBottom: 6}}>No templates cached yet</div>
              <div style={{fontSize: 13}}>Tap "Sync" above to fetch them from MSG91.</div>
            </div>
          ) : (
            filteredTemplates.map(item => {
              const isSelected = selected?.name === item.name;
              const isApproved = String(item.status || '').toUpperCase() === 'APPROVED';
              return (
                <div key={item.name} className={`card ${isSelected ? 'selected' : ''}`} style={{cursor: 'pointer'}} onClick={() => setSelected(item)}>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 4}}>
                    <strong style={{fontSize: 14}}>{item.name}</strong>
                    <span style={{
                      fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '3px 8px',
                      background: isApproved ? '#DCF8C6' : '#F0F0F0',
                      color: isApproved ? COLORS.primaryDark : COLORS.textSecondary,
                    }}>{item.status || 'UNKNOWN'}</span>
                  </div>
                  <div style={{fontSize: 12, color: COLORS.textSecondary}}>
                    {item.category || '—'} · {item.language || '—'} · {item.bodyVariableCount || 0} variable(s)
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {selected && (
        <div style={{background: '#fff', borderTop: `1px solid ${COLORS.border}`, padding: 16}}>
          <div style={{fontWeight: 700, fontSize: 14, marginBottom: 8}}>Send "{selected.name}" to:</div>

          <div className="filter-label">Campaign / source name (optional)</div>
          <input className="text-input" value={campaign} onChange={e => setCampaign(e.target.value)} placeholder="Leave blank for all campaigns" />

          <div className="filter-label">Lead status</div>
          <select className="select-input" value={status} onChange={e => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>

          <div className="filter-label">Lead source</div>
          <select className="select-input" value={source} onChange={e => setSource(e.target.value)}>
            <option value="Any source">Any source</option>
            {sources.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>

          <button className="btn-primary" style={{marginTop: 14}} onClick={sendBlast} disabled={sending}>
            {sending ? 'Sending…' : 'Send Blast'}
          </button>

          {result && (
            <div style={{fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginTop: 10}}>
              Last result — Sent: {result.sent} · Failed: {result.failed} · Matched: {result.total}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
