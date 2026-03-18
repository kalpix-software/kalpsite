'use client';

import { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Send, RefreshCw, MessageSquare, Bot, User, Search,
  Image as ImageIcon, Film, FileText, Music, Smile, Paperclip,
} from 'lucide-react';
import { Client, Session } from '@heroiclabs/nakama-js';
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
  /** emoji -> list of userIds (from backend) */
  reactions?: Record<string, string[]>;
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

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '😊', '🤔', '🎉'];

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
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const reactionPickerAnchorRef = useRef<HTMLElement | null>(null);
  const [pickerPosition, setPickerPosition] = useState<{ left: number; top: number } | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const fetchMessages = useCallback(async (channelId: string, cursor?: string, append = false) => {
    try {
      if (!append) setLoadingMessages(true);
      const res = await callAdminRpc('admin/get_fake_user_conversation_messages', JSON.stringify({
        channelId,
        limit: 50,
        ...(cursor ? { cursor } : {}),
      }));

      const data = res as { messages?: ChatMessage[]; nextCursor?: string };
      let msgs = data.messages || [];
      const next = data.nextCursor && data.nextCursor !== '' ? data.nextCursor : null;

      // Backend returns newest-first; reverse so oldest is at top
      msgs = [...msgs].reverse();

      if (append) {
        setMessages(prev => [...msgs, ...prev]);
        setNextCursor(next);
        setLoadingMore(false);
      } else {
        setMessages(msgs);
        setNextCursor(next);
        setError(null);
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!append) setError(`Messages: ${msg}`);
      setLoadingMore(false);
    } finally {
      if (!append) setLoadingMessages(false);
    }
  }, [scrollToBottom]);

  const loadMoreMessages = useCallback(() => {
    if (!selectedConvo || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    fetchMessages(selectedConvo.conversationId, nextCursor, true);
  }, [selectedConvo, nextCursor, loadingMore, fetchMessages]);

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

  // ------ Real-time: join channel stream so we receive reaction_update / new_message (and receiver gets our reactions via backend)
  const wsUrl = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_NAKAMA_WS_URL : undefined;
  useEffect(() => {
    if (!selectedConvo?.conversationId || !wsUrl) return;
    let socket: ReturnType<Client['createSocket']> | null = null;
    let client: Client | null = null;
    const channelId = selectedConvo.conversationId;

    const applyReactionUpdate = (json: { messageId?: string; emoji?: string; userId?: string; action?: string }) => {
      const { messageId, emoji, userId, action } = json;
      if (!messageId || !emoji || !userId || !action) return;
      setMessages(prev => prev.map(msg => {
        if (msg.messageId !== messageId) return msg;
        const reactions: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(msg.reactions || {})) {
          let list = (v || []).filter(id => id !== userId);
          if (k === emoji && action === 'added') list = [...list, userId];
          if (list.length > 0) reactions[k] = list;
        }
        if (action === 'added' && !reactions[emoji]?.includes(userId)) {
          reactions[emoji] = [...(reactions[emoji] || []), userId];
        }
        return { ...msg, reactions: Object.keys(reactions).length ? reactions : undefined };
      }));
    };

    const handlePayload = (content: string | object) => {
      try {
        const json = typeof content === 'string' ? JSON.parse(content) : content;
        const msgChannelId = json.channelId;
        const isForThisChannel = !msgChannelId || msgChannelId === channelId;

        switch (json.type) {
          case 'reaction_update':
            if (isForThisChannel) applyReactionUpdate(json);
            break;
          case 'new_message':
            if (isForThisChannel) fetchMessages(channelId);
            break;
          case 'presence_update':
            if (isForThisChannel && json.userId) {
              const isOnline = !!json.isOnline;
              const lastSeenAt = typeof json.lastSeenAt === 'number' ? json.lastSeenAt : 0;
              setConversations(prev => prev.map(c =>
                c.userId === json.userId ? { ...c, isOnline, lastSeenAt } : c
              ));
              setSelectedConvo(prev => prev && prev.userId === json.userId
                ? { ...prev, isOnline, lastSeenAt }
                : prev);
            }
            break;
          default:
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    (async () => {
      try {
        const res = await fetch('/api/admin/socket-token', { credentials: 'include' });
        if (!res.ok) return;
        const { token } = (await res.json()) as { token?: string };
        if (!token) return;
        const url = new URL(wsUrl);
        const useSsl = url.protocol === 'wss:';
        const port = url.port ? parseInt(url.port, 10) : (useSsl ? 443 : 80);
        client = new Client('defaultkey', url.hostname, port.toString(), useSsl);
        const session = Session.restore(token, '');
        socket = client.createSocket(useSsl);
        socket.onstreamdata = (streamData) => handlePayload(streamData.data);
        socket.onnotification = (notification) => {
          if (notification.content) handlePayload(notification.content as object);
        };
        await socket.connect(session, false);
        await callAdminRpc('chat/join_stream', JSON.stringify({ channelId }));
      } catch (err) {
        console.warn('Bot chat real-time: socket/join failed', err);
      }
    })();

    return () => {
      (async () => {
        try {
          if (socket) await callAdminRpc('chat/leave_stream', JSON.stringify({ channelId }));
        } catch {
          // ignore
        }
      })();
      if (socket) socket.disconnect(false);
      socket = null;
      client = null;
    };
  }, [selectedConvo?.conversationId, wsUrl, fetchMessages]);

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

  // Position reaction picker above the anchor button (so it's not clipped by overflow)
  useLayoutEffect(() => {
    if (!reactionPickerFor || !reactionPickerAnchorRef.current) {
      setPickerPosition(null);
      return;
    }
    const rect = reactionPickerAnchorRef.current.getBoundingClientRect();
    const pickerHeight = 64;
    const gap = 6;
    setPickerPosition({
      left: Math.max(8, Math.min(rect.left, typeof window !== 'undefined' ? window.innerWidth - 220 : rect.left)),
      top: rect.top - pickerHeight - gap,
    });
  }, [reactionPickerFor]);

  // ------ Actions ------

  const handleSend = async () => {
    if (!selectedConvo || !newMessage.trim() || sending) return;
    const content = newMessage.trim();
    setNewMessage('');
    setError(null);

    // Optimistic message (same shape as ChatMessage; will be replaced on success)
    const tempId = `temp-${Date.now()}`;
    const now = Math.floor(Date.now() / 1000);
    const optimistic: ChatMessage = {
      messageId: tempId,
      channelId: selectedConvo.conversationId,
      senderId: selectedConvo.botId,
      senderName: selectedConvo.botName,
      content,
      messageType: 'text',
      status: 'pending',
      isEdited: false,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    setMessages(prev => [...prev, optimistic]);
    scrollToBottom();
    setSending(true);

    try {
      await callAdminRpc('admin/send_message_as_fake_user', JSON.stringify({
        fakeUserId: selectedConvo.botId,
        channelId: selectedConvo.conversationId,
        content,
        ...(replyingTo ? { replyToId: replyingTo.messageId } : {}),
      }));
      // Replace optimistic with server state
      await fetchMessages(selectedConvo.conversationId);
      setReplyingTo(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      setError(msg);
      setMessages(prev => prev.filter(m => m.messageId !== tempId));
      setNewMessage(content);
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

  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!selectedConvo) return;
    setReactionPickerFor(null);
    try {
      await callAdminRpc('chat/add_reaction', JSON.stringify({
        channelId: selectedConvo.conversationId,
        messageId,
        emoji,
      }));
      await fetchMessages(selectedConvo.conversationId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update reaction';
      setError(msg);
    }
  }, [selectedConvo, fetchMessages]);

  const handleSendMedia = useCallback(async (files: FileList | null) => {
    if (!selectedConvo || !files || files.length === 0 || sending) return;
    setError(null);
    setSending(true);
    try {
      const filesList = Array.from(files);
      const res = await callAdminRpc('social/upload_media', JSON.stringify({
        context: 'chat',
        files: filesList.map(f => ({
          fileName: f.name,
          contentType: f.type || 'application/octet-stream',
        })),
      }));
      const uploads =
        (res.data as { uploads?: { uploadUrl: string; key: string; mediaUrl: string }[] } | undefined)?.uploads ??
        (res as { uploads?: { uploadUrl: string; key: string; mediaUrl: string }[] }).uploads ??
        [];
      if (uploads.length !== filesList.length) {
        throw new Error('Upload slots count mismatch');
      }
      for (let i = 0; i < uploads.length; i++) {
        const { uploadUrl } = uploads[i];
        const file = filesList[i];
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
        if (!putRes.ok) {
          throw new Error(`Upload failed: ${putRes.status}`);
        }
      }
      const keys = uploads.map(u => u.key);
      await callAdminRpc('admin/send_message_as_fake_user', JSON.stringify({
        fakeUserId: selectedConvo.botId,
        channelId: selectedConvo.conversationId,
        content: newMessage.trim() || undefined,
        keys,
        ...(replyingTo ? { replyToId: replyingTo.messageId } : {}),
      }));
      setNewMessage('');
      setReplyingTo(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchMessages(selectedConvo.conversationId);
      scrollToBottom();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send media';
      setError(msg);
    } finally {
      setSending(false);
    }
  }, [selectedConvo, newMessage, replyingTo, sending, fetchMessages, scrollToBottom]);

  const selectConversation = (convo: Conversation) => {
    setSelectedConvo(convo);
    setMessages([]);
    setNextCursor(null);
    setReplyingTo(null);
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

      {/* Reaction picker (portal so it is not clipped by overflow) */}
      {typeof document !== 'undefined' && reactionPickerFor && pickerPosition && createPortal(
        <div className="fixed inset-0 z-[10]" aria-hidden={false}>
          <div
            className="absolute w-full h-full"
            onClick={() => { setReactionPickerFor(null); setPickerPosition(null); }}
          />
          <div
            className="absolute flex flex-col gap-0.5 p-2 bg-slate-800 border border-slate-600 rounded-xl shadow-xl z-20 max-w-[200px]"
            style={{ left: pickerPosition.left, top: pickerPosition.top }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-4 gap-0.5">
              {REACTION_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="text-xl hover:scale-110 active:scale-95 transition-transform p-1.5 rounded hover:bg-slate-700"
                  onClick={() => {
                    handleReaction(reactionPickerFor, e);
                    setReactionPickerFor(null);
                    setPickerPosition(null);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
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
                <>
                  {nextCursor && (
                    <div className="flex justify-center mb-3">
                      <button
                        type="button"
                        onClick={loadMoreMessages}
                        disabled={loadingMore}
                        className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 rounded-lg transition"
                      >
                        {loadingMore ? 'Loading...' : 'Load older messages'}
                      </button>
                    </div>
                  )}
                  {messageGroups.map((group, gi) => (
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
                              <button
                                type="button"
                                onClick={() => setReplyingTo(msg)}
                                className={`text-[10px] ml-1 opacity-70 hover:opacity-100 underline ${isFakeUser ? 'text-indigo-200' : 'text-slate-500'}`}
                              >
                                Reply
                              </button>
                              <div className="relative ml-1">
                                <button
                                  ref={(el) => { if (reactionPickerFor === msg.messageId) reactionPickerAnchorRef.current = el; }}
                                  type="button"
                                  onClick={(e) => {
                                    reactionPickerAnchorRef.current = e.currentTarget;
                                    setReactionPickerFor(prev => prev === msg.messageId ? null : msg.messageId);
                                  }}
                                  className={`text-[10px] p-0.5 rounded opacity-70 hover:opacity-100 ${isFakeUser ? 'text-indigo-200' : 'text-slate-500'}`}
                                  title="React"
                                >
                                  <Smile className="w-3.5 h-3.5 inline" />
                                </button>
                              </div>
                            </div>
                            {/* Reaction pills - horizontal scroll when many so layout does not break */}
                            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                              <div className="flex gap-1 mt-1 overflow-x-auto overflow-y-hidden max-w-full min-h-0">
                                {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleReaction(msg.messageId, emoji)}
                                    className={`text-xs px-1.5 py-0.5 rounded-full border shrink-0 ${
                                      isFakeUser ? 'bg-indigo-700/50 border-indigo-500/50' : 'bg-slate-700/50 border-slate-600'
                                    } hover:opacity-90`}
                                    title={`${emoji} ${userIds.length}`}
                                  >
                                    {emoji} {userIds.length > 1 ? userIds.length : ''}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  ))}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-5 py-3 border-t border-slate-700 bg-slate-900/80">
              {replyingTo && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-400">Replying to {replyingTo.displayName || replyingTo.senderName}</p>
                    <p className="text-xs text-slate-500 truncate">{replyingTo.content || 'Media'}</p>
                  </div>
                  <button type="button" onClick={() => setReplyingTo(null)} className="text-slate-500 hover:text-slate-300 text-sm">Cancel</button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                  multiple
                  className="hidden"
                  onChange={e => {
                    const files = e.target.files;
                    if (files?.length) handleSendMedia(files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  className="p-2.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-xl transition shrink-0 disabled:opacity-50"
                  title="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <div className="flex-1 relative">
                  <textarea
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={replyingTo ? `Reply as ${selectedConvo.botName}...` : `Reply as ${selectedConvo.botName}...`}
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
