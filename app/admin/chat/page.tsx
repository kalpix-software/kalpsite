'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Send, RefreshCw, MessageSquare, Bot, User, Search,
  Image as ImageIcon, Film, FileText, Music, Smile,
} from 'lucide-react';
import { callAdminRpc } from '@/lib/admin-rpc';

// ---------------------------------------------------------------------------
// Types matching the Go ChatMessage struct
// ---------------------------------------------------------------------------

interface Conversation {
  conversationId: string;
  botId: string;
  botName: string;
  userId: string;
  username: string;
  lastMessage: string;
  lastMessageAt: number;
  unreadCount: number;
  status: string;
  isOnline?: boolean;
  lastSeenAt?: number;
}

interface ChatMessage {
  messageId: string;
  channelId: string;
  senderId: string;
  senderName: string;
  displayName?: string;
  content: string;
  messageType?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaThumbnail?: string;
  mediaMimeType?: string;
  mediaWidth?: number;
  mediaHeight?: number;
  mediaDuration?: number;
  mediaSize?: number;
  fileName?: string;
  replyToId?: string;
  replyToSenderName?: string;
  replyToSenderDisplayName?: string;
  replyToContent?: string;
  forwardedFrom?: string;
  forwardedSenderName?: string;
  status: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(ts: number): string {
  if (!ts) return '';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function lastSeenText(isOnline?: boolean, lastSeenAt?: number): string {
  if (isOnline) return 'Online';
  if (!lastSeenAt) return 'Offline';
  const diff = Math.floor(Date.now() / 1000) - lastSeenAt;
  if (diff < 60) return 'Last seen just now';
  if (diff < 3600) return `Last seen ${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `Last seen ${Math.floor(diff / 3600)}h ago`;
  return `Last seen ${Math.floor(diff / 86400)}d ago`;
}

function lastSeenShort(isOnline?: boolean, lastSeenAt?: number): string {
  if (isOnline) return 'Online';
  if (!lastSeenAt) return 'Offline';
  const diff = Math.floor(Date.now() / 1000) - lastSeenAt;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMediaUrls(msg: ChatMessage): string[] {
  if (msg.mediaUrls && msg.mediaUrls.length > 0) return msg.mediaUrls;
  if (msg.mediaUrl) return [msg.mediaUrl];
  return [];
}

function isImageType(type?: string): boolean {
  return type === 'image' || type === 'gif';
}

function isVideoType(type?: string): boolean {
  return type === 'video';
}

function isAudioType(type?: string): boolean {
  return type === 'audio';
}

function isDocType(type?: string): boolean {
  return type === 'file' || type === 'document';
}

function groupMessagesByDate(messages: ChatMessage[]): { date: string; messages: ChatMessage[] }[] {
  const groups: { date: string; messages: ChatMessage[] }[] = [];
  let currentDate = '';
  for (const msg of messages) {
    const date = formatDate(msg.createdAt);
    if (date !== currentDate) {
      currentDate = date;
      groups.push({ date, messages: [] });
    }
    groups[groups.length - 1].messages.push(msg);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Media renderers
// ---------------------------------------------------------------------------

function MediaGrid({ urls, type, msg }: { urls: string[]; type?: string; msg: ChatMessage }) {
  if (urls.length === 0) return null;

  if (isImageType(type)) {
    return (
      <div className={`grid gap-1 mb-1 ${urls.length === 1 ? '' : urls.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
        {urls.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={url}
              alt=""
              className="rounded-lg max-w-full max-h-64 object-cover w-full cursor-pointer hover:opacity-90 transition"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </a>
        ))}
      </div>
    );
  }

  if (isVideoType(type)) {
    return (
      <div className="mb-1">
        {urls.map((url, i) => (
          <div key={i} className="relative">
            <video
              src={url}
              controls
              preload="metadata"
              className="rounded-lg max-w-full max-h-64 w-full"
            />
            {msg.mediaDuration && (
              <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                {Math.floor(msg.mediaDuration / 60)}:{(msg.mediaDuration % 60).toString().padStart(2, '0')}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (isAudioType(type)) {
    return (
      <div className="mb-1">
        {urls.map((url, i) => (
          <audio key={i} src={url} controls className="w-full max-w-xs" preload="metadata" />
        ))}
      </div>
    );
  }

  if (isDocType(type)) {
    return (
      <div className="mb-1 space-y-1">
        {urls.map((url, i) => (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition"
          >
            <FileText className="w-5 h-5 shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <p className="text-xs truncate">{msg.fileName || 'Document'}</p>
              {msg.mediaSize ? (
                <p className="text-[10px] opacity-60">{formatFileSize(msg.mediaSize)}</p>
              ) : null}
            </div>
          </a>
        ))}
      </div>
    );
  }

  // Fallback: render as links
  return (
    <div className="mb-1 space-y-1">
      {urls.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs underline block truncate">
          {url}
        </a>
      ))}
    </div>
  );
}

function MessageTypeIcon({ type }: { type?: string }) {
  if (!type || type === 'text') return null;
  const cls = 'w-3 h-3 inline mr-1 opacity-60';
  if (isImageType(type)) return <ImageIcon className={cls} />;
  if (isVideoType(type)) return <Film className={cls} />;
  if (isAudioType(type)) return <Music className={cls} />;
  if (isDocType(type)) return <FileText className={cls} />;
  if (type === 'sticker' || type === 'emoji') return <Smile className={cls} />;
  return null;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const convoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ------ Data fetching ------

  const fetchConversations = useCallback(async () => {
    try {
      const res = await callAdminRpc('admin/get_fake_user_conversations', JSON.stringify({ limit: 100, offset: 0 }));
      const convos = (res as { conversations?: Conversation[] }).conversations || [];
      setConversations(convos);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to fetch conversations:', msg);
      setError(`Conversations: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (channelId: string) => {
    try {
      setLoadingMessages(true);
      const res = await callAdminRpc('admin/get_fake_user_conversation_messages', JSON.stringify({
        channelId,
        limit: 200,
      }));

      let msgs = (res as { messages?: ChatMessage[] }).messages || [];

      // Backend returns newest-first; reverse so oldest is at top
      msgs = [...msgs].reverse();

      setMessages(msgs);
      setError(null);
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to fetch messages:', msg, err);
      setError(`Messages: ${msg}`);
    } finally {
      setLoadingMessages(false);
    }
  }, [scrollToBottom]);

  // ------ Polling ------

  useEffect(() => {
    fetchConversations();
    convoPollRef.current = setInterval(fetchConversations, 5000);
    return () => { if (convoPollRef.current) clearInterval(convoPollRef.current); };
  }, [fetchConversations]);

  useEffect(() => {
    if (!selectedConvo) return;
    fetchMessages(selectedConvo.conversationId);
    pollRef.current = setInterval(() => fetchMessages(selectedConvo.conversationId), 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedConvo, fetchMessages]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredConversations(
        conversations.filter(
          c => c.username.toLowerCase().includes(q) || c.botName.toLowerCase().includes(q)
        )
      );
    }
  }, [searchQuery, conversations]);

  // ------ Actions ------

  const handleSend = async () => {
    if (!selectedConvo || !newMessage.trim() || sending) return;
    setSending(true);
    try {
      await callAdminRpc('admin/send_message_as_fake_user', JSON.stringify({
        fakeUserId: selectedConvo.botId,
        channelId: selectedConvo.conversationId,
        content: newMessage.trim(),
      }));
      setNewMessage('');
      await fetchMessages(selectedConvo.conversationId);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectConversation = (convo: Conversation) => {
    setSelectedConvo(convo);
    setMessages([]);
  };

  const messageGroups = groupMessagesByDate(messages);

  // ------ Render ------

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-6">
      {/* Error banner */}
      {error && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-red-600/90 text-white text-xs px-4 py-2 rounded-lg shadow-lg max-w-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline">dismiss</button>
        </div>
      )}

      {/* =================== Sidebar =================== */}
      <div className="w-80 border-r border-slate-700 flex flex-col bg-slate-900/50">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              Bot Chats
            </h2>
            <button
              onClick={fetchConversations}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-pulse text-slate-400 text-sm">Loading conversations...</div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-sm">
              <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
              <p>No conversations yet</p>
              <p className="text-xs mt-1">Messages from users to bot players will appear here</p>
            </div>
          ) : (
            filteredConversations.map(convo => (
              <button
                key={convo.conversationId}
                onClick={() => selectConversation(convo)}
                className={`w-full text-left p-3 border-b border-slate-800 hover:bg-slate-800/60 transition ${
                  selectedConvo?.conversationId === convo.conversationId ? 'bg-slate-800' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-slate-100 truncate flex items-center gap-1.5">
                        {convo.username}
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            convo.isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                          }`}
                          title={lastSeenText(convo.isOnline, convo.lastSeenAt)}
                        />
                      </span>
                      <span className="text-xs text-slate-500 shrink-0 ml-2">{timeAgo(convo.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Bot className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span className="text-xs text-indigo-400 truncate">{convo.botName}</span>
                      <span className="text-[10px] text-slate-500" title={lastSeenText(convo.isOnline, convo.lastSeenAt)}>
                        • {lastSeenShort(convo.isOnline, convo.lastSeenAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-1">{convo.lastMessage || 'Media'}</p>
                  </div>
                  {convo.unreadCount > 0 && (
                    <span className="bg-indigo-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0">
                      {convo.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* =================== Chat Area =================== */}
      <div className="flex-1 flex flex-col bg-slate-900">
        {!selectedConvo ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg">Select a conversation</p>
            <p className="text-sm mt-1">Choose a conversation from the left panel to start replying</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                      selectedConvo.isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                    }`}
                    title={lastSeenText(selectedConvo.isOnline, selectedConvo.lastSeenAt)}
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                    {selectedConvo.username}
                    <span className="text-[10px] font-normal text-slate-400">
                      {lastSeenText(selectedConvo.isOnline, selectedConvo.lastSeenAt)}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    Replying as <Bot className="w-3 h-3 text-indigo-400 inline" />
                    <span className="text-indigo-400">{selectedConvo.botName}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loadingMessages && messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-pulse text-slate-400 text-sm">Loading messages...</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                  No messages in this conversation
                </div>
              ) : (
                messageGroups.map((group, gi) => (
                  <div key={gi}>
                    <div className="flex items-center justify-center my-4">
                      <span className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full">
                        {group.date}
                      </span>
                    </div>
                    {group.messages.map(msg => {
                      const isFakeUser = msg.senderId === selectedConvo.botId;
                      const mediaUrls = getMediaUrls(msg);
                      const hasMedia = mediaUrls.length > 0;
                      const hasText = msg.content && msg.content.trim().length > 0;

                      if (msg.isDeleted) {
                        return (
                          <div key={msg.messageId} className={`flex mb-3 ${isFakeUser ? 'justify-end' : 'justify-start'}`}>
                            <div className="px-3.5 py-2 rounded-2xl bg-slate-800/50 border border-slate-700">
                              <p className="text-xs italic text-slate-500">Message deleted</p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.messageId}
                          className={`flex mb-3 ${isFakeUser ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-2xl overflow-hidden ${
                              isFakeUser
                                ? 'bg-indigo-600 text-white rounded-br-md'
                                : 'bg-slate-800 text-slate-200 rounded-bl-md'
                            } ${hasMedia && !hasText ? 'p-1' : 'px-3.5 py-2'}`}
                          >
                            {/* Sender name for incoming */}
                            {!isFakeUser && hasText && (
                              <p className="text-xs font-medium text-slate-400 mb-0.5">
                                {msg.displayName || msg.senderName}
                              </p>
                            )}

                            {/* Reply preview */}
                            {msg.replyToId && (
                              <div className={`text-[11px] mb-1 px-2 py-1 rounded border-l-2 ${
                                isFakeUser
                                  ? 'bg-indigo-700/50 border-indigo-300'
                                  : 'bg-slate-700/50 border-slate-500'
                              }`}>
                                <p className={`font-medium ${isFakeUser ? 'text-indigo-200' : 'text-slate-400'}`}>
                                  {msg.replyToSenderDisplayName || msg.replyToSenderName || 'Unknown'}
                                </p>
                                <p className="truncate opacity-70">{msg.replyToContent || 'Media'}</p>
                              </div>
                            )}

                            {/* Forwarded label */}
                            {msg.forwardedFrom && (
                              <p className={`text-[10px] italic mb-1 ${isFakeUser ? 'text-indigo-200' : 'text-slate-500'}`}>
                                Forwarded from {msg.forwardedSenderName || 'unknown'}
                              </p>
                            )}

                            {/* Media */}
                            {hasMedia && (
                              <div className={hasText ? 'mb-1' : 'p-0.5'}>
                                <MediaGrid urls={mediaUrls} type={msg.messageType} msg={msg} />
                              </div>
                            )}

                            {/* Text content */}
                            {hasText && (
                              <p className={`text-sm whitespace-pre-wrap break-words ${hasMedia ? '' : ''}`}>
                                {msg.content}
                              </p>
                            )}

                            {/* Footer */}
                            <div className={`flex items-center gap-1 mt-1 ${
                              hasMedia && !hasText ? 'px-2 pb-1' : ''
                            }`}>
                              <MessageTypeIcon type={!hasText ? msg.messageType : undefined} />
                              {msg.isEdited && (
                                <span className={`text-[10px] ${isFakeUser ? 'text-indigo-200' : 'text-slate-500'}`}>edited</span>
                              )}
                              <span className={`text-[10px] ml-auto ${isFakeUser ? 'text-indigo-200' : 'text-slate-500'}`}>
                                {formatTime(msg.createdAt)}
                              </span>
                              {isFakeUser && (
                                <span className={`text-[10px] opacity-60`}>
                                  ({selectedConvo.botName})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-5 py-3 border-t border-slate-700 bg-slate-900/80">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Reply as ${selectedConvo.botName}...`}
                    rows={1}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                    style={{ minHeight: '42px', maxHeight: '120px' }}
                    onInput={e => {
                      const el = e.target as HTMLTextAreaElement;
                      el.style.height = 'auto';
                      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                    }}
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl transition shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
