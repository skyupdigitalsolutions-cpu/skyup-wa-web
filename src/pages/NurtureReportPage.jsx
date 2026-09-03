// Ported from SkyUpWAFull's NurtureReportScreen.js — same date presets,
// same status tabs, same summary/byRule/log structure from the backend.
import React, {useState, useCallback, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {ClipboardList, ArrowLeft} from 'lucide-react';
import {nurtureAPI} from '../services/apiService';
import {COLORS} from '../constants';

const STATUS_TABS = [
  {key: undefined, label: 'All'},
  {key: 'sent', label: 'Sent'},
  {key: 'failed', label: 'Failed'},
  {key: 'skipped', label: 'Skipped'},
];

const STATUS_COLOR = {sent: COLORS.primary, failed: COLORS.danger, skipped: COLORS.statusWaiting};

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {day: '2-digit', month: 'short'}) +
    ' ' + d.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'});
}

function toDateInput(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const DATE_PRESETS = [
  {key: 'today', label: 'Today', range: () => { const s = toDateInput(new Date()); return {from: s, to: s}; }},
  {key: 'yesterday', label: 'Yesterday', range: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = toDateInput(d); return {from: s, to: s}; }},
  {key: '7days', label: 'Last 7 Days', range: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6); return {from: toDateInput(from), to: toDateInput(to)}; }},
  {key: 'month', label: 'This Month', range: () => { const now = new Date(); const from = new Date(now.getFullYear(), now.getMonth(), 1); return {from: toDateInput(from), to: toDateInput(now)}; }},
  {key: 'all', label: 'All Time', range: () => ({from: '', to: ''})},
];

export default function NurtureReportPage() {
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState(undefined);
  const [datePreset, setDatePreset] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [summary, setSummary] = useState({sent: 0, failed: 0, skipped: 0, total: 0});
  const [byRule, setByRule] = useState([]);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({page: 1, hasMore: false});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (opts = {}) => {
    const {page = 1, append = false, status = statusFilter, from = fromDate, to = toDate} = opts;
    try {
      const params = {page, limit: 50};
      if (status) params.status = status;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await nurtureAPI.getReport(params);
      const data = res.data || {};
      setSummary(data.summary || {sent: 0, failed: 0, skipped: 0, total: 0});
      setByRule(Array.isArray(data.byRule) ? data.byRule : []);
      setLogs(prev => (append ? [...prev, ...(data.logs || [])] : (data.logs || [])));
      setPagination(data.pagination || {page: 1, hasMore: false});
    } catch (e) {
      const is403 = e?.response?.status === 403;
      if (!append) {
        alert(is403 ? 'Nurture reporting isn\u2019t enabled for this company.' : (e?.response?.data?.message || 'Could not load the nurture report.'));
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [statusFilter, fromDate, toDate]);

  useEffect(() => {
    setLoading(true);
    load({page: 1, status: statusFilter, from: fromDate, to: toDate});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, fromDate, toDate]);

  const onLoadMore = () => {
    if (loadingMore || !pagination.hasMore) return;
    setLoadingMore(true);
    load({page: pagination.page + 1, append: true, status: statusFilter, from: fromDate, to: toDate});
  };

  const applyPreset = preset => {
    setDatePreset(preset.key);
    const {from, to} = preset.range();
    setFromDate(from);
    setToDate(to);
  };

  return (
    <div className="screen">
      <div className="header">
        <button className="header-back" onClick={() => navigate(-1)}><ArrowLeft size={24} /></button>
        <div className="header-title">Nurture Report</div>
        <div style={{width: 30}} />
      </div>

      <div className="page-body">
        <div className="summary-row">
          <div className="summary-card"><div className="summary-count" style={{color: COLORS.primary}}>{summary.sent}</div><div className="summary-label">Sent</div></div>
          <div className="summary-card"><div className="summary-count" style={{color: COLORS.danger}}>{summary.failed}</div><div className="summary-label">Failed</div></div>
          <div className="summary-card"><div className="summary-count" style={{color: COLORS.statusWaiting}}>{summary.skipped}</div><div className="summary-label">Skipped</div></div>
        </div>
        <div style={{textAlign: 'center', fontSize: 12, color: COLORS.textSecondary, marginBottom: 12}}>
          {summary.total} total nurture send{summary.total === 1 ? '' : 's'}
        </div>

        <div className="chip-row">
          {STATUS_TABS.map(tab => (
            <button key={tab.label} className={`chip ${tab.key === statusFilter ? 'active' : ''}`} onClick={() => setStatusFilter(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="filter-label">Date range</div>
        <div className="chip-row">
          {DATE_PRESETS.map(preset => (
            <button key={preset.key} className={`chip ${preset.key === datePreset ? 'active' : ''}`} onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
        <div style={{display: 'flex', gap: 8, marginBottom: 16}}>
          <input type="date" className="text-input" value={fromDate}
                 onChange={e => { setFromDate(e.target.value); setDatePreset('custom'); }} />
          <input type="date" className="text-input" value={toDate}
                 onChange={e => { setToDate(e.target.value); setDatePreset('custom'); }} />
        </div>

        {byRule.length > 0 && (
          <>
            <div className="filter-label" style={{fontSize: 14, fontWeight: 700, color: COLORS.text}}>By rule</div>
            {byRule.map(rule => (
              <div key={String(rule.ruleId || rule.ruleName)} style={{display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: `1px solid ${COLORS.border}`}}>
                <span style={{fontSize: 13}}>{rule.ruleName}</span>
                <div style={{display: 'flex', gap: 10, fontSize: 11, fontWeight: 600}}>
                  <span style={{color: COLORS.primary}}>{rule.sent} sent</span>
                  <span style={{color: COLORS.danger}}>{rule.failed} failed</span>
                  <span style={{color: COLORS.statusWaiting}}>{rule.skipped} skip</span>
                </div>
              </div>
            ))}
          </>
        )}

        <div className="filter-label" style={{fontSize: 14, fontWeight: 700, color: COLORS.text, marginTop: 16}}>Log</div>
        {loading ? <div className="center" style={{padding: 30}}><div className="spinner" /></div> : (
          logs.length === 0 ? (
            <div className="empty-state"><div className="empty-icon" style={{display: 'flex', justifyContent: 'center'}}><ClipboardList size={40} color={COLORS.textMuted} /></div><div>No nurture sends in this range yet.</div></div>
          ) : (
            <>
              {logs.map((item, idx) => (
                <div key={String(item._id || idx)} className="log-row">
                  <span className="log-dot" style={{background: STATUS_COLOR[item.status] || COLORS.textMuted}} />
                  <div style={{flex: 1, minWidth: 0}}>
                    <div style={{fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                      {item.name || item.phone || 'Unknown lead'}
                    </div>
                    <div style={{fontSize: 11, color: COLORS.textSecondary}}>
                      {item.templateName || item.ruleName || 'Nurture send'}{item.reason ? ` — ${item.reason}` : ''}
                    </div>
                  </div>
                  <span style={{fontSize: 11, color: COLORS.textMuted}}>{fmtDate(item.createdAt)}</span>
                </div>
              ))}
              {pagination.hasMore && (
                <div style={{textAlign: 'center', padding: 16}}>
                  <button onClick={onLoadMore} style={{background: 'none', border: 'none', color: COLORS.primaryDark, fontWeight: 600}}>
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
