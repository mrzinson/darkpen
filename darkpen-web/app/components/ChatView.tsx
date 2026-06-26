"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
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
}

// Simple markdown formatter helper matching mobile
function renderMarkdown(text: string) {
  if (!text) return '';
  // replace code blocks
  let formatted = text.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-900/60 border border-gray-800 rounded-xl p-4 my-3 text-xs font-mono text-gray-200 overflow-x-auto">$1</pre>');
  // replace bold
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // replace inline code
  formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-gray-800/80 px-1.5 py-0.5 rounded font-mono text-xs text-blue-400">$1</code>');
  // replace bullet points
  formatted = formatted.split('\n').map(line => {
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      return `<li class="ml-4 list-disc my-1">${line.trim().substring(2)}</li>`;
    }
    return line;
  }).join('\n');
  
  return formatted.split('\n').join('<br />');
}

export default function ChatView({ onOpenSidebar, onOpenGroups }: ChatViewProps) {
  const { colors, language, isDark } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('Thinking...');
  const [sessionId, setSessionId] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [credits, setCredits] = useState<number | null>(null);

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeXhr = useRef<XMLHttpRequest | null>(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiTyping, thinkingStatus]);

  // Load chat history & session
  useEffect(() => {
    let uId = 'guest';
    const cachedUser = localStorage.getItem('userData');
    if (cachedUser) {
      const u = JSON.parse(cachedUser);
      if (u.id) uId = u.id.toString();
    }

    let activeSession = localStorage.getItem(`active_session_id_${uId}`);
    if (!activeSession) {
      activeSession = `chat_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      localStorage.setItem(`active_session_id_${uId}`, activeSession);
    }
    setSessionId(activeSession);

    // Initial message
    const initialText = language === 'so' 
      ? "Kusoo dhawoow! Anigu waxaan ahay caawiyahaaga AI. Sidee baan kuu caawin karaa maanta?"
      : "Welcome! I am your AI assistant. How can I help you today?";
    
    // Load local history
    const cachedHistory = localStorage.getItem(`education_chat_messages_${uId}`);
    if (cachedHistory) {
      const parsed = JSON.parse(cachedHistory);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMessages(parsed);
      } else {
        setMessages([{ id: '1', text: initialText, sender: 'ai', timestamp: new Date().toISOString() }]);
      }
    } else {
      setMessages([{ id: '1', text: initialText, sender: 'ai', timestamp: new Date().toISOString() }]);
    }

    // Sync history from server
    const syncHistory = async () => {
      const token = localStorage.getItem('userToken');
      if (token && activeSession) {
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
        } catch (e) {
          console.log('Error syncing history:', e);
        }
      }
    };
    syncHistory();
    fetchCredits();

    return () => {
      if (activeXhr.current) {
        activeXhr.current.abort();
      }
    };
  }, [language]);

  const fetchCredits = async () => {
    const token = localStorage.getItem('userToken');
    if (!token) return;
    try {
      const res = await fetch('https://darkpen-backend.onrender.com/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setCredits(data.user.balance || 0);
      }
    } catch (e) {
      console.log('Error profile:', e);
    }
  };

  // Image upload handler
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length >= 5) {
      alert(language === 'so' ? 'Waxaad dooran kartaa ugu badan 5 sawir.' : 'You can select up to 5 images.');
      return;
    }

    const file = files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      setAttachments(prev => [...prev, {
        uri: URL.createObjectURL(file),
        base64: base64String,
        mimeType: file.type,
        name: file.name
      }]);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Delete attachment
  const deleteAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  // Voice recording toggle
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsTranscribing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp4' });
        const file = new File([audioBlob], 'voice_note.m4a', { type: 'audio/mp4' });

        const token = localStorage.getItem('userToken');
        const formData = new FormData();
        formData.append('audio', file);

        try {
          const res = await fetch(`https://darkpen-backend.onrender.com/api/chat/voice`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
          });
          const data = await res.json();
          if (res.ok && data.text) {
            setInputText(data.text);
          } else {
            alert('Cilad: Lama fahmin codkaaga.');
          }
        } catch (e) {
          console.log(e);
          alert('Cilad cod dirista ah.');
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      alert('Fadlan ogolow makarafoonka browser-ka.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stop all tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // Send message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && attachments.length === 0) || isAiTyping) return;

    const userText = inputText.trim();
    const currentAttachments = [...attachments];
    setInputText('');
    setAttachments([]);
    setIsAiTyping(true);

    const imageUris = currentAttachments.map(a => a.uri);
    const newUserMsg: Message = {
      id: Date.now().toString(),
      text: userText,
      sender: 'user',
      images: imageUris.length > 0 ? imageUris : undefined,
      timestamp: new Date().toISOString()
    };

    const aiMsgId = (Date.now() + 1).toString();
    const newAiMsg: Message = { 
      id: aiMsgId, 
      text: '', 
      sender: 'ai', 
      status: 'thinking', 
      timestamp: new Date().toISOString() 
    };

    setMessages(prev => [...prev, newUserMsg, newAiMsg]);
    setThinkingStatus(currentAttachments.length > 0 ? 'Analyzing image...' : 'Thinking...');

    try {
      const token = localStorage.getItem('userToken');
      const xhr = new XMLHttpRequest();
      activeXhr.current = xhr;
      xhr.open('POST', `https://darkpen-backend.onrender.com/api/chat/ask`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      let accumulatedText = "";
      let offset = 0;

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 3 || xhr.readyState === 4) {
          const responseText = xhr.responseText;
          const chunk = responseText.substring(offset);
          offset = responseText.length;

          if (chunk) {
            const lines = chunk.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ')) {
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
                    const errorTxt = parsed.text || "Qorshahan sawir laguma generate gareyn karo.";
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: errorTxt, status: 'complete' } : m));
                    break;
                  } else if (parsed.text || parsed.image) {
                    if (parsed.text) accumulatedText += parsed.text;
                    const imageUrl = parsed.image ? (parsed.image.startsWith('http') ? parsed.image : `https://darkpen-backend.onrender.com${parsed.image}`) : undefined;
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? {
                      ...m,
                      text: accumulatedText,
                      image: imageUrl || m.image,
                      status: parsed.status === 'complete' ? 'complete' : 'streaming'
                    } : m));
                  }
                } catch (e) {
                  // Partial JSON
                }
              }
            }
          }

          if (xhr.readyState === 4) {
            activeXhr.current = null;
            if (xhr.status >= 400 && !accumulatedText) {
              setMessages(prev => prev.map(m => m.id === aiMsgId ? { 
                ...m, 
                text: "Cilad ayaa ku dhacday nidaamka. Fadlan mar kale isku day.", 
                status: 'complete' 
              } : m));
            } else {
              setMessages(prev => prev.map(m => m.id === aiMsgId ? { 
                ...m, 
                text: accumulatedText || m.text || "Jawaab ma jiro.", 
                status: 'complete' 
              } : m));
              fetchCredits();
            }
            setIsAiTyping(false);
          }
        }
      };

      xhr.send(JSON.stringify({
        message: userText,
        chatType: 'education',
        stream: true,
        sessionId: sessionId,
        attachment: currentAttachments.length > 0 ? currentAttachments.map(att => ({
          base64: att.base64,
          mimeType: att.mimeType,
          name: att.name
        })) : null
      }));

    } catch (e) {
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { 
        ...m, 
        text: 'Cilad dhinaca internet-ka ah.', 
        status: 'complete' 
      } : m));
      setIsAiTyping(false);
    }
  };

  const confirmClearHistory = async () => {
    if (!window.confirm(language === 'so' ? 'Ma hubtaa inaad tirtirto taariikhda wada-hadalka?' : 'Are you sure you want to clear chat history?')) return;
    const token = localStorage.getItem('userToken');
    try {
      const res = await fetch(`https://darkpen-backend.onrender.com/api/chat/history/clear`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMessages([]);
        let uId = 'guest';
        const cached = localStorage.getItem('userData');
        if (cached) uId = JSON.parse(cached).id?.toString() || 'guest';
        localStorage.removeItem(`education_chat_messages_${uId}`);
        const newSession = `chat_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        localStorage.setItem(`active_session_id_${uId}`, newSession);
        setSessionId(newSession);
      }
    } catch (e) {
      alert('Tirtiriddu waa fashilantay.');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(language === 'so' ? 'La koobiyeeyay!' : 'Copied successfully!');
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-white dark:bg-[#0D1117] relative select-none">
      
      {/* Header (Circular buttons + center capsule matching screenshot 3) */}
      <div className="flex items-center justify-between px-4 py-4 bg-white dark:bg-[#161B22] border-b border-gray-150 dark:border-gray-800 select-none">
        
        {/* Left circular back button */}
        <button 
          onClick={onOpenSidebar}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 shadow border border-gray-150 dark:border-gray-700 text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all active:scale-95 flex-shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        
        {/* Center Pill Capsule */}
        <div className="px-5 py-2 rounded-full border-2 border-blue-500/20 dark:border-blue-500/40 bg-blue-500/5 select-none">
          <h3 className="font-extrabold text-blue-500 leading-none text-sm tracking-wide">Darkpen AI</h3>
        </div>

        {/* Right circular buttons */}
        <div className="flex items-center gap-2">
          {/* Delete History */}
          <button
            onClick={confirmClearHistory}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 shadow border border-gray-150 dark:border-gray-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all active:scale-95 flex-shrink-0"
            title="Tirtir Wada-hadalka"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 9m-4.72 0-.34-9m9.96-3-3.2 3.2m0 0L9 15m3-3L6 18M9 4h6m2 0H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" />
            </svg>
          </button>

          {/* Group Chat Toggle */}
          <button
            onClick={onOpenGroups}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 shadow border border-gray-150 dark:border-gray-700 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95 flex-shrink-0 relative group"
            title="Groups"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
            <span className="absolute top-12 right-0 bg-black text-white text-[9px] font-black px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none select-none whitespace-nowrap z-50">
              Group Chat
            </span>
          </button>

          {/* Sidebar Drawer trigger */}
          <button
            onClick={onOpenSidebar}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 shadow border border-gray-150 dark:border-gray-700 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95 flex-shrink-0"
            title="Menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 w-full overflow-y-auto px-6 py-6 space-y-5 scrollbar-thin bg-gray-50/20 dark:bg-[#0D1117]">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          
          return (
            <div 
              key={msg.id}
              className={`flex items-start gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              {/* Avatar logo */}
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 text-xs font-black relative flex-shrink-0 shadow-sm">
                  DP
                </div>
              )}

              {/* Message box */}
              <div className="flex flex-col gap-1.5 w-full">
                <div 
                  className={`rounded-2xl px-4 py-3.5 text-sm leading-relaxed shadow-sm ${isUser ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-[#161B22] border border-gray-150 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none'}`}
                >
                  {/* Thinking Status */}
                  {!isUser && msg.status === 'thinking' ? (
                    <div className="flex items-center gap-2 py-1 select-none">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce delay-100"></span>
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce delay-200"></span>
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce delay-300"></span>
                      </div>
                      <span className="text-xs text-gray-550 font-bold ml-1 animate-pulse">{thinkingStatus}</span>
                    </div>
                  ) : !isUser && msg.status === 'generating_image' ? (
                    <div className="flex flex-col gap-3 py-1 w-[200px]">
                      <div className="w-full h-[140px] bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
                      <span className="text-xs text-gray-550 font-bold animate-pulse">{thinkingStatus}</span>
                    </div>
                  ) : (
                    <div 
                      className="markdown-content space-y-2 select-text selection:bg-blue-500/30"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                    />
                  )}

                  {/* Render final image attachment/generation */}
                  {msg.image && (
                    <div className="mt-3 rounded-xl overflow-hidden max-w-[260px] border border-gray-150 dark:border-gray-800 relative shadow-inner">
                      <img 
                        src={msg.image} 
                        alt="AI Generation" 
                        className="object-cover w-full h-auto cursor-pointer"
                        onClick={() => window.open(msg.image, '_blank')}
                      />
                    </div>
                  )}
                </div>

                {/* Copy button below AI bubbles matching screenshot 3 */}
                {!isUser && msg.status !== 'thinking' && msg.text && (
                  <button 
                    onClick={() => handleCopy(msg.text)} 
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700/60 text-gray-505 dark:text-gray-400 text-[10px] font-bold border border-gray-200 dark:border-gray-700 mt-1 self-start transition-all active:scale-95 shadow-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z" />
                    </svg>
                    <span>Copy</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {isAiTyping && messages[messages.length - 1]?.sender === 'user' && (
          <div className="flex items-start gap-3 max-w-[85%] mr-auto animate-pulse">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 text-xs font-black flex-shrink-0">
              DP
            </div>
            <div className="rounded-2xl px-4 py-3.5 bg-white dark:bg-[#161B22] border border-gray-150 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none">
              <div className="flex items-center gap-2 py-1 select-none">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce delay-100"></span>
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce delay-200"></span>
                </div>
                <span className="text-xs text-gray-550 font-bold ml-1">{thinkingStatus}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input panel container */}
      <div className="p-4 bg-white dark:bg-[#161B22] border-t border-gray-150 dark:border-gray-800 flex flex-col gap-3">
        
        {/* Render Attachments preview */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 select-none">
            {attachments.map((att, idx) => (
              <div key={idx} className="relative w-16 h-16 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0 group">
                <img src={att.uri} alt="attachment" className="object-cover w-full h-full" />
                <button
                  type="button"
                  onClick={() => deleteAttachment(idx)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/65 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="w-full flex items-center gap-3">
          {/* Floating plus attachment button matching screenshot 3 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 shadow border border-gray-150 dark:border-gray-700 text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all active:scale-95 flex-shrink-0"
            title="Attach Image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageSelect}
            className="hidden"
          />

          {/* Text Input (Rounded Full matching screenshot 3) */}
          <input
            type="text"
            placeholder={isTranscribing ? "Voice transcribing..." : (language === 'so' ? "Su'aal halkan ku qor..." : "Ask a question here...")}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isAiTyping || isTranscribing}
            className="flex-1 min-w-0 bg-gray-50 dark:bg-[#0D1117] border border-gray-200 dark:border-gray-800 rounded-full px-5 py-3 text-sm text-gray-850 dark:text-white placeholder-gray-550 focus:outline-none focus:border-blue-500 shadow-inner"
          />

          {/* Voice Note Button (Floating circular mic button matching screenshot 3) */}
          {inputText.trim() === '' && attachments.length === 0 ? (
            <button
              type="button"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`w-11 h-11 rounded-full flex items-center justify-center shadow border transition-all flex-shrink-0 ${isRecording ? 'bg-red-500 text-white animate-pulse border-red-600' : 'bg-white dark:bg-gray-800 border-gray-150 dark:border-gray-700 text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-750 active:scale-95'}`}
              title="Hold to Record Voice Note"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            </button>
          ) : (
            /* Send Button */
            <button
              type="submit"
              disabled={isAiTyping}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white shadow-md transition-all active:scale-95 flex-shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </button>
          )}
        </form>
      </div>

    </div>
  );
}
