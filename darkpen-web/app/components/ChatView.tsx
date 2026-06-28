"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

/* ─────────────────── types ─────────────────── */
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  status?: 'thinking' | 'streaming' | 'complete' | 'generating_image';
  image?: string;
  images?: string[];   // base64 data-URLs
  timestamp?: string;
}

interface Attachment {
  dataUrl: string;
  base64: string;
  mimeType: string;
  name: string;
}

interface ChatViewProps {
  onOpenLeftSidebar: () => void;
  onOpenNavPanel:    () => void;
  onBack?:           () => void;
}

/* ─────────────────── markdown renderer ─────────────────── */
function ensureTableTags(text: string): string {
  if (!text) return text;
  let cleaned = text.replace(/<\/?table_data>/gi, '');
  const lines = cleaned.split('\n');
  const out: string[] = [];
  let cur: string[] = [];

  const isTableLine = (l: string) => {
    const t = l.trim();
    return t.includes('|') && !t.startsWith('```') && !t.startsWith('<');
  };
  const isRealTable = (block: string[]) => {
    if (block.length < 2) return false;
    const first = block[0].split('|').length - 1;
    return first >= 1 && block.every(l => (l.split('|').length - 1) === first && l.length < 180);
  };

  for (const line of lines) {
    if (isTableLine(line)) { cur.push(line); }
    else {
      if (cur.length) {
        if (isRealTable(cur)) { out.push('<table_data>', ...cur, '</table_data>'); }
        else out.push(...cur);
        cur = [];
      }
      out.push(line);
    }
  }
  if (cur.length) {
    if (isRealTable(cur)) out.push('<table_data>', ...cur, '</table_data>');
    else out.push(...cur);
  }
  return out.join('\n');
}

function renderMarkdown(text: string): string {
  if (!text) return '';
  const tagged = ensureTableTags(text);

  let processed = tagged.replace(/<table_data>([\s\S]*?)<\/table_data>/gi, (_, inner) => {
    const rows = inner.trim().split('\n').filter((r: string) => r.trim());
    if (!rows.length) return '';
    const tableRows = rows.map((row: string, rIdx: number) => {
      let clean = row.trim();
      if (clean.startsWith('|')) clean = clean.slice(1);
      if (clean.endsWith('|'))   clean = clean.slice(0, -1);
      const cols = clean.split('|');
      const isH = rIdx === 0;
      const cells = cols.map((col: string, cIdx: number) => {
        const cls = isH
          ? 'px-3 py-2 text-xs font-bold text-left text-white bg-white/10 border-r border-white/10 last:border-r-0'
          : cIdx === 0
            ? 'px-3 py-2 text-xs font-semibold text-left text-blue-400 border-r border-white/8 last:border-r-0'
            : 'px-3 py-2 text-xs text-left text-white/80 border-r border-white/8 last:border-r-0';
        return `<td class="${cls}">${col.trim()}</td>`;
      }).join('');
      const rowCls = isH ? '' : rIdx % 2 === 0 ? 'bg-white/4' : 'bg-white/2';
      return `<tr class="${rowCls} border-b border-white/8 last:border-b-0">${cells}</tr>`;
    }).join('');
    return `<div class="my-3 rounded-xl overflow-hidden border border-white/12 shadow-sm"><table class="w-full border-collapse">${tableRows}</table></div>`;
  });

  let out = processed
    .replace(/<green>(.*?)<\/green>/gi, '<span class="text-blue-400 font-bold">$1</span>')
    .replace(/<red>(.*?)<\/red>/gi,     '<span class="text-rose-400 font-bold">$1</span>')
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-black/40 rounded-xl p-3 my-2 text-xs font-mono text-blue-300 overflow-x-auto leading-relaxed border border-white/8">$1</pre>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-blue-350">$1</code>');

  const lines = out.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('- ') || t.startsWith('* '))
      result.push(`<div class="flex gap-2 my-0.5"><span class="text-blue-400 mt-0.5 shrink-0">•</span><span>${t.slice(2)}</span></div>`);
    else if (t === '')
      result.push('<div class="h-1.5"></div>');
    else
      result.push(`<div>${line}</div>`);
  }
  return result.join('');
}

