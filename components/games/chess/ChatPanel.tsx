'use client';

import { useEffect, useRef, useState } from 'react';

import {
  ChatLimits,
  QUICK_CHAT_LABELS,
  chatEntryText,
  type ChatEntry,
} from '@/lib/kalpix-web-sdk/chat';

interface ChatPanelProps {
  messages: ChatEntry[];
  myUserId: string;
  onSendText: (text: string) => void;
  onSendQuick: (code: number) => void;
  disabled?: boolean;
}

// In-game chess chat: quick-chat presets + freeform text, matching MoveList's
// dark scroll-box styling. Attribution is server-authoritative (senderId off
// the broadcast entry); we compare it to myUserId for left/right alignment.
export default function ChatPanel({
  messages,
  myUserId,
  onSendText,
  onSendQuick,
  disabled = false,
}: ChatPanelProps) {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSendText(t.slice(0, ChatLimits.MaxTextLen));
    setText('');
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Quick-chat presets */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(QUICK_CHAT_LABELS).map(([code, label]) => (
          <button
            key={code}
            type="button"
            disabled={disabled}
            onClick={() => onSendQuick(Number(code))}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium hover:bg-white/20 disabled:opacity-40"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="max-h-40 overflow-y-auto rounded-md bg-black/40 p-2 text-sm"
      >
        {messages.length === 0 ? (
          <div className="px-1 py-2 text-white/40">No messages yet.</div>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === myUserId;
            const system = m.senderId === 'system';
            if (system) {
              return (
                <div key={m.seq} className="mb-1 text-center text-xs text-white/40">
                  {chatEntryText(m)}
                </div>
              );
            }
            return (
              <div
                key={m.seq}
                className={`mb-1 flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <span
                  className={`inline-block max-w-[80%] rounded-lg px-2.5 py-1 ${
                    mine ? 'bg-emerald-600/40' : 'bg-white/10'
                  }`}
                >
                  {!mine && m.username && (
                    <span className="mr-1 text-[11px] text-white/50">
                      {m.username}
                    </span>
                  )}
                  {chatEntryText(m)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={text}
          maxLength={ChatLimits.MaxTextLen}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder="Message…"
          className="flex-1 rounded-md bg-white/10 px-3 py-2 text-sm placeholder-white/30 outline-none disabled:opacity-40"
        />
        <button
          type="button"
          onClick={send}
          disabled={disabled || !text.trim()}
          className="rounded-md bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
