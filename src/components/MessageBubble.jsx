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

export default function MessageBubble({message}) {
  const isOutbound = message.direction === 'outbound';
  const [mediaError, setMediaError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    setMediaError(false);
    try {
      await whatsappAPI.refreshMedia(message._id);
    } catch {
      setMediaError(true);
    } finally {
      setRetrying(false);
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
          return (
            <img
              src={message.mediaUrl}
              alt=""
              className="media-image"
              onError={() => setMediaError(true)}
            />
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
        return (
          <div className="doc-row" onClick={() => message.mediaUrl && window.open(message.mediaUrl, '_blank')}>
            <FileText size={30} color={COLORS.textSecondary} className="doc-icon" />
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}
                   title={displayName}>
                {displayName}
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 6, marginTop: 2}}>
                {ext && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#fff', background: badgeColor,
                    borderRadius: 4, padding: '1px 6px',
                  }}>{ext}</span>
                )}
                <span style={{fontSize: 11, color: COLORS.textMuted}}>
                  {message.mediaMimeType || 'Tap to open'}
                </span>
              </div>
            </div>
            <Download size={18} color={COLORS.textSecondary} />
          </div>
        );
      }
      case 'audio':
        return (
          <div className="doc-row">
            <Music size={26} color={COLORS.textSecondary} />
            <div>
              <div style={{fontSize: 14}}>Voice Message</div>
              {message.mediaUrl && (
                <a href={message.mediaUrl} target="_blank" rel="noreferrer" style={{fontSize: 12, color: COLORS.primaryDark}}>
                  Tap to play
                </a>
              )}
            </div>
          </div>
        );
      case 'video':
        return (
          <div className="doc-row" onClick={() => message.mediaUrl && window.open(message.mediaUrl, '_blank')}>
            <Video size={26} color={COLORS.textSecondary} />
            <span style={{fontSize: 14}}>Video — Tap to open</span>
          </div>
        );
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
