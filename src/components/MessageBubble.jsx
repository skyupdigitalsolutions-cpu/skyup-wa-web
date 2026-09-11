// Ported from SkyUpWAFull's MessageBubble.js — same message-type switch,
// same tick logic, HTML/CSS instead of RN View/Text/Image.
// Icons: lucide-react instead of emoji, for a consistent, crisp look across
// platforms/fonts (emoji render inconsistently across OS/browser combos).
import React, {useState} from 'react';
import {
  FileText, Image as ImageIcon, Music, Video, MapPin, Smile, ThumbsUp,
  Download, Clock, X, Check, CheckCheck, ClipboardList,
} from 'lucide-react';
import {COLORS} from '../constants';
import {formatMessageTime} from '../utils';
import {whatsappAPI} from '../services/apiService';

// Derives a real, human-readable filename + extension from the media URL
// when the backend didn't supply a caption/mimetype — this is what was
// showing as generic "Document" / "File" before, regardless of what was
// actually sent.
function fileInfoFromUrl(url) {
  if (!url) return {name: 'Document', ext: ''};
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    const rawName = path.split('/').pop() || 'Document';
    const dot = rawName.lastIndexOf('.');
    const ext = dot > -1 ? rawName.slice(dot + 1).toUpperCase() : '';
    // Cloudinary/upload URLs often prefix a random id — strip a leading
    // hash-like token (32+ hex chars) so real filenames aren't hidden behind it.
    const cleanName = rawName.replace(/^[a-f0-9]{20,}[_-]/i, '');
    return {name: cleanName || rawName, ext};
  } catch {
    return {name: 'Document', ext: ''};
  }
}

const EXT_COLORS = {
  PDF: '#D32F2F', DOC: '#1E88E5', DOCX: '#1E88E5',
  XLS: '#2E7D32', XLSX: '#2E7D32', PPT: '#E65100', PPTX: '#E65100',
  ZIP: '#6D4C41', RAR: '#6D4C41',
};

// Inbound media initially arrives as a private Meta URL (lookaside.fbsbx.com
// or graph.facebook.com) that 401s if opened directly — it requires the
// backend's own WhatsApp access token to fetch, which a browser can't
// provide. The backend mirrors it to Cloudinary asynchronously and emits
// wa_media_ready when done; refreshMedia() is the manual retry in the
// meantime. This was only wired up for the 'image' case before — document/
// audio/video just linked straight to the raw (401-prone) URL.
function isUnmirroredMediaUrl(url) {
  return !url || /lookaside\.fbsbx\.com|graph\.facebook\.com/i.test(url);
}

