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
  images?: string[];   // base64 data-URLs (persistent)
  timestamp?: string;
}

interface Attachment {
  dataUrl: string;   // full "data:image/jpeg;base64,..." for display
  base64: string;    // raw base64 for API
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
            ? 'px-3 py-2 text-xs font-semibold text-left text-purple-300 border-r border-white/8 last:border-r-0'
            : 'px-3 py-2 text-xs text-left text-white/80 border-r border-white/8 last:border-r-0';
        return `<td class="${cls}">${col.trim()}</td>`;
      }).join('');
      const rowCls = isH ? '' : rIdx % 2 === 0 ? 'bg-white/4' : 'bg-white/2';
      return `<tr class="${rowCls} border-b border-white/8 last:border-b-0">${cells}</tr>`;
    }).join('');
    return `<div class="my-3 rounded-xl overflow-hidden border border-white/12 shadow-sm"><table class="w-full border-collapse">${tableRows}</table></div>`;
  });

  let out = processed
    .replace(/<green>(.*?)<\/green>/gi, '<span class="text-emerald-400 font-bold">$1</span>')
    .replace(/<red>(.*?)<\/red>/gi,     '<span class="text-rose-400 font-bold">$1</span>')
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-black/40 rounded-xl p-3 my-2 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed border border-white/8">$1</pre>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-purple-300">$1</code>');

  const lines = out.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('- ') || t.startsWith('* '))
      result.push(`<div class="flex gap-2 my-0.5"><span class="text-purple-400 mt-0.5 shrink-0">•</span><span>${t.slice(2)}</span></div>`);
    else if (t === '')
      result.push('<div class="h-1.5"></div>');
    else
      result.push(`<div>${line}</div>`);
  }
  return result.join('');
}

/* ─────────────────── blob background ─────────────────── */
const BlobScene = () => (
  <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none select-none">
    <div className="relative" style={{ width: 300, height: 300 }}>
      {/* outer haze */}
      <div className="dp-blob-1 absolute" style={{
        inset: '-30px',
        background: 'radial-gradient(ellipse at 45% 45%, rgba(110,75,230,0.75) 0%, rgba(70,50,180,0.4) 45%, transparent 75%)',
        filter: 'blur(32px)',
      }} />
      {/* mid glow */}
      <div className="dp-blob-2 absolute" style={{
        inset: '0px',
        background: 'radial-gradient(ellipse at 55% 60%, rgba(90,65,210,0.65) 0%, rgba(55,38,150,0.3) 55%, transparent 80%)',
        filter: 'blur(40px)',
      }} />
      {/* core */}
      <div className="dp-blob-3 absolute" style={{
        inset: '50px',
        background: 'radial-gradient(ellipse at 35% 35%, rgba(170,140,255,0.8) 0%, rgba(120,90,230,0.4) 50%, transparent 80%)',
        filter: 'blur(20px)',
      }} />
      {/* specular */}
      <div className="dp-pulse-glow absolute" style={{
        inset: '85px',
        background: 'radial-gradient(ellipse at 30% 25%, rgba(220,200,255,0.55) 0%, transparent 65%)',
        filter: 'blur(12px)',
        borderRadius: '50%',
      }} />
    </div>
  </div>
);

/* ─────────────────── empty state ─────────────────── */
const EmptyState = ({ language }: { language: string }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center">
    <BlobScene />
    <div className="relative z-10 dp-float text-center px-6">
      <p className="text-white/90 text-xl font-bold tracking-wide mt-4">Darkpen AI</p>
      <p className="text-white/40 text-sm mt-1.5">
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
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4.5 h-4.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 9m-4.72 0-.34-9m9.96-3.24-.66.12M18 6H5.25M9.75 3h4.5" />
  </svg>
);
const IconHamburger = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);
const IconNav = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4.5 h-4.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
  </svg>
);
const IconCopy = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
  </svg>
);

