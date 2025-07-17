import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import type { MahaboteResult, HoroscopeSections, ChatMessage } from '../types';
import type { Language } from '../i18n';
import { Spinner } from './Spinner';
import { loadOmiseScript } from '../utils/scriptLoader';

const OMISE_PUBLIC_KEY = 'pkey_test_64ejij4yiecx24skte8';
// WARNING: The secret key should never be exposed in client-side code.
// This is for demonstration purposes only in an environment without a backend.
// In a real application, the token should be sent to a server, 
// and the server would make the charge request using the secret key.
const OMISE_SECRET_KEY = 'skey_test_64ejij5gw9snd8j2vxd';

// Add type for Omise for the global window object
declare global {
    interface Window {
        Omise: any;
    }
}


// Component for a single message bubble
const MessageBox: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
           <span className="text-lg" role="img" aria-label="Astrologer Icon">🔮</span>
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-amber-800/60 text-amber-50 rounded-br-none'
            : 'bg-slate-700/80 text-amber-100 rounded-bl-none'
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
      </div>
    </div>
  );
};

// Typing indicator component
const TypingIndicator: React.FC<{ t: (key: string) => string }> = ({ t }) => (
    <div className="flex items-end gap-2 justify-start">
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
           <span className="text-lg" role="img" aria-label="Astrologer Icon">🔮</span>
        </div>
        <div className="max-w-[80%] rounded-lg px-4 py-2 bg-slate-700/80 text-amber-100 rounded-bl-none">
            <div className="flex items-center gap-1">
                <span className="text-amber-300">{t('chatTyping')}</span>
                <div className="w-1 h-1 bg-amber-300 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                <div className="w-1 h-1 bg-amber-300 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                <div className="w-1 h-1 bg-amber-300 rounded-full animate-pulse"></div>
            </div>
        </div>
    </div>
);

const OmiseStatusIndicator: React.FC<{ status: 'loading' | 'ready' | 'error', t: (key: string) => string }> = ({ status, t }) => {
    const statusMap = {
        loading: { text: t('omiseStatusConnecting'), className: 'text-amber-400' },
        ready: { text: t('omiseStatusReady'), className: 'text-green-400' },
        error: { text: t('omiseStatusError'), className: 'text-red-400' },
    };
    const currentStatus = statusMap[status];

    return (
        <div className={`text-xs text-center mb-2 h-4 ${currentStatus.className}`}>
            {currentStatus.text}
        </div>
    );
};


