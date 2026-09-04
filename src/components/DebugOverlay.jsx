// src/components/DebugOverlay.jsx
// ─────────────────────────────────────────────────────────────────────────────
// A visible, on-screen console log, for debugging exactly this kind of issue
// on iOS Safari without a Mac + cable + Web Inspector. Intercepts
// console.log/warn/error and window.onerror, shows the last N entries in a
// small floating panel you can screenshot directly from the iPhone.
//
// Only active when the URL has ?debug=1 — invisible otherwise, zero risk of
// this ever showing up for a normal user by accident.
// ─────────────────────────────────────────────────────────────────────────────
import React, {useState, useEffect, useRef} from 'react';

const MAX_LOGS = 60;

export default function DebugOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [logs, setLogs] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const idRef = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') !== '1') return;
    setEnabled(true);

    const push = (level, args) => {
      const text = args.map(a => {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      }).join(' ');
      idRef.current += 1;
      setLogs(prev => [...prev.slice(-(MAX_LOGS - 1)), {id: idRef.current, level, text, time: new Date().toLocaleTimeString()}]);
    };

    const orig = {log: console.log, warn: console.warn, error: console.error};
    console.log = (...a) => { orig.log(...a); push('log', a); };
    console.warn = (...a) => { orig.warn(...a); push('warn', a); };
    console.error = (...a) => { orig.error(...a); push('error', a); };

    const onError = e => push('error', [`window.onerror: ${e.message} (${e.filename}:${e.lineno})`]);
    const onRejection = e => push('error', [`unhandledrejection: ${e.reason?.message || e.reason}`]);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      console.log = orig.log;
      console.warn = orig.warn;
      console.error = orig.error;
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  if (!enabled) return null;

  const colorFor = level => (level === 'error' ? '#ff6b6b' : level === 'warn' ? '#ffd166' : '#9ae6b4');

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.92)', color: '#fff',
      fontFamily: 'monospace', fontSize: 11,
      maxHeight: collapsed ? 36 : '50vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      borderTop: '2px solid #333',
    }}>
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          padding: '8px 12px', background: '#111', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
          flexShrink: 0,
        }}>
        <span>🐞 Debug Console ({logs.length}) — tap to {collapsed ? 'expand' : 'collapse'}</span>
        <button
          onClick={e => { e.stopPropagation(); setLogs([]); }}
          style={{background: '#333', border: 'none', color: '#fff', borderRadius: 4, padding: '4px 8px', fontSize: 10}}>
          Clear
        </button>
      </div>
      {!collapsed && (
        <div style={{overflowY: 'auto', padding: 8, flex: 1}}>
          {logs.length === 0 && <div style={{opacity: 0.5}}>No logs yet — do the thing you're testing.</div>}
          {logs.map(l => (
            <div key={l.id} style={{marginBottom: 4, color: colorFor(l.level), wordBreak: 'break-word'}}>
              <span style={{opacity: 0.5}}>[{l.time}]</span> {l.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