export default function MessageBubble({message}) {
  const isOutbound = message.direction === 'outbound';
  const [mediaError, setMediaError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const [downloading, setDownloading] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    setMediaError(false);
    try {
      await whatsappAPI.refreshMedia(message._id);
    } catch (e) {
      setMediaError(true);
      // Surface the backend's actual reason (e.g. "WhatsApp refused the
      // download — access token expired") instead of silently failing —
      // without this, retry looked like it "did nothing" with no way to
      // tell what's actually wrong.
      alert(e?.response?.data?.error || 'Could not reload this media. Please try again.');
    } finally {
      setRetrying(false);
    }
  };

  // FIX: previously, images had NO download affordance at all (couldn't
  // even open them), and document/audio/video only linked with
  // `target="_blank"` — which just VIEWS the file (browsers render
  // images/PDFs/videos inline rather than saving them), it doesn't actually
  // download it. This fetches the file as a blob and triggers a real
  // "Save As", which works regardless of the file's Content-Type — every
  // media type gets a genuine download now, not just documents.
  const handleDownload = async (url, suggestedName) => {
    if (!url || downloading) return;
    setDownloading(true);
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = suggestedName || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      // Falls back to opening the URL directly — at least gives the user
      // something to work with (e.g. right-click → Save As) instead of a
      // silent failure, if the blob fetch itself is blocked (rare, but
      // possible for a misconfigured CORS response).
      window.open(url, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  const renderContent = () => {
    switch (message.messageType) {
      case 'text':
        return <p className="bubble-body">{message.body}</p>;
      case 'template':
        return (
          <div>
            <div className="template-badge" style={{display: 'flex', alignItems: 'center', gap: 6}}>
              <ClipboardList size={14} color={COLORS.textSecondary} />
              <div className="template-badge-text">Template</div>
              {message.templateName && (
                <div style={{fontSize: 11, color: COLORS.textMuted, marginTop: 2}}>{message.templateName}</div>
              )}
            </div>
            {message.body ? <p className="bubble-body">{message.body}</p> : null}
          </div>
        );
      case 'image':
        if (message.mediaUrl && !mediaError) {
          const {name: imgName} = fileInfoFromUrl(message.mediaUrl);
          return (
            <div style={{position: 'relative'}}>
              <img
                src={message.mediaUrl}
                alt=""
                className="media-image"
                onError={() => setMediaError(true)}
              />
              <button
                onClick={() => handleDownload(message.mediaUrl, imgName)}
                disabled={downloading}
                title="Download image"
                style={{
                  position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.55)',
                  border: 'none', borderRadius: 20, width: 30, height: 30,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                {downloading ? <div className="spinner" style={{width: 14, height: 14}} /> : <Download size={15} color="#fff" />}
              </button>
            </div>
          );
        }
        return (
          <button className="media-placeholder" onClick={handleRetry} disabled={retrying}>
            {retrying ? <div className="spinner" style={{width: 20, height: 20}} /> : (
              <>
                <ImageIcon size={32} color={COLORS.textSecondary} />
                <span style={{fontSize: 13, color: COLORS.textSecondary, marginTop: 6}}>{mediaError ? 'Tap to retry' : 'Loading...'}</span>
              </>
            )}
          </button>
        );
      case 'document': {
        const {name, ext} = fileInfoFromUrl(message.mediaUrl);
        const displayName = message.mediaCaption || name;
        const badgeColor = EXT_COLORS[ext] || COLORS.textSecondary;
        const notReady = isUnmirroredMediaUrl(message.mediaUrl);
        return (
          <div
            className="doc-row"
            onClick={() => {
              if (notReady) handleRetry();
              // FIX: was window.open(), which just VIEWS the file — browsers
              // render PDFs/images inline instead of saving them. Downloads
              // the actual file now, same as every other media type.
              else handleDownload(message.mediaUrl, displayName);
            }}
            style={{cursor: (retrying || downloading) ? 'default' : 'pointer'}}>
            {(retrying || downloading) ? <div className="spinner" style={{width: 24, height: 24}} /> : <FileText size={30} color={COLORS.textSecondary} className="doc-icon" />}
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}
                   title={displayName}>
                {notReady ? 'Document' : displayName}
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 6, marginTop: 2}}>
                {!notReady && ext && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#fff', background: badgeColor,
                    borderRadius: 4, padding: '1px 6px',
                  }}>{ext}</span>
                )}
                <span style={{fontSize: 11, color: COLORS.textMuted}}>
                  {notReady ? (retrying ? 'Processing…' : 'Tap to retry loading') : downloading ? 'Downloading…' : (message.mediaMimeType || 'Tap to download')}
                </span>
              </div>
            </div>
            {!retrying && !downloading && <Download size={18} color={COLORS.textSecondary} />}
          </div>
        );
      }
      case 'audio': {
        const audioNotReady = isUnmirroredMediaUrl(message.mediaUrl);
        return (
          <div className="doc-row" style={{alignItems: 'center'}}>
            <Music size={26} color={COLORS.textSecondary} />
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontSize: 14}}>Voice Message</div>
              {audioNotReady ? (
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  style={{fontSize: 12, color: COLORS.primaryDark, background: 'none', border: 'none', padding: 0, cursor: 'pointer'}}>
                  {retrying ? 'Processing…' : 'Tap to retry loading'}
                </button>
              ) : (
                // FIX: was a plain link opening a new tab to "play" (browser-
                // dependent, often just re-downloads or shows a bare player
                // page). A real inline player is better UX, and it's now
                // paired with an explicit download button below so the file
                // is always genuinely downloadable too, not just playable.
                <audio controls src={message.mediaUrl} style={{height: 32, maxWidth: 220}} />
              )}
            </div>
            {!audioNotReady && (
              <button
                onClick={() => handleDownload(message.mediaUrl, 'voice-message.ogg')}
                disabled={downloading}
                title="Download audio"
                style={{background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0}}>
                {downloading ? <div className="spinner" style={{width: 16, height: 16}} /> : <Download size={18} color={COLORS.textSecondary} />}
              </button>
            )}
          </div>
        );
      }
      case 'video': {
        const videoNotReady = isUnmirroredMediaUrl(message.mediaUrl);
        if (videoNotReady) {
          return (
            <div className="doc-row" onClick={handleRetry} style={{cursor: retrying ? 'default' : 'pointer'}}>
              <Video size={26} color={COLORS.textSecondary} />
              <span style={{fontSize: 14}}>{retrying ? 'Processing…' : 'Tap to retry loading'}</span>
            </div>
          );
        }
        // FIX: was window.open() — just VIEWS the video in a new tab, not a
        // real download. Inline player for viewing + explicit download
        // button, matching the same pattern as the audio fix above.
        return (
          <div>
            <video controls src={message.mediaUrl} style={{maxWidth: '100%', borderRadius: 8, display: 'block'}} />
            <button
              onClick={() => handleDownload(message.mediaUrl, 'video.mp4')}
              disabled={downloading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, marginTop: 6,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 12, color: COLORS.primaryDark,
              }}>
              {downloading ? <div className="spinner" style={{width: 14, height: 14}} /> : <Download size={14} />}
              {downloading ? 'Downloading…' : 'Download video'}
            </button>
          </div>
        );
      }
      case 'location':
        return (
          <div style={{display: 'flex', alignItems: 'center', gap: 6, fontStyle: 'italic', fontSize: 13}}>
            <MapPin size={14} /> Location shared
          </div>
        );
      case 'sticker':
        return (
          <div style={{display: 'flex', alignItems: 'center', gap: 6, fontStyle: 'italic', fontSize: 13}}>
            <Smile size={14} /> Sticker
          </div>
        );
      case 'reaction':
        return (
          <div style={{display: 'flex', alignItems: 'center', gap: 6, fontStyle: 'italic', fontSize: 13}}>
            <ThumbsUp size={14} /> Reaction: {message.body}
          </div>
        );
      default:
        return <div style={{fontStyle: 'italic', fontSize: 13, color: COLORS.textSecondary}}>[Unsupported message]</div>;
    }
  };

  const tickColor = message.status === 'read' ? COLORS.tickRead : COLORS.tickDelivered;
  const tick =
    message.status === 'pending' ? <Clock size={13} color={COLORS.textMuted} /> :
    message.status === 'failed' ? <X size={14} color={COLORS.tickFailed} /> :
    message.status === 'sent' ? <Check size={14} color={COLORS.tickSent} /> :
    <CheckCheck size={14} color={tickColor} />;

  return (
    <div className={`msg-wrapper ${isOutbound ? 'out' : 'in'}`}>
      <div className={`bubble ${isOutbound ? 'out' : 'in'} ${message._optimistic ? 'optimistic' : ''}`}>
        {/* FIX: outbound messages never showed WHO sent them — every "sent"
            bubble looked identical whether it was the current user or a
            teammate who'd handled this lead before them. The data
            (message.sentBy) was already coming from the backend; it just
            wasn't rendered here. Matches the same fix applied to the admin
            and employee WhatsApp pages in the main CRM frontend. */}
        {isOutbound && message.sentBy?.name && (
          <div style={{fontSize: 11, fontWeight: 700, color: COLORS.primaryDark, marginBottom: 3}}>
            {message.sentBy.name}
          </div>
        )}
        {renderContent()}
        {message.editedAt && <div style={{fontSize: 11, color: COLORS.textMuted, fontStyle: 'italic'}}>edited</div>}
        <div className="bubble-meta">
          <span className="bubble-time">{formatMessageTime(message.waTimestamp)}</span>
          {isOutbound && <span className="bubble-tick" style={{display: 'inline-flex', alignItems: 'center'}}>{tick}</span>}
        </div>
      </div>
    </div>
  );
}