/* ─────────────────── empty state (clean black & white) ─────────────────── */
const EmptyState = ({ language }: { language: string }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
    <div className="text-center px-6 dp-float">
      <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-white/5 border border-white/10" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
        <span className="text-white font-black text-sm">DP</span>
      </div>
      <p className="text-white/80 text-base font-bold tracking-wide mt-4">Darkpen AI</p>
      <p className="text-white/30 text-xs mt-1.5">
        {language === 'so' ? 'Wax i weydii, kaa caawin doonaa…' : 'Ask me anything, I\'m ready to help…'}
      </p>
    </div>
  </div>
);

/* ─────────────────── icon helpers ─────────────────── */
const IconSend = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
  </svg>
);
const IconMic = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
  </svg>
);
const IconCamera = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
  </svg>
);
const IconGallery = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
  </svg>
);
const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-400">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const IconHamburger = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#10B981" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);
const IconNav = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-400">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
  </svg>
);
const IconCopy = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
  </svg>
);

/* ─────────────────── main component ─────────────────── */
export default function ChatView({ onOpenLeftSidebar, onOpenNavPanel, onBack }: ChatViewProps) {
  const { language } = useTheme();
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [inputText,      setInputText]      = useState('');
  const [isAiTyping,     setIsAiTyping]     = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('Thinking…');
  const [sessionId,      setSessionId]      = useState('');
  const [attachments,    setAttachments]    = useState<Attachment[]>([]);
  const [credits,        setCredits]        = useState<number | null>(null);
  const [isRecording,    setIsRecording]    = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [copiedId,       setCopiedId]       = useState<string | null>(null);

  const cameraRef    = useRef<HTMLInputElement>(null);
  const galleryRef   = useRef<HTMLInputElement>(null);
  const messagesEnd  = useRef<HTMLDivElement>(null);
  const mediaRec     = useRef<MediaRecorder | null>(null);
  const audioChunks  = useRef<Blob[]>([]);
  const activeXhr    = useRef<XMLHttpRequest | null>(null);

  const scrollBottom = () => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollBottom(); }, [messages, isAiTyping]);

  /* ── load messages ── */
  useEffect(() => {
    let uId = 'guest';
    try { const u = JSON.parse(localStorage.getItem('userData') || '{}'); if (u.id) uId = String(u.id); } catch {}

    let sid = localStorage.getItem(`active_session_id_${uId}`);
    if (!sid) { sid = `chat_${Date.now()}_${Math.random().toString(36).slice(7)}`; localStorage.setItem(`active_session_id_${uId}`, sid); }
    setSessionId(sid);

    const welcome: Message = {
      id: '1',
      text: language === 'so'
        ? 'Kusoo dhawoow! Anigu waxaan ahay caawiyahaaga AI. Sidee baan kuu caawin karaa maanta?'
        : 'Welcome! I\'m your Darkpen AI assistant. How can I help you today?',
      sender: 'ai',
      status: 'complete',
      timestamp: new Date().toISOString(),
    };

    const cached = localStorage.getItem(`education_chat_messages_${uId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setMessages(Array.isArray(parsed) && parsed.length > 0 ? parsed : [welcome]);
      } catch { setMessages([welcome]); }
    } else { setMessages([welcome]); }

    // sync from backend
    (async () => {
      const token = localStorage.getItem('userToken');
      if (!token || !sid) return;
      try {
        const res = await fetch(`https://darkpen-backend.onrender.com/api/chat/history/${sid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.messages?.length) {
            const mapped: Message[] = data.messages.map((m: any) => ({
              id: String(m.id),
              text: m.message || m.text || '',
              sender: m.sender,
              image: m.image ? (m.image.startsWith('http') ? m.image : `https://darkpen-backend.onrender.com${m.image}`) : undefined,
              status: 'complete',
              timestamp: m.created_at || new Date().toISOString(),
            }));
            setMessages(mapped);
            localStorage.setItem(`education_chat_messages_${uId}`, JSON.stringify(mapped));
          }
        }
      } catch {}
    })();

    fetchCredits();
    return () => { if (activeXhr.current) activeXhr.current.abort(); };
  }, [language]); // eslint-disable-line

  const fetchCredits = async () => {
    const token = localStorage.getItem('userToken');
    if (!token) return;
    try {
      const res  = await fetch('https://darkpen-backend.onrender.com/api/user/profile', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.user) setCredits(data.user.balance || 0);
    } catch {}
  };

  /* ── image select ── */
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    if (attachments.length >= 5) { alert('Max 5 images'); return; }
    const file = files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl   = reader.result as string;
      const base64    = dataUrl.split(',')[1];
      setAttachments(prev => [...prev, { dataUrl, base64, mimeType: file.type, name: file.name }]);
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  /* ── recording ── */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRec.current   = mr;
      audioChunks.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunks.current.push(e.data); };
      mr.onstop = async () => {
        setIsTranscribing(true);
        const blob    = new Blob(audioChunks.current, { type: 'audio/mp4' });
        const file    = new File([blob], 'voice.m4a', { type: 'audio/mp4' });
        const token   = localStorage.getItem('userToken');
        const fd      = new FormData();
        fd.append('audio', file);
        try {
          const res  = await fetch('https://darkpen-backend.onrender.com/api/chat/voice', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
          const data = await res.json();
          if (res.ok && data.text) setInputText(data.text);
          else alert('Cilad: cod lama fahmin.');
        } catch { alert('Cilad cod dirista.'); }
        finally { setIsTranscribing(false); }
      };
      mr.start();
      setIsRecording(true);
    } catch { alert('Fadlan ogolow makarafoonka.'); }
  };
  const stopRecording = () => {
    if (mediaRec.current && isRecording) {
      mediaRec.current.stop();
      setIsRecording(false);
      mediaRec.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  /* ── send ── */
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !attachments.length) || isAiTyping) return;

    const userText   = inputText.trim();
    const curAttach  = [...attachments];
    setInputText('');
    setAttachments([]);
    setShowAttachMenu(false);
    setIsAiTyping(true);

    const userMsg: Message = {
      id:        Date.now().toString(),
      text:      userText,
      sender:    'user',
      images:    curAttach.length ? curAttach.map(a => a.dataUrl) : undefined,
      status:    'complete',
      timestamp: new Date().toISOString(),
    };
    const aiMsgId = (Date.now() + 1).toString();
    const aiMsg: Message = { id: aiMsgId, text: '', sender: 'ai', status: 'thinking', timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setThinkingStatus('Thinking…');

    const token = localStorage.getItem('userToken');
    if (!token) {
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: 'Fadlan gal akoonkaaga.', status: 'complete' } : m));
      setIsAiTyping(false);
      return;
    }

    const sendReq = (retry = false) => {
      if (retry) setThinkingStatus('Server-ka ayaa toosaya…');
      const xhr = new XMLHttpRequest();
      activeXhr.current = xhr;
      xhr.open('POST', 'https://darkpen-backend.onrender.com/api/chat/ask');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      let acc = '', offset = 0;
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 3 || xhr.readyState === 4) {
          const chunk = xhr.responseText.substring(offset);
          offset = xhr.responseText.length;
          if (chunk) {
            for (const line of chunk.split('\n')) {
              const tr = line.trim();
              if (!tr.startsWith('data: ')) continue;
              const ds = tr.slice(6).trim();
              if (ds === '[DONE]') break;
              try {
                const p = JSON.parse(ds);
                if (p.status === 'reading_books')      setThinkingStatus('Buugagga ka aqriyayaa…');
                else if (p.status === 'thinking')      setThinkingStatus('Fikiraya…');
                else if (p.status === 'generating_image') {
                  setThinkingStatus('Sawir la sameynayaa…');
                  setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, status: 'generating_image' } : m));
                } else if (p.error) {
                  setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: p.text || 'Cilad.', status: 'complete' } : m));
                } else if (p.text || p.image) {
                  if (p.text) acc += p.text;
                  const img = p.image ? (p.image.startsWith('http') ? p.image : `https://darkpen-backend.onrender.com${p.image}`) : undefined;
                  setMessages(prev => prev.map(m => m.id === aiMsgId ? {
                    ...m, text: acc, image: img || m.image,
                    status: p.status === 'complete' ? 'complete' : 'streaming',
                  } : m));
                }
              } catch {}
            }
          }
          if (xhr.readyState === 4) {
            activeXhr.current = null;
            if (xhr.status >= 400) {
              let msg = 'Cilad. Mar kale isku day.';
              try { msg = JSON.parse(xhr.responseText).message || msg; } catch {}
              setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: msg, status: 'complete' } : m));
            } else if (!acc && !retry) {
              setThinkingStatus('Server toosaya, sabar yar…');
              setTimeout(() => sendReq(true), 3000);
              return;
            } else {
              setMessages(prev => prev.map(m => m.id === aiMsgId ? {
                ...m, text: acc || 'Server wuu toosay, mar kale weydii.', status: 'complete',
              } : m));
              fetchCredits();
            }
            setIsAiTyping(false);
            // persist
            let uId = 'guest';
            try { const u = JSON.parse(localStorage.getItem('userData') || '{}'); if (u.id) uId = String(u.id); } catch {}
            setMessages(cur => { localStorage.setItem(`education_chat_messages_${uId}`, JSON.stringify(cur)); return cur; });
          }
        }
      };
      xhr.send(JSON.stringify({
        message: userText, chatType: 'education', stream: true, sessionId,
        attachment: curAttach.length ? curAttach.map(a => ({ base64: a.base64, mimeType: a.mimeType, name: a.name })) : null,
      }));
    };
    sendReq();
  };

  /* ── clear history ── */
  const clearHistory = async () => {
    if (!window.confirm(language === 'so' ? 'Taariikhda tirtirta?' : 'Clear chat history?')) return;
    const token = localStorage.getItem('userToken');
    try {
      const res = await fetch('https://darkpen-backend.onrender.com/api/chat/history/clear', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        setMessages([]);
        let uId = 'guest';
        try { const u = JSON.parse(localStorage.getItem('userData') || '{}'); if (u.id) uId = String(u.id); } catch {}
        localStorage.removeItem(`education_chat_messages_${uId}`);
        const ns = `chat_${Date.now()}_${Math.random().toString(36).slice(7)}`;
        localStorage.setItem(`active_session_id_${uId}`, ns);
        setSessionId(ns);
      }
    } catch { alert('Tirtiriddu waa fashilantay.'); }
  };

  /* ── copy ── */
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const isEmpty = messages.length === 0 || (messages.length === 1 && messages[0].sender === 'ai' && !isAiTyping);

  /* ─────── render ─────── */
  return (
    <div className="flex flex-col w-full h-full select-none overflow-hidden relative" style={{ background: '#090B10' }}>

      {/* ── HEADER (EXACTLY MATCHES MOCKUP 5) ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-[#0E1118]" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        
        {/* Left: circular hamburger button + pill name badge */}
        <div className="flex items-center gap-3">
          <button onClick={onOpenLeftSidebar} className="w-10 h-10 rounded-full flex items-center justify-center text-white/80 bg-white/5 border transition-all active:scale-95" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <IconHamburger />
          </button>
          
          {/* Pill name badge */}
          <div className="px-5 py-1.5 rounded-full bg-[#161B22] border flex items-center justify-center" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <span className="text-white font-bold text-sm tracking-wide select-none">Darkpen</span>
          </div>
        </div>

        {/* Right: combined pill containing: Trash | Settings */}
        <div className="flex items-center gap-3">
          {credits !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white/70 text-[10px] font-black border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
              {credits}
            </div>
          )}

          {/* Unified combined pill */}
          <div className="flex items-center rounded-full bg-white/5 border px-1 py-1" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <button onClick={clearHistory} className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-rose-400 hover:bg-white/5 transition-all active:scale-90" title="Clear history">
              <IconTrash />
            </button>
            <div className="w-[1px] h-4 bg-white/20 mx-1" />
            <button onClick={onOpenNavPanel} className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-blue-400 hover:bg-white/5 transition-all active:scale-90" title="Navigation">
              <IconNav />
            </button>
          </div>
        </div>
      </div>

      {/* ── MESSAGES ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 relative">
        {isEmpty && <EmptyState language={language} />}

        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div key={msg.id} className={`dp-fade-up flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              
              {isUser ? (
                /* USER bubble */
                <div className="max-w-[82%] flex flex-col items-end gap-2">
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-end">
                      {msg.images.map((src, i) => (
                        <div key={i} className="w-[130px] h-[130px] rounded-2xl overflow-hidden shadow-lg border" style={{ borderColor: 'rgba(0,132,255,0.3)' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="attachment" className="w-full h-full object-cover cursor-pointer transition-transform hover:scale-105" onClick={() => window.open(src, '_blank')} />
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.text && (
                    <div className="px-4 py-3 rounded-2xl rounded-tr-sm text-white text-sm leading-relaxed shadow-lg font-medium" style={{ background: '#0084FF', boxShadow: '0 4px 16px rgba(0,132,255,0.25)' }}>
                      {msg.text}
                    </div>
                  )}
                </div>

              ) : (
                /* AI bubble - bright white, clean */
                <div className="max-w-[88%] flex flex-col items-start gap-2">
                  
                  {msg.status === 'thinking' && (
                    <div className="flex items-center gap-2 px-2 py-2">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                      <span className="text-xs text-white/40 font-medium ml-1">{thinkingStatus}</span>
                    </div>
                  )}

                  {msg.status === 'generating_image' && !msg.image && (
                    <div className="flex flex-col gap-2">
                      <div className="w-[200px] h-[150px] rounded-2xl animate-pulse bg-white/5" />
                      <span className="text-xs text-white/40">{thinkingStatus}</span>
                    </div>
                  )}

                  {msg.text && msg.status !== 'thinking' && (
                    <div
                      className="text-sm leading-relaxed text-white/90 select-text font-medium"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                    />
                  )}

                  {msg.image && (
                    <div className="mt-1 rounded-2xl overflow-hidden shadow-lg max-w-[240px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={msg.image} alt="AI" className="w-full h-auto cursor-pointer" onClick={() => window.open(msg.image, '_blank')} />
                    </div>
                  )}

                  {msg.text && msg.status !== 'thinking' && (
                    <button onClick={() => handleCopy(msg.text, msg.id)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-white/30 hover:text-white/70 text-[10px] font-bold transition-all hover:bg-white/5 mt-0.5">
                      <IconCopy />
                      {copiedId === msg.id ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div ref={messagesEnd} />
      </div>

      {/* ── INPUT ── */}
      <div className="shrink-0 px-4 pb-5 pt-3 relative" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {attachments.map((att, idx) => (
              <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 shadow-md border" style={{ borderColor: 'rgba(0,132,255,0.3)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={att.dataUrl} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 flex items-center justify-center text-white text-[9px]">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Camera / Gallery popup */}
        {showAttachMenu && (
          <div className="absolute bottom-full mb-3 left-4 flex gap-3 dp-fade-up z-20">
            <button type="button" onClick={() => { cameraRef.current?.click(); setShowAttachMenu(false); }}
              className="flex flex-col items-center gap-2 px-5 py-3.5 rounded-2xl text-white text-xs font-bold transition-all hover:scale-105 active:scale-95"
              style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
              <IconCamera />
              <span>Camera</span>
            </button>
            <button type="button" onClick={() => { galleryRef.current?.click(); setShowAttachMenu(false); }}
              className="flex flex-col items-center gap-2 px-5 py-3.5 rounded-2xl text-white text-xs font-bold transition-all hover:scale-105 active:scale-95"
              style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
              <IconGallery />
              <span>Gallery</span>
            </button>
          </div>
        )}

        {/* Hidden file inputs */}
        <input type="file" accept="image/*" capture="environment" ref={cameraRef}  onChange={handleImageSelect} className="hidden" />
        <input type="file" accept="image/*"                        ref={galleryRef} onChange={handleImageSelect} className="hidden" />

        {/* Input row */}
        <form onSubmit={handleSend} className="flex items-center gap-2.5">

          {/* + button */}
          <button type="button" onClick={() => setShowAttachMenu(v => !v)}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-all ${showAttachMenu ? 'rotate-45 bg-blue-500/20 text-blue-400' : 'bg-white/5 hover:bg-white/10'}`}
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>

          {/* Text input */}
          <input
            type="text"
            placeholder={isTranscribing ? 'Cod la qoraynayaa…' : (language === 'so' ? 'Darkpen-ka weydii…' : 'Command Darkpen…')}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={isAiTyping || isTranscribing}
            className="flex-1 min-w-0 text-sm text-white placeholder-white/20 focus:outline-none bg-transparent"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '999px',
              padding: '10px 18px',
            }}
            onFocus={() => setShowAttachMenu(false)}
          />

          {/* Mic / Send */}
          {inputText.trim() === '' && !attachments.length ? (
            <button type="button"
              onMouseDown={startRecording} onMouseUp={stopRecording}
              onTouchStart={startRecording} onTouchEnd={stopRecording}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white/80 transition-all ${isRecording ? 'bg-rose-600 text-white scale-110' : 'bg-white/5 hover:bg-white/10'}`}
              style={{ border: `1px solid ${isRecording ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
              <IconMic />
            </button>
          ) : (
            <button type="submit" disabled={isAiTyping}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-40 hover:scale-105 active:scale-95"
              style={{ background: '#0084FF', border: '1px solid rgba(0,132,255,0.5)' }}>
              <IconSend />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
