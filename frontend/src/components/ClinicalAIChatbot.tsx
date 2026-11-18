import React, { useState, useRef, useEffect } from 'react';
import { useHealthRecord } from '../context/HealthRecordContext';
import { Bot, Send, X, Sparkles } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  type?: 'general' | 'warning' | 'recommendation' | 'triage';
  quickActions?: { label: string; action: string }[];
}

export const ClinicalAIChatbot: React.FC = () => {
  const { profile, theme } = useHealthRecord();
  const isLight = theme === 'light';

  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: `Hello ${profile?.fullName || 'there'}! I'm Aura, your Gemini-powered AI Clinical Assistant. How can I help you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'general',
      quickActions: [
        { label: 'Check Allergy Conflicts', action: 'allergies' },
        { label: 'Review Active Meds', action: 'meds' },
        { label: 'Fever & Symptom Advice', action: 'fever' }
      ]
    }
  ]);

  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const processAIResponse = async (userQuery: string) => {
    setIsTyping(true);
    try {
      const token = localStorage.getItem('uhr_jwt_token') || localStorage.getItem('token') || '';
      const contextPrefix = `[Patient Context — Blood Group: ${profile?.bloodGroup || 'Unknown'}, Allergies: ${profile?.allergies?.join(', ') || 'None'}] `;

      const response = await fetch('https://unified-health-record.onrender.com/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: contextPrefix + userQuery })
      });

      const data = await response.json();
      const aiText = data.reply || data.message || 'I could not process that right now. Please try again.';

      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'ai',
          text: aiText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'general'
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'ai',
          text: 'Unable to reach Aura AI right now. Please check your connection and try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'warning'
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const sendMessageText = (text: string) => {
    if (!text.trim() || isTyping) return;
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setInputMessage('');
    processAIResponse(text);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    sendMessageText(inputMessage);
  };

  const handleQuickAction = (action: string) => {
    if (action === 'allergies') {
      sendMessageText('Are any common medications conflicting with my recorded allergies?');
    } else if (action === 'meds') {
      sendMessageText('What precautions should I follow for my active prescriptions?');
    } else if (action === 'fever') {
      sendMessageText('I have a mild fever and headache, what should I do?');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative group p-4 rounded-full bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-600 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center border border-teal-300/40"
          title="Open Clinical AI Assistant"
        >
          <div className="absolute -inset-1 rounded-full bg-cyan-400 blur-md opacity-40 group-hover:opacity-80 transition-opacity animate-pulse" />
          <Bot className="w-6 h-6 relative z-10" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-950 rounded-full" />
        </button>
      )}

      {isOpen && (
        <div className={`w-[360px] sm:w-[420px] h-[580px] rounded-3xl border shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl transition-all animate-in fade-in zoom-in-95 duration-200 ${
          isLight 
            ? 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/60' 
            : 'bg-slate-900/95 border-cyan-500/30 text-slate-100 shadow-cyan-950/60'
        }`}>
          <div className={`p-4 border-b flex items-center justify-between ${
            isLight ? 'bg-slate-50/90 border-slate-200' : 'bg-slate-950/80 border-slate-800'
          }`}>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-xs tracking-wide">Aura Clinical AI</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                    Gemini Live
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Context-Aware Health Companion</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[85%] p-3.5 rounded-2xl space-y-1.5 ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-br-xs shadow-sm'
                    : msg.type === 'warning'
                    ? 'bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 rounded-bl-xs'
                    : isLight
                    ? 'bg-slate-100 text-slate-800 border border-slate-200/80 rounded-bl-xs'
                    : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-bl-xs'
                }`}>
                  <div className="flex items-center justify-between gap-2 text-[10px] opacity-70 mb-0.5">
                    <span className="font-bold">{msg.sender === 'user' ? 'You' : 'Aura AI'}</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div className="leading-relaxed whitespace-pre-line">{msg.text}</div>
                </div>

                {msg.quickActions && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.quickActions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuickAction(action.action)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                          isLight
                            ? 'bg-white hover:bg-teal-50 border-slate-200 text-teal-700 hover:border-teal-300'
                            : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-cyan-300 hover:border-cyan-600'
                        }`}
                      >
                        ⚡ {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center space-x-1.5 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 w-fit text-[11px] text-slate-500">
                <Sparkles className="w-3.5 h-3.5 animate-spin text-teal-500" />
                <span>Aura is analyzing clinical history...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          <form onSubmit={handleSend} className={`p-3 border-t flex items-center gap-2 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
          }`}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about symptoms, medications, or allergies..."
              className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs outline-none transition-all ${
                isLight 
                  ? 'bg-white border border-slate-200 text-slate-800 focus:border-teal-500' 
                  : 'bg-slate-900 border border-slate-800 text-white focus:border-cyan-500'
              }`}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isTyping}
              className="p-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white disabled:opacity-40 transition-opacity shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
