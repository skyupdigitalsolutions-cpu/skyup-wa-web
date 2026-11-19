// Daily WhatsApp inbox report — summary, per-agent counts, per-chat list and a
// CSV download of every message in the range. Data: GET /whatsapp/reports/inbox
import React, {useState, useEffect, useCallback} from 'react';
import {useNavigate} from 'react-router-dom';
import {ArrowLeft, Download, MessageCircle} from 'lucide-react';
import {inboxReportAPI} from '../services/apiService';
import {COLORS} from '../constants';

function toDateInput(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const DATE_PRESETS = [
  {key: 'today', label: 'Today', range: () => { const s = toDateInput(new Date()); return {from: s, to: s}; }},
  {key: 'yesterday', label: 'Yesterday', range: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = toDateInput(d); return {from: s, to: s}; }},
  {key: '7days', label: 'Last 7 Days', range: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6); return {from: toDateInput(from), to: toDateInput(to)}; }},
];

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {day: '2-digit', month: 'short'}) + ' ' +
    d.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'});
}

// Error bodies come back as Blobs when responseType is 'blob'.
async function errorMessage(e, fallback) {
  const data = e?.response?.data;
  if (data instanceof Blob) {
    try { return JSON.parse(await data.text()).error || fallback; } catch { return fallback; }
  }
  return data?.error || data?.message || fallback;
}

export default function InboxReportPage() {
  const navigate = useNavigate();
  const today = toDateInput(new Date());
  const [preset, setPreset] = useState('today');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inboxReportAPI.get({from, to});
      setData(res.data);
    } catch (e) {
      alert(await errorMessage(e, 'Could not load the inbox report.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await inboxReportAPI.downloadCsv({from, to});
      const url = URL.createObjectURL(new Blob([res.data], {type: 'text/csv;charset=utf-8'}));
      const a = document.createElement('a');
      a.href = url;
      a.download = from === to ? `whatsapp-inbox-${from}.csv` : `whatsapp-inbox-${from}_to_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      alert(await errorMessage(e, 'Download failed.'));
    } finally {
      setDownloading(false);
    }
  };

  const s = data?.summary;

  return (
    <div className="screen">
      <div className="header">
        <button className="header-back" onClick={() => navigate(-1)}><ArrowLeft size={24} /></button>
        <div className="header-title">Inbox Report</div>
        <button className="icon-btn" onClick={download} disabled={downloading || !s?.totalMessages} title="Download CSV">
          <Download size={18} />
        </button>
      </div>

      <div className="page-body">
        <div className="chip-row">
          {DATE_PRESETS.map(p => (
            <button key={p.key} className={`chip ${p.key === preset ? 'active' : ''}`}
                    onClick={() => { const r = p.range(); setPreset(p.key); setFrom(r.from); setTo(r.to); }}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{display: 'flex', gap: 8, marginBottom: 16}}>
          <input type="date" className="text-input" value={from} max={to}
                 onChange={e => { setFrom(e.target.value); setPreset('custom'); }} />
          <input type="date" className="text-input" value={to} min={from} max={today}
                 onChange={e => { setTo(e.target.value); setPreset('custom'); }} />
        </div>

        {loading ? <div className="center" style={{padding: 30}}><div className="spinner" /></div> : !s ? null : (
          <>
            <div className="summary-row">
              <div className="summary-card"><div className="summary-count" style={{color: COLORS.primary}}>{s.received}</div><div className="summary-label">Received</div></div>
              <div className="summary-card"><div className="summary-count" style={{color: COLORS.primary}}>{s.sent}</div><div className="summary-label">Sent</div></div>
              <div className="summary-card"><div className="summary-count">{s.activeChats}</div><div className="summary-label">Chats</div></div>
            </div>
            <div className="summary-row">
              <div className="summary-card"><div className="summary-count">{s.newChats}</div><div className="summary-label">New chats</div></div>
              <div className="summary-card"><div className="summary-count" style={{color: COLORS.statusWaiting}}>{s.unanswered}</div><div className="summary-label">Unanswered</div></div>
              <div className="summary-card"><div className="summary-count" style={{color: COLORS.danger}}>{s.failed}</div><div className="summary-label">Failed</div></div>
            </div>

            <button className="btn-primary" style={{width: '100%', margin: '8px 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8}}
                    onClick={download} disabled={downloading || !s.totalMessages}>
              <Download size={16} /> {downloading ? 'Preparing…' : `Download CSV (${s.totalMessages} messages)`}
            </button>

            {data.byAgent.length > 0 && (
              <>
                <div className="filter-label" style={{fontSize: 14, fontWeight: 700, color: COLORS.text}}>By agent</div>
                {data.byAgent.map(a => (
                  <div key={a.agent} style={{display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: `1px solid ${COLORS.border}`, fontSize: 13}}>
                    <span>{a.agent}</span>
                    <span style={{color: COLORS.textSecondary}}>{a.messagesSent} sent · {a.chatsHandled} chats</span>
                  </div>
                ))}
              </>
            )}

            <div className="filter-label" style={{fontSize: 14, fontWeight: 700, color: COLORS.text, marginTop: 16}}>Chats</div>
            {data.conversations.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon" style={{display: 'flex', justifyContent: 'center'}}><MessageCircle size={40} color={COLORS.textMuted} /></div>
                <div>No WhatsApp messages in this range.</div>
              </div>
            ) : data.conversations.map(c => (
              <div key={c.conversationId} className="log-row" style={{cursor: 'pointer'}} onClick={() => navigate(`/chat/${c.conversationId}`, {state: {contactName: c.contact || `+${c.phone}`}})}>
                <span className="log-dot" style={{background: c.unanswered ? COLORS.statusWaiting : COLORS.accent}} />
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {c.contact || `+${c.phone}`}
                  </div>
                  <div style={{fontSize: 11, color: COLORS.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {c.received} in · {c.sent} out{c.assignedAgent ? ` · ${c.assignedAgent}` : ''} — {c.lastMessage}
                  </div>
                </div>
                <span style={{fontSize: 11, color: COLORS.textMuted}}>{fmtTime(c.lastMessageAt)}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