/* ─────────────────── button style ─────────────────── */
const glassBtn = "flex items-center justify-center rounded-full transition-all active:scale-90 select-none";
const glassBtnSm = `${glassBtn} w-9 h-9`;

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

  /* ── image select (camera or gallery) ── */
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
      images:    curAttach.length ? curAttach.map(a => a.dataUrl) : undefined,  // data-URLs persist!
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
    <div className="flex flex-col w-full h-full select-none overflow-hidden relative" style={{ background: 'linear-gradient(155deg,#07071A 0%,#0E0D2E 40%,#0D1240 70%,#07071A 100%)' }}>

      {/* ── HEADER ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        
        {/* Left: hamburger + title */}
        <div className="flex items-center gap-3">
          <button onClick={onOpenLeftSidebar} className={`${glassBtnSm} text-white/70 hover:text-white hover:bg-white/10`} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <IconHamburger />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#5B3CE5,#8B5CF6)', boxShadow: '0 0 16px rgba(91,60,229,0.5)' }}>
              <span className="text-white font-black text-xs">DP</span>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2" style={{ borderColor: '#0E0D2E' }} />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Darkpen AI</p>
              <p className="text-emerald-400 text-[10px] font-medium">Online</p>
            </div>
          </div>
        </div>

        {/* Right: credits + clear history + nav panel */}
        <div className="flex items-center gap-2">
          {credits !== null && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-white/70 text-[10px] font-bold" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
              {credits}
            </div>
          )}
          <button onClick={clearHistory} className={`${glassBtnSm} text-white/50 hover:text-rose-400 hover:bg-rose-500/10`} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }} title="Clear history">
            <IconTrash />
          </button>
          <button onClick={onOpenNavPanel} className={`${glassBtnSm} text-white/70 hover:text-purple-400 hover:bg-purple-500/10`} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }} title="Navigation">
            <IconNav />
          </button>
        </div>
      </div>

      {/* ── MESSAGES ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 relative">
        
        {/* Blob background when chat is empty */}
        {isEmpty && <EmptyState language={language} />}

        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div key={msg.id} className={`dp-fade-up flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              
              {isUser ? (
                /* USER bubble */
                <div className="max-w-[82%] flex flex-col items-end gap-2">
                  {/* Attached images */}
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-end">
                      {msg.images.map((src, i) => (
                        <div key={i} className="w-[130px] h-[130px] rounded-2xl overflow-hidden shadow-lg" style={{ border: '2px solid rgba(91,60,229,0.4)' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="attachment" className="w-full h-full object-cover cursor-pointer transition-transform hover:scale-105" onClick={() => window.open(src, '_blank')} />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Text */}
                  {msg.text && (
                    <div className="px-4 py-3 rounded-2xl rounded-tr-sm text-white text-sm leading-relaxed shadow-lg" style={{ background: 'linear-gradient(135deg,#5B3CE5,#7C5CF0)', boxShadow: '0 4px 20px rgba(91,60,229,0.35)' }}>
                      {msg.text}
                    </div>
                  )}
                </div>

              ) : (
                /* AI message */
                <div className="max-w-[88%] flex flex-col items-start gap-2">
                  
                  {/* Thinking dots */}
                  {msg.status === 'thinking' && (
                    <div className="flex items-center gap-2 px-2 py-2">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                      <span className="text-xs text-white/40 font-medium ml-1">{thinkingStatus}</span>
                    </div>
                  )}

                  {/* Generating image skeleton */}
                  {msg.status === 'generating_image' && !msg.image && (
                    <div className="flex flex-col gap-2">
                      <div className="w-[200px] h-[150px] rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.07)' }} />
                      <span className="text-xs text-white/40">{thinkingStatus}</span>
                    </div>
                  )}

                  {/* AI text — bright white, clean */}
                  {msg.text && msg.status !== 'thinking' && (
                    <div
                      className="text-sm leading-relaxed text-white/90 select-text"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                    />
                  )}

                  {/* Generated image */}
                  {msg.image && (
                    <div className="mt-1 rounded-2xl overflow-hidden shadow-lg max-w-[240px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={msg.image} alt="AI" className="w-full h-auto cursor-pointer" onClick={() => window.open(msg.image, '_blank')} />
                    </div>
                  )}

                  {/* Copy button */}
                  {msg.text && msg.status !== 'thinking' && (
                    <button onClick={() => handleCopy(msg.text, msg.id)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-white/30 hover:text-white/70 text-[10px] font-semibold transition-all hover:bg-white/5 mt-0.5">
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
      <div className="shrink-0 px-4 pb-5 pt-3 relative" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {attachments.map((att, idx) => (
              <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 shadow-md" style={{ border: '2px solid rgba(91,60,229,0.5)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={att.dataUrl} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center text-white text-[9px]">
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
              className="flex flex-col items-center gap-2 px-5 py-3.5 rounded-2xl text-white text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              style={{ background: 'rgba(91,60,229,0.25)', backdropFilter: 'blur(20px)', border: '1px solid rgba(91,60,229,0.4)', boxShadow: '0 8px 24px rgba(91,60,229,0.2)' }}>
              <IconCamera />
              <span>Camera</span>
            </button>
            <button type="button" onClick={() => { galleryRef.current?.click(); setShowAttachMenu(false); }}
              className="flex flex-col items-center gap-2 px-5 py-3.5 rounded-2xl text-white text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              style={{ background: 'rgba(91,60,229,0.25)', backdropFilter: 'blur(20px)', border: '1px solid rgba(91,60,229,0.4)', boxShadow: '0 8px 24px rgba(91,60,229,0.2)' }}>
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
            className={`${glassBtn} w-10 h-10 text-white/80 hover:text-white transition-all ${showAttachMenu ? 'rotate-45 bg-purple-500/30' : 'bg-white/8 hover:bg-white/12'}`}
            style={{ border: '1px solid rgba(255,255,255,0.12)', boxShadow: showAttachMenu ? '0 0 16px rgba(91,60,229,0.4)' : 'none' }}>
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
            className="flex-1 min-w-0 text-sm text-white placeholder-white/25 focus:outline-none bg-transparent"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '999px',
              padding: '10px 18px',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)',
            }}
            onFocus={() => setShowAttachMenu(false)}
          />

          {/* Mic / Send */}
          {inputText.trim() === '' && !attachments.length ? (
            <button type="button"
              onMouseDown={startRecording} onMouseUp={stopRecording}
              onTouchStart={startRecording} onTouchEnd={stopRecording}
              className={`${glassBtn} w-10 h-10 text-white/80 transition-all ${isRecording ? 'bg-rose-500 text-white animate-pulse scale-110' : 'bg-white/8 hover:bg-white/14'}`}
              style={{ border: `1px solid ${isRecording ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`, boxShadow: isRecording ? '0 0 20px rgba(239,68,68,0.4)' : 'none' }}>
              <IconMic />
            </button>
          ) : (
            <button type="submit" disabled={isAiTyping}
              className={`${glassBtn} w-10 h-10 text-white transition-all disabled:opacity-40 hover:scale-105`}
              style={{ background: 'linear-gradient(135deg,#5B3CE5,#8B5CF6)', boxShadow: '0 4px 16px rgba(91,60,229,0.45)', border: '1px solid rgba(139,92,246,0.5)' }}>
              <IconSend />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