interface ChatInterfaceProps {
  result: MahaboteResult;
  horoscope: HoroscopeSections;
  t: (key: string) => string;
  lang: Language;
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ result, horoscope, t, lang }) => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [hasCredit, setHasCredit] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [omiseStatus, setOmiseStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOmiseStatus('loading');
    loadOmiseScript()
      .then(() => {
        try {
          window.Omise.setPublicKey(OMISE_PUBLIC_KEY);
          setOmiseStatus('ready');
        } catch (e) {
          console.error("Error setting Omise public key:", e);
          setOmiseStatus('error');
        }
      })
      .catch((error) => {
        console.error(error);
        setOmiseStatus('error');
      });
  }, []);

  useEffect(() => {
    if (isSending) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isSending]);

  useEffect(() => {
    const systemInstructionTemplates = {
        my: `သင်သည် တိုက်ရိုက်၊ တိကျစွာ ဟောပြောတတ်သော မဟာဘုတ်ဗေဒင်ဆရာမကြီးတစ်ဦးဖြစ်သည်။ သင်သည် အောက်ပါအချက်အလက်များအပေါ် အခြေခံ၍ အသုံးပြုသူအတွက် ဟောစာတမ်းတစ်ခုကို ပေးခဲ့ပြီးဖြစ်သည်။

- မွေးနေ့: ${result.dayInfo.name.my}
- ဘုခ်: ${result.houseInfo.name.my}
- အကျဉ်းချုပ်ဟောစာတမ်း:
  - အထူးသတိပေးချက်: ${horoscope.warning}
  - စရိုက်: ${horoscope.personality}
  - စီးပွားရေး: ${horoscope.career}
  - အချစ်ရေး: ${horoscope.love}
  - ကျန်းမာရေး: ${horoscope.health}
  - အကြံဉာဏ်: ${horoscope.advice}

ယခု အသုံးပြုသူသည် သင့်ထံသို့ မေးခွန်းများမေးမြန်းလာမည်ဖြစ်သည်။
သင်၏တာဝန်မှာ- သင်၏အဖြေများသည် တိုတုတ်၊ တိကျပြီး တိုက်ရိုက်ဖြစ်ရမည်။ အသုံးပြုသူကို ကလေးတစ်ယောက်လို ဆက်ဆံခြင်းကို ရှောင်ကြဉ်ပါ။ သူတို့၏မေးခွန်းများကို ရိုးသားစွာနှင့် တိုက်ရိုက်ဖြေဆိုပါ၊ အဖြေသည် ကြမ်းတမ်းသည်ဟု ထင်ရလျှင်ပင် ဖြေဆိုပါ။ သင်၏အလုပ်မှာ အမှန်တရားကို ပြောရန်ဖြစ်ပြီး အားပေးစကားချည်း ပြောရန်မဟုတ်ပါ။`,
        th: `คุณคือโหรหญิงพม่าผู้เชี่ยวชาญด้านมหาโปตะที่พูดจาตรงไปตรงมาและมีประสบการณ์สูง คุณได้ให้คำทำนายแก่ผู้ใช้โดยอิงจากข้อมูลต่อไปนี้:

- วันเกิด: ${result.dayInfo.name.th}
- ภพ: ${result.houseInfo.name.th}
- คำทำนายสรุป:
  - คำเตือนพิเศษ: ${horoscope.warning}
  - นิสัย: ${horoscope.personality}
  - การงาน: ${horoscope.career}
  - ความรัก: ${horoscope.love}
  - สุขภาพ: ${horoscope.health}
  - คำแนะนำ: ${horoscope.advice}

ตอนนี้ผู้ใช้จะเริ่มถามคำถามกับคุณ
หน้าที่ของคุณคือ: คำตอบของคุณต้องกระชับ ตรงไปตรงมา และไม่อ้อมค้อม หลีกเลี่ยงการปลอบประโลมที่ยืดเยื้อ ตอบคำถามอย่างตรงไปตรงมาตามหลักโหราศาสตร์ แม้ว่าคำตอบนั้นอาจจะไม่ใช่สิ่งที่ผู้ใช้อยากได้ยินก็ตาม หน้าที่ของคุณคือการเป็นโหรที่ให้ความจริง ไม่ใช่เพียงแค่ผู้ให้กำลังใจ`
    };

    const newChat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemInstructionTemplates[lang],
      },
    });

    setChat(newChat);
    setMessages([{ role: 'model', text: t('chatInitialMessage') }]);
  }, [result, horoscope, lang, t]);

  const createCharge = async (token: string) => {
    setIsPaying(true);
    try {
        const response = await fetch('https://api.omise.co/charges', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${btoa(OMISE_SECRET_KEY + ':')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                description: `Mahabote Chat Question - ${new Date().toISOString()}`,
                amount: 500,
                currency: 'THB',
                card: token
            })
        });

        const data = await response.json();

        if (response.ok && (data.status === 'successful' || data.status === 'pending')) {
            setHasCredit(true);
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            console.error('Payment failed:', data);
            const errorMessage: ChatMessage = { role: 'model', text: t('chatPaymentError') };
            setMessages(prev => [...prev, errorMessage]);
        }
    } catch (error) {
        console.error('Error creating charge:', error);
        const errorMessage: ChatMessage = { role: 'model', text: t('chatPaymentError') };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsPaying(false);
    }
  };

  const triggerPayment = () => {
    if (omiseStatus !== 'ready' || !window.Omise || !window.Omise.checkout) {
        console.error('triggerPayment called but Omise checkout is not ready.');
        return;
    }
    
    window.Omise.checkout.open({
        amount: 500,
        currency: 'THB',
        frameLabel: t('appTitle'),
        frameDescription: t('paymentModalTitle'),
        submitLabel: t('paymentConfirmButton'),
        onCreateTokenSuccess: (token: string) => {
            createCharge(token);
        },
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isSending || !chat) return;

    const userMessage: ChatMessage = { role: 'user', text: userInput.trim() };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsSending(true);

    try {
      const response = await chat.sendMessage({ message: userMessage.text });
      const modelMessage: ChatMessage = { role: 'model', text: response.text };
      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error("Chat API error:", error);
      const errorMessage: ChatMessage = { role: 'model', text: t('errorFetch') };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
      setHasCredit(false); // Use up the credit
    }
  };

  return (
      <div className="mt-8 border-t-2 border-amber-500/20 pt-6 animate-fade-in-up" style={{ animationDelay: '600ms' }}>
        <h3 className="text-2xl font-semibold text-amber-200 mb-4 text-center">{t('chatTitle')}</h3>
        
        <div className="relative">
            <div className="h-80 max-h-[60vh] bg-slate-900/70 rounded-lg p-4 flex flex-col space-y-4 overflow-y-auto border border-amber-600/20 shadow-inner">
            {messages.map((msg, index) => (
                <MessageBox key={index} message={msg} />
            ))}
            {isSending && <TypingIndicator t={t} />}
            <div ref={messagesEndRef} />
            </div>

            {isPaying && (
                <div
                    className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg p-6 text-center animate-fade-in"
                    role="alert"
                    aria-busy="true"
                >
                    <Spinner />
                    <p className="mt-4 text-lg font-bold text-amber-300">{t('paymentProcessing')}</p>
                </div>
            )}
        </div>
        
        <div className="mt-2">
            {!hasCredit && <OmiseStatusIndicator status={omiseStatus} t={t} />}
            <form onSubmit={handleSendMessage} className="flex gap-2">
            {hasCredit ? (
                <>
                <input
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder={t('chatPlaceholder')}
                    disabled={isSending || !hasCredit}
                    className="flex-grow p-3 bg-slate-900/70 border border-amber-600/50 rounded-md text-amber-50 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition disabled:opacity-50"
                    aria-label={t('chatPlaceholder')}
                />
                <button
                    type="submit"
                    disabled={isSending || !userInput.trim() || !hasCredit}
                    className="py-3 px-6 bg-amber-600 text-slate-900 font-bold rounded-lg shadow-md hover:bg-amber-500 hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed disabled:transform-none"
                    aria-label={t('chatSendButton')}
                >
                    {t('chatSendButton')}
                </button>
                </>
            ) : (
                <button
                type="button"
                onClick={triggerPayment}
                disabled={isSending || isPaying || omiseStatus !== 'ready'}
                className="w-full py-3 px-4 bg-green-600 text-white text-lg font-bold rounded-lg shadow-md hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20 transform hover:-translate-y-1 transition-all duration-300 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-wait disabled:transform-none"
                >
                {t('paymentPrompt')}
                </button>
            )}
            </form>
        </div>
      </div>
  );
};