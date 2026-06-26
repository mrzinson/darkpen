"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  status?: 'thinking' | 'streaming' | 'complete' | 'generating_image';
  image?: string;
  images?: string[];
  timestamp?: string;
  showBillingButton?: boolean;
}

interface Attachment {
  uri: string;
  base64: string;
  mimeType: string;
  name: string;
}

interface ChatViewProps {
  onOpenSidebar: () => void;
  onOpenGroups: () => void;
  onBack?: () => void;
}

// Simple markdown formatter
function renderMarkdown(text: string) {
  if (!text) return '';

  // 1. Process <table_data>...</table_data> blocks FIRST (before any line splitting)
  let processed = text.replace(/<table_data>([\s\S]*?)<\/table_data>/gi, (match, inner) => {
    const rows = inner.trim().split('\n').filter((r: string) => r.trim() !== '');
    if (rows.length === 0) return '';
    const tableRows = rows.map((row: string, rIdx: number) => {
      const cols = row.split('|');
      const isHeader = rIdx === 0;
      const cells = cols.map((col: string, cIdx: number) => {
        const cellClass = isHeader
          ? 'px-3 py-2 text-xs font-bold text-left text-white bg-[#1e293b] border-r border-white/10 last:border-r-0'
          : cIdx === 0
            ? 'px-3 py-2 text-xs font-semibold text-left text-[#10B981] border-r border-gray-700/40 last:border-r-0'
            : 'px-3 py-2 text-xs text-left text-gray-200 border-r border-gray-700/40 last:border-r-0';
        return `<td class="${cellClass}">${col.trim()}</td>`;
      }).join('');
      const rowClass = isHeader
        ? ''
        : rIdx % 2 === 0
          ? 'bg-[#0f172a]/60'
          : 'bg-[#1e293b]/40';
      return `<tr class="${rowClass} border-b border-gray-700/30 last:border-b-0">${cells}</tr>`;
    }).join('');
    return `<div class="my-3 rounded-xl overflow-hidden border border-gray-700/50 shadow-sm"><table class="w-full border-collapse text-sm">${tableRows}</table></div>`;
  });

  // 2. Apply inline formatting (green/red tags, code blocks, bold, inline code)
  let out = processed
    .replace(/<green>(.*?)<\/green>/gi, '<span class="text-[#10B981] dark:text-[#34D399] font-bold">$1</span>')
    .replace(/<red>(.*?)<\/red>/gi, '<span class="text-[#EF4444] dark:text-[#F87171] font-bold">$1</span>')
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-900/70 rounded-xl p-3 my-2 text-xs font-mono text-green-300 overflow-x-auto leading-relaxed">$1</pre>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-800/60 px-1.5 py-0.5 rounded text-xs font-mono text-blue-300">$1</code>');

  // 3. Process line by line (but skip already-rendered HTML blocks)
  const lines = out.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('- ') || t.startsWith('* ')) {
      result.push(`<div class="flex gap-2 my-0.5"><span class="text-blue-400 mt-0.5 shrink-0">•</span><span>${t.substring(2)}</span></div>`);
    } else if (t === '') {
      result.push('<div class="h-2"></div>');
    } else {
      result.push(`<div>${line}</div>`);
    }
  }
  return result.join('');
}


export default function ChatView({ onOpenSidebar, onOpenGroups, onBack }: ChatViewProps) {
  const { language } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('Thinking...');
  const [sessionId, setSessionId] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeXhr = useRef<XMLHttpRequest | null>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const hasUserSentImage = (aiMsgId: string) => {
    const idx = messages.findIndex(m => m.id === aiMsgId);
    if (idx > 0) {
      const prevMsg = messages[idx - 1];
      return !!(prevMsg && prevMsg.sender === 'user' && prevMsg.images && prevMsg.images.length > 0);
    }
    return false;
  };

  useEffect(() => { scrollToBottom(); }, [messages, isAiTyping]);

  useEffect(() => {
    let uId = 'guest';
    const cachedUser = localStorage.getItem('userData');
    if (cachedUser) { try { const u = JSON.parse(cachedUser); if (u.id) uId = u.id.toString(); } catch {} }

    let activeSession = localStorage.getItem(`active_session_id_${uId}`);
    if (!activeSession) {
      activeSession = `chat_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      localStorage.setItem(`active_session_id_${uId}`, activeSession);
    }
    setSessionId(activeSession);

    const initialText = language === 'so'
      ? 'Kusoo dhawoow! Anigu waxaan ahay caawiyahaaga AI. Sidee baan kuu caawin karaa maanta?'
      : 'Welcome! I am your AI assistant. How can I help you today?';

    const cachedHistory = localStorage.getItem(`education_chat_messages_${uId}`);
    if (cachedHistory) {
      try {
        const parsed = JSON.parse(cachedHistory);
        if (Array.isArray(parsed) && parsed.length > 0) { setMessages(parsed); }
        else { setMessages([{ id: '1', text: initialText, sender: 'ai', timestamp: new Date().toISOString() }]); }
      } catch { setMessages([{ id: '1', text: initialText, sender: 'ai', timestamp: new Date().toISOString() }]); }
    } else {
      setMessages([{ id: '1', text: initialText, sender: 'ai', timestamp: new Date().toISOString() }]);
    }

    const syncHistory = async () => {
      const token = localStorage.getItem('userToken');
      if (!token || !activeSession) return;
      try {
        const res = await fetch(`https://darkpen-backend.onrender.com/api/chat/history/${activeSession}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
            const mapped: Message[] = data.messages.map((m: any) => ({
              id: m.id.toString(),
              text: m.message || m.text || '',
              sender: m.sender,
              image: m.image ? (m.image.startsWith('http') ? m.image : `https://darkpen-backend.onrender.com${m.image}`) : undefined,
              timestamp: m.created_at || new Date().toISOString()
            }));
            setMessages(mapped);
            localStorage.setItem(`education_chat_messages_${uId}`, JSON.stringify(mapped));
          }
        }
      } catch {}
    };
    syncHistory();
    fetchCredits();
    return () => { if (activeXhr.current) activeXhr.current.abort(); };
  }, [language]);

  const fetchCredits = async () => {
    const token = localStorage.getItem('userToken');
    if (!token) return;
    try {
      const res = await fetch('https://darkpen-backend.onrender.com/api/user/profile', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.user) setCredits(data.user.balance || 0);
    } catch {}
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (attachments.length >= 5) { alert('Max 5 images'); return; }
    const file = files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      setAttachments(prev => [...prev, { uri: URL.createObjectURL(file), base64: base64String, mimeType: file.type, name: file.name }]);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        setIsTranscribing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp4' });
        const file = new File([audioBlob], 'voice_note.m4a', { type: 'audio/mp4' });
        const token = localStorage.getItem('userToken');
        const formData = new FormData();
        formData.append('audio', file);
        try {
          const res = await fetch('https://darkpen-backend.onrender.com/api/chat/voice', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
          const data = await res.json();
          if (res.ok && data.text) setInputText(data.text);
          else alert('Cilad: Lama fahmin codkaaga.');
        } catch { alert('Cilad cod dirista ah.'); }
        finally { setIsTranscribing(false); }
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch { alert('Fadlan ogolow makarafoonka browser-ka.'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && attachments.length === 0) || isAiTyping) return;

    const userText = inputText.trim();
    const currentAttachments = [...attachments];
    setInputText('');
    setAttachments([]);
    setIsAiTyping(true);

    // Build user message with image URIs for immediate display
    const imageUris = currentAttachments.map(a => a.uri);
    const newUserMsg: Message = {
      id: Date.now().toString(),
      text: userText,
      sender: 'user',
      images: imageUris.length > 0 ? imageUris : undefined,
      timestamp: new Date().toISOString()
    };

    const aiMsgId = (Date.now() + 1).toString();
    const newAiMsg: Message = { id: aiMsgId, text: '', sender: 'ai', status: 'thinking', timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, newUserMsg, newAiMsg]);
    setThinkingStatus('Thinking...');

    try {
      const token = localStorage.getItem('userToken');
      if (!token) {
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: 'Fadlan gal akoonkaaga ka hor.', status: 'complete' } : m));
        setIsAiTyping(false);
        return;
      }

      const sendRequest = (isRetry = false) => {
        if (isRetry) setThinkingStatus('Server-ka ayaa bilaabmaya, sabar yar...');
        const xhr = new XMLHttpRequest();
        activeXhr.current = xhr;
        xhr.open('POST', 'https://darkpen-backend.onrender.com/api/chat/ask');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        let accumulatedText = '';
        let offset = 0;

        xhr.onreadystatechange = () => {
          if (xhr.readyState === 3 || xhr.readyState === 4) {
            const chunk = xhr.responseText.substring(offset);
            offset = xhr.responseText.length;

            if (chunk) {
              for (const line of chunk.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data: ')) continue;
                const dataStr = trimmed.slice(6).trim();
                if (dataStr === '[DONE]') break;
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.status === 'reading_books') {
                    setThinkingStatus('Reading books...');
                  } else if (parsed.status === 'thinking') {
                    setThinkingStatus('Thinking...');
                  } else if (parsed.status === 'generating_image') {
                    setThinkingStatus('Generating image...');
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, status: 'generating_image' } : m));
                  } else if (parsed.error) {
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: parsed.text || 'Cilad.', status: 'complete' } : m));
                    break;
                  } else if (parsed.text || parsed.image) {
                    // ── INSTANT STREAMING: update on every chunk ──
                    if (parsed.text) accumulatedText += parsed.text;
                    const imageUrl = parsed.image
                      ? (parsed.image.startsWith('http') ? parsed.image : `https://darkpen-backend.onrender.com${parsed.image}`)
                      : undefined;
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? {
                      ...m,
                      text: accumulatedText,
                      image: imageUrl || m.image,
                      status: parsed.status === 'complete' ? 'complete' : 'streaming'
                    } : m));
                  }
                } catch {}
              }
            }

            if (xhr.readyState === 4) {
              activeXhr.current = null;
              if (xhr.status >= 400) {
                let errText = 'Cilad ayaa ku dhacday. Fadlan mar kale isku day.';
                try { const j = JSON.parse(xhr.responseText); errText = j.message || errText; } catch {}
                setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: errText, status: 'complete' } : m));
                setIsAiTyping(false);
              } else if (!accumulatedText && !isRetry) {
                setThinkingStatus('Server-ka ayaa toosaya, sabar yar...');
                setTimeout(() => sendRequest(true), 3000);
              } else {
                setMessages(prev => prev.map(m => m.id === aiMsgId ? {
                  ...m,
                  text: accumulatedText || 'Server-ka wuu toosay, mar kale weydii.',
                  status: 'complete'
                } : m));
                fetchCredits();
                setIsAiTyping(false);
              }
            }
          }
        };

        xhr.send(JSON.stringify({
          message: userText,
          chatType: 'education',
          stream: true,
          sessionId: sessionId,
          attachment: currentAttachments.length > 0
            ? currentAttachments.map(att => ({ base64: att.base64, mimeType: att.mimeType, name: att.name }))
            : null
        }));
      };

      sendRequest();

    } catch {
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: 'Cilad dhinaca internet-ka ah.', status: 'complete' } : m));
      setIsAiTyping(false);
    }
  };

  const confirmClearHistory = async () => {
    if (!window.confirm(language === 'so' ? 'Ma hubtaa inaad tirtirto taariikhda wada-hadalka?' : 'Clear chat history?')) return;
    const token = localStorage.getItem('userToken');
    try {
      const res = await fetch('https://darkpen-backend.onrender.com/api/chat/history/clear', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId })
      });
      if (res.ok) {
        setMessages([]);
        let uId = 'guest';
        try { const u = JSON.parse(localStorage.getItem('userData') || '{}'); if (u.id) uId = u.id.toString(); } catch {}
        localStorage.removeItem(`education_chat_messages_${uId}`);
        const newSession = `chat_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        let uId2 = 'guest';
        try { const u = JSON.parse(localStorage.getItem('userData') || '{}'); if (u.id) uId2 = u.id.toString(); } catch {}
        localStorage.setItem(`active_session_id_${uId2}`, newSession);
        setSessionId(newSession);
      }
    } catch { alert('Tirtiriddu waa fashilantay.'); }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-white dark:bg-[#0D1117] relative select-none overflow-hidden">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-[#161B22] border-b border-gray-200 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          {/* Back button */}
          <button
            onClick={onBack || onOpenSidebar}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-250 dark:bg-gray-800 dark:hover:bg-gray-700 text-blue-500 transition-all active:scale-95 shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>

          {/* Partner Avatar, Name & Online Status */}
          <div className="flex items-center gap-2.5">
            {/* Avatar wrapper */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-extrabold text-sm shadow-inner select-none">
                DP
              </div>
              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-[#161B22] animate-pulse" />
            </div>
            {/* Name and Status text */}
            <div className="flex flex-col">
              <span className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight">Darkpen AI</span>
              <span className="text-[10px] text-green-500 font-medium">Online</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={confirmClearHistory}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-250 dark:bg-gray-800 dark:hover:bg-gray-700 text-red-400 transition-all active:scale-95 shrink-0"
            title={language === 'so' ? 'Tirtir Taariikhda' : 'Clear History'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 9m-4.72 0-.34-9m9.96-3.24-.66.12M18 6H5.25M9.75 3h4.5" />
            </svg>
          </button>
          <button
            onClick={onOpenGroups}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-250 dark:bg-gray-800 dark:hover:bg-gray-700 text-blue-500 transition-all active:scale-95 shrink-0"
            title={language === 'so' ? 'Kooxaha' : 'Groups'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
          </button>
          <button
            onClick={onOpenSidebar}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-250 dark:bg-gray-800 dark:hover:bg-gray-700 text-blue-500 transition-all active:scale-95 shrink-0"
            title={language === 'so' ? 'Menu-ga' : 'Menu'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── MESSAGES ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-white dark:bg-[#0D1117]">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>

              {/* User bubble */}
              {isUser ? (
                <div className="max-w-[78%] flex flex-col items-end gap-1.5">
                  {/* Images attached by user */}
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {msg.images.map((uri, i) => (
                        <div key={i} className="w-[140px] h-[140px] rounded-2xl overflow-hidden border-2 border-blue-500/30 shadow-md">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={uri}
                            alt="attachment"
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => window.open(uri, '_blank')}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Text */}
                  {msg.text && (
                    <div className="bg-[#0084FF] text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
                      {msg.text}
                    </div>
                  )}
                </div>

              ) : (
                /* AI bubble — NO border, NO avatar, plain text */
                <div className="max-w-[84%] flex flex-col items-start gap-1.5">
                  {/* Thinking dots or Blurry Reading Books Box */}
                  {msg.status === 'thinking' && (
                    hasUserSentImage(msg.id) ? (
                      <div className="flex flex-col gap-3 w-full min-w-[260px] max-w-[320px] bg-gray-100/60 dark:bg-gray-800/40 backdrop-blur-md rounded-2xl p-4 border border-gray-200/50 dark:border-gray-800/60 animate-pulse shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-gray-200/80 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 animate-spin">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                            </svg>
                          </div>
                          <span className="text-xs text-gray-600 dark:text-gray-300 font-extrabold tracking-wide">Reading books...</span>
                        </div>
                        <div className="space-y-2 mt-1">
                          <div className="h-2 bg-gray-300/70 dark:bg-gray-700/60 rounded w-full" />
                          <div className="h-2 bg-gray-300/70 dark:bg-gray-700/60 rounded w-5/6" />
                          <div className="h-2 bg-gray-300/70 dark:bg-gray-700/60 rounded w-2/3" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-1 py-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{animationDelay:'0ms'}}></span>
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{animationDelay:'150ms'}}></span>
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{animationDelay:'300ms'}}></span>
                        <span className="text-xs text-gray-400 font-medium ml-1">{thinkingStatus}</span>
                      </div>
                    )
                  )}

                  {/* Generating image skeleton */}
                  {msg.status === 'generating_image' && !msg.text && (
                    <div className="flex flex-col gap-2">
                      <div className="w-[200px] h-[150px] bg-gray-200 dark:bg-gray-800 animate-pulse rounded-2xl" />
                      <span className="text-xs text-gray-400 font-medium">{thinkingStatus}</span>
                    </div>
                  )}

                  {/* AI text — no box, no border */}
                  {msg.text && msg.status !== 'thinking' && (
                    <div
                      className="text-sm leading-relaxed text-gray-800 dark:text-gray-100 select-text"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                    />
                  )}

                  {/* AI generated image */}
                  {msg.image && (
                    <div className="mt-1 rounded-2xl overflow-hidden max-w-[240px] shadow-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={msg.image}
                        alt="AI Generation"
                        className="w-full h-auto cursor-pointer"
                        onClick={() => window.open(msg.image, '_blank')}
                      />
                    </div>
                  )}

                  {/* Copy button */}
                  {msg.text && msg.status !== 'thinking' && (
                    <button
                      onClick={() => handleCopy(msg.text)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 text-[10px] font-semibold transition-all active:scale-95 mt-0.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                      </svg>
                      Copy
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ── INPUT PANEL ── */}
      <div className="shrink-0 px-4 pb-4 pt-3 bg-white dark:bg-[#161B22] border-t border-gray-200 dark:border-gray-800">

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {attachments.map((att, idx) => (
              <div key={idx} className="relative w-14 h-14 rounded-xl border-2 border-blue-500/30 overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={att.uri} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => deleteAttachment(idx)}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-2.5 h-2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-2">
          {/* Attach */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-blue-500 active:scale-95 transition-all shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />

          {/* Text input */}
          <input
            type="text"
            placeholder={isTranscribing ? 'Cod la qoraynayaa...' : (language === 'so' ? "Su'aal halkan ku qor..." : 'Ask a question here...')}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isAiTyping || isTranscribing}
            className="flex-1 min-w-0 bg-gray-50 dark:bg-[#0D1117] border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
          />

          {/* Mic / Send */}
          {inputText.trim() === '' && attachments.length === 0 ? (
            <button
              type="button"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow border transition-all shrink-0 ${isRecording ? 'bg-red-500 text-white animate-pulse border-red-600' : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-blue-500 active:scale-95'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={isAiTyping}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white shadow transition-all active:scale-95 shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </button>
          )}
        </form>
      </div>

    </div>
  );
}
