"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  status?: 'thinking' | 'streaming' | 'complete' | 'generating_image';
  timestamp?: string;
}

interface ShukaansiViewProps {
  onOpenSidebar: () => void;
  onBack?: () => void;
}

function renderMarkdown(text: string) {
  if (!text) return '';
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded text-xs text-pink-400">$1</code>');
  return formatted.split('\n').join('<br />');
}

export default function ShukaansiView({ onOpenSidebar, onBack }: ShukaansiViewProps) {
  const { language } = useTheme();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('Thinking...');
  const [coins, setCoins] = useState<number | null>(null);
  const [deductRate, setDeductRate] = useState<number>(1);
  const [userData, setUserData] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeXhr = useRef<XMLHttpRequest | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiTyping]);

  useEffect(() => {
    const cachedText = language === 'so'
      ? "Kusoo dhawoow! Anigu waxaan ahay 'My Love'. Maxaan kaa caawin karaa maanta?"
      : "Welcome! I am 'My Love'. How can I help you today?";
    
    // Load local history
    let uId = 'guest';
    const cachedUser = localStorage.getItem('userData');
    if (cachedUser) {
      const parsed = JSON.parse(cachedUser);
      uId = parsed.id?.toString() || 'guest';
      setUserData(parsed);
    }
    
    const cached = localStorage.getItem(`shukaansi_chat_messages_${uId}`);
    if (cached) {
      setMessages(JSON.parse(cached));
    } else {
      setMessages([{ id: '1', text: cachedText, sender: 'ai', timestamp: new Date().toISOString() }]);
    }

    // Sync from server
    const syncHistory = async () => {
      const token = localStorage.getItem('userToken');
      if (token) {
        try {
          const res = await fetch(`https://darkpen-backend.onrender.com/api/chat/shukaansi-history`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
              const mapped: Message[] = data.messages.map((m: any) => ({
                id: m.id.toString(),
                text: m.message || m.text || '',
                sender: m.sender,
                timestamp: m.created_at || new Date().toISOString()
              }));
              setMessages(mapped);
              localStorage.setItem(`shukaansi_chat_messages_${uId}`, JSON.stringify(mapped));
            }
          }
        } catch (e) {
          console.log(e);
        }
      }
    };

    syncHistory();
    fetchShukaansiProfile();

    return () => {
      if (activeXhr.current) activeXhr.current.abort();
    };
  }, [language]);

  const fetchShukaansiProfile = async () => {
    const token = localStorage.getItem('userToken');
    if (!token) return;
    try {
      const res = await fetch('https://darkpen-backend.onrender.com/api/chat/shukaansi-profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.profile) {
        setCoins(data.profile.balance || 0);
        setDeductRate(data.profile.deduct_rate || 1);
      }
    } catch (e) {
      console.log('Error profile:', e);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isAiTyping) return;

    const userText = inputText.trim();
    setInputText('');
    setIsAiTyping(true);

    const newUserMsg: Message = {
      id: Date.now().toString(),
      text: userText,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    const aiMsgId = (Date.now() + 1).toString();
    const newAiMsg: Message = { id: aiMsgId, text: '', sender: 'ai', status: 'thinking', timestamp: new Date().toISOString() };

    setMessages(prev => [...prev, newUserMsg, newAiMsg]);
    setThinkingStatus('Thinking...');

    try {
      const token = localStorage.getItem('userToken');
      const sendRequest = (isRetry = false) => {
        if (isRetry) setThinkingStatus('Server-ka ayaa bilaabmaya, sabar yar...');
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
                    if (parsed.text) {
                      accumulatedText += parsed.text;
                      setMessages(prev => prev.map(m => m.id === aiMsgId ? {
                        ...m,
                        text: accumulatedText,
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
              if (xhr.status >= 400) {
                let errText = "Cilad ayaa ku dhacday nidaamka. Fadlan mar kale isku day.";
                try { const j = JSON.parse(xhr.responseText); errText = j.message || errText; } catch {}
                setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: errText, status: 'complete' } : m));
                setIsAiTyping(false);
              } else if (!accumulatedText && !isRetry) {
                setThinkingStatus('Server-ka ayaa toosaya, sabar yar...');
                setTimeout(() => sendRequest(true), 3000);
              } else {
                setMessages(prev => prev.map(m => m.id === aiMsgId ? { 
                  ...m, 
                  text: accumulatedText || m.text || "Jawaab ma jiro.", 
                  status: 'complete' 
                } : m));
                fetchShukaansiProfile();
                setIsAiTyping(false);
              }
            }
          }
        };

        xhr.send(JSON.stringify({
          message: userText,
          chatType: 'shukaansi',
          stream: true,
          sessionId: `shukaansi_${Date.now()}`
        }));
      };

      sendRequest();

    } catch (e) {
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { 
        ...m, 
        text: 'Cilad dhinaca internet-ka ah.', 
        status: 'complete' 
      } : m));
      setIsAiTyping(false);
    }
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-white dark:bg-[#0D1117] relative select-none">
      
      {/* Header (Circular buttons + left-aligned WhatsApp-style partner avatar + name + status) */}
      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-[#161B22] border-b border-gray-150 dark:border-gray-800 select-none">
        <div className="flex items-center gap-2">
          {/* Back Circular Button */}
          <button 
            onClick={onBack || onOpenSidebar}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 shadow border border-gray-150 dark:border-gray-700 text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all active:scale-95 flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          
          {/* WhatsApp-like Avatar + Name + Online status */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500 font-extrabold text-xs shadow-inner">
                G
              </div>
              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-[#161B22] animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight">Gacalo</span>
              <span className="text-[10px] text-green-500 font-medium">Online</span>
            </div>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Phone Call Button */}
          <button 
            onClick={() => alert('Wicitaanka hadda ma shaqaynayo.')}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 shadow border border-gray-150 dark:border-gray-700 text-gray-750 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all active:scale-95 flex-shrink-0"
            title="Call"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.428-5.117-3.72-6.545-6.545l1.293-.97c.362-.272.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
            </svg>
          </button>

          {/* Menu Drawer Toggle */}
          <button 
            onClick={onOpenSidebar}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 shadow border border-gray-150 dark:border-gray-700 text-gray-750 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all active:scale-95 flex-shrink-0"
            title="Menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Message explain coins */}
      {coins !== null && (
        <div className="bg-pink-500/5 border-b border-pink-500/10 p-3 text-center text-[10px] text-pink-400 font-medium select-none">
          {language === 'so'
            ? `Waxaad haysataa ${coins} dhibcood oo Shukaansiga ah. Farriin kasta oo aad dirto waxay kaa jaraysaa ${deductRate} dhibco.`
            : `You have ${coins} coins for dating chat. Each sent message deducts ${deductRate} coins.`}
        </div>
      )}

      {/* Messages list */}
      <div className="flex-1 w-full overflow-y-auto px-6 py-6 space-y-4 scrollbar-thin bg-gray-50/20 dark:bg-[#0D1117]">
        {messages.map((msg, index) => {
          const isUser = msg.sender === 'user';
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showQuote = !isUser && prevMsg && prevMsg.sender === 'user' && prevMsg.text;

          return (
            <div 
              key={msg.id}
              className={`flex items-end gap-2.5 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              {/* Avatar logo */}
              {!isUser ? (
                <div className="w-8 h-8 rounded-full bg-pink-550/10 border border-pink-500/20 flex items-center justify-center text-pink-500 text-xs font-black flex-shrink-0 relative shadow-sm">
                  ML
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-[9px] font-black flex-shrink-0 shadow-sm -mb-0.5">
                  {userData?.username ? userData.username.substring(0, 2).toUpperCase() : 'ME'}
                </div>
              )}

              {/* Message box */}
              <div className="flex flex-col gap-2">
                <div 
                  className={`rounded-2xl px-4 py-3.5 text-sm leading-relaxed shadow-sm ${isUser ? 'bg-red-500 text-white rounded-br-none' : 'bg-white dark:bg-[#161B22] border border-gray-150 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none'}`}
                >
                  {/* Quoted user message matching screenshot 4 */}
                  {showQuote && (
                    <div className="border-l-4 border-red-500 bg-gray-50 dark:bg-gray-800/80 px-3 py-2 rounded-r-xl mb-2 text-xs text-left border-t border-r border-b border-gray-150 dark:border-gray-800 select-none">
                      <span className="font-extrabold text-red-500 block text-[10px] uppercase tracking-wide">Adiga</span>
                      <span className="text-gray-600 dark:text-gray-300 block mt-0.5 text-[11px] truncate">{prevMsg.text}</span>
                    </div>
                  )}

                  {/* Thinking Status */}
                  {!isUser && msg.status === 'thinking' ? (
                    <div className="flex items-center gap-2 py-1 select-none">
                      <div className="flex gap-1 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-pink-550 animate-bounce"></span>
                        <span className="w-2 h-2 rounded-full bg-pink-550 animate-bounce delay-75"></span>
                        <span className="w-2 h-2 rounded-full bg-pink-550 animate-bounce delay-150"></span>
                      </div>
                      <span className="text-xs text-gray-550 font-bold ml-1">{thinkingStatus}</span>
                    </div>
                  ) : (
                    <div 
                      className="markdown-content space-y-2 select-text selection:bg-pink-500/30"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {isAiTyping && messages[messages.length - 1]?.sender === 'user' && (
          <div className="flex items-start gap-3 max-w-[85%] mr-auto animate-pulse">
            <div className="w-8 h-8 rounded-full bg-pink-550/10 border border-pink-500/20 flex items-center justify-center text-pink-550 text-xs font-black flex-shrink-0">
              ML
            </div>
            <div className="rounded-2xl px-4 py-3.5 bg-white dark:bg-[#161B22] border border-gray-150 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none">
              <div className="flex items-center gap-2 py-1 select-none">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-pink-550 animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-pink-550 animate-bounce delay-75"></span>
                  <span className="w-2 h-2 rounded-full bg-pink-550 animate-bounce delay-150"></span>
                </div>
                <span className="text-xs text-gray-550 font-bold ml-1">{thinkingStatus}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input panel container */}
      <div className="p-4 bg-white dark:bg-[#161B22] border-t border-gray-150 dark:border-gray-800">
        <form onSubmit={handleSend} className="w-full flex items-center gap-3">
          
          {/* Plus Add Attachment trigger */}
          <button
            type="button"
            onClick={() => alert('Wada-wadaagga sawirrada shukaansigu hadda ma shaqaynayo.')}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 shadow border border-gray-150 dark:border-gray-700 text-pink-500 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all active:scale-95 flex-shrink-0"
            title="Attach Image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>

          {/* Text Input (Rounded Full matching screenshot 4) */}
          <input
            type="text"
            placeholder={language === 'so' ? "U dir farriin My Love..." : "Message My Love..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isAiTyping}
            className="flex-1 min-w-0 bg-gray-50 dark:bg-[#0D1117] border border-gray-200 dark:border-gray-800 rounded-full px-5 py-3 text-sm text-gray-800 dark:text-white placeholder-gray-550 focus:outline-none focus:border-pink-550 shadow-inner"
          />

          {/* Send/Record Button (Solid Red Microphone Button matching screenshot 4) */}
          <button
            type="submit"
            disabled={isAiTyping}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-red-500 border border-red-600 hover:bg-red-600 text-white shadow-md transition-all active:scale-95 flex-shrink-0"
          >
            {inputText.trim() === '' ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            )}
          </button>
        </form>
      </div>

    </div>
  );
}
