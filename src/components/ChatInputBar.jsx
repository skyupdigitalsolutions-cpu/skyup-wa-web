// Ported from SkyUpWAFull's ChatInputBar.js. The one real platform swap:
// react-native-image-picker / react-native-document-picker (native pickers,
// no browser equivalent) become a single <input type="file"> — the standard
// browser file picker.
import React, {useState, useRef} from 'react';
import {Paperclip, ClipboardList, Send} from 'lucide-react';
import {COLORS} from '../constants';

export default function ChatInputBar({sessionState, sending, onSendText, onSendMedia, onTemplatePress}) {
  const [text, setText] = useState('');
  const fileInputRef = useRef(null);
  const isDisabled = sessionState === 'expired' || sending;

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isDisabled) return;
    onSendText(trimmed);
    setText('');
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = e => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file twice in a row
    if (!file) return;

    const fd = new FormData();
    fd.append('file', file, file.name);

    let type = 'document';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';

    onSendMedia(fd, type);
  };

  if (sessionState === 'expired') {
    return (
      <div className="expired-bar">
        <button className="session-banner-btn" style={{padding: '12px 20px', borderRadius: 22, display: 'inline-flex', alignItems: 'center', gap: 8}} onClick={onTemplatePress}>
          <ClipboardList size={16} /> Send Template to Restart Chat
        </button>
      </div>
    );
  }

  return (
    <div className="chat-input-bar">
      <input
        ref={fileInputRef}
        type="file"
        style={{display: 'none'}}
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx"
      />
      <button
        className="icon-btn"
        style={{background: 'transparent', color: COLORS.textSecondary}}
        onClick={() => !isDisabled && fileInputRef.current?.click()}
        disabled={isDisabled}>
        <Paperclip size={20} />
      </button>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message"
        rows={1}
        maxLength={4000}
        disabled={isDisabled}
      />
      <button
        className="icon-btn"
        style={{background: 'transparent', color: COLORS.textSecondary}}
        onClick={onTemplatePress}
        disabled={isDisabled}>
        <ClipboardList size={20} />
      </button>
      <button className="send-btn" onClick={handleSend} disabled={!text.trim() || isDisabled}>
        <Send size={18} />
      </button>
    </div>
  );
}
