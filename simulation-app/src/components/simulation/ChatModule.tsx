"use client";

import { useState, useRef, useEffect } from "react";
import {
  Phone,
  ShieldCheck,
  ShieldAlert,
  X,
  User,
  MessageSquare,
  Brain,
  Lock,
  Zap,
  ArrowRight,
  Send,
  Mic,
  Volume2,
  Loader2
} from "lucide-react";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";

interface ChatMessage {
  role: "scammer" | "ai";
  text: string;
  audioBase64?: string;
  timestamp: Date;
}

interface ChatModuleProps {
  customerId: string;
  selectedPersona: any;
  setActiveFeature: (feature: any) => void;
}

export default function ChatModule({
  customerId,
  selectedPersona,
  setActiveFeature,
}: ChatModuleProps) {
  const [callState, setCallState] = useState<"idle" | "ringing" | "warning" | "active" | "success">("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [autoPlayVoice, setAutoPlayVoice] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [sessionData, setSessionData] = useState<{ id: string; caller: string; location: string } | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [isTestCallLoading, setIsTestCallLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const playAudio = (base64Audio: string) => {
    if (!base64Audio) return;
    try {
      const byteChars = atob(base64Audio);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (e) {
      console.error("Audio playback failed:", e);
    }
  };

  const startCall = async () => {
    setCallState("ringing");
    setMessages([]);
    setSessionId(null);

    try {
      const res = await fetch(`${API_BASE}/honeypot/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: selectedPersona?.id || "DRISHYAM AI",
          customer_id: customerId
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.session_id);
        setSessionData({
          id: data.session_id,
          caller: data.caller_num || "+91-TRACE-NODE",
          location: "SCANNING..."
        });
        setTimeout(() => setCallState("warning"), 2000);
      } else {
        const err = await res.text();
        toast.error(`Shield Initialization Failed: ${err.slice(0, 50)}`);
        setCallState("idle");
      }
    } catch (e) {
      console.error("Failed to initiate monitoring session:", e);
      toast.error("Could not reach DRISHYAM Command. Check network.");
      setCallState("idle");
    }
  };

  const handleTestCall = async () => {
    if (!testPhoneNumber) {
      toast.error("Please enter a phone number first.");
      return;
    }
    setIsTestCallLoading(true);
    try {
      // We assume the user is logged in and token is in localStorage
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/twilio/call`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          to_number: testPhoneNumber,
          persona: selectedPersona?.id || "Elderly Uncle"
        })
      });
      if (res.ok) {
        toast.success("DRISHYAM AI is dialing your phone now!");
      } else {
        const data = await res.json();
        toast.error(`Call Failed: ${data.detail || "Check console"}`);
      }
    } catch (e) {
      console.error("Test call error:", e);
      toast.error("Network error. Ensure backend is running.");
    }
    setIsTestCallLoading(false);
  };

  const handOffToAI = () => {
    setCallState("active");
    const introMsg: ChatMessage = {
      role: "ai",
      text: `Namaste... hello? Kaun hai?`,
      timestamp: new Date(),
    };
    setMessages([introMsg]);
  };

  const endCall = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/honeypot/direct-conclude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "",
          persona: selectedPersona?.id || "Elderly Uncle",
          session_id: sessionId,
          customer_id: customerId,
          history: messages.map(m => ({
            role: m.role === "scammer" ? "user" : "assistant",
            content: m.text,
          }))
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
        setCallState("success");
        toast.success("Intelligence successfully secured and reported.");
      } else {
        toast.error("Conclude failed: Analysis results could not be saved.");
        setCallState("success");
      }
    } catch (e) {
      console.error("Conclude error:", e);
      toast.error("Network error during intelligence reporting.");
      setCallState("success");
    }
    setIsLoading(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          await processVoiceAudio(base64Audio);
        };
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
      toast.error("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoiceAudio = async (base64Audio: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/voice/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_base64: base64Audio,
          persona: selectedPersona?.id || "Elderly Uncle",
          session_id: sessionId,
          history: messages.map(m => ({
            role: m.role === "scammer" ? "user" : "assistant",
            content: m.text,
          }))
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.scammer_transcript) {
        setMessages(prev => [...prev, { role: "scammer", text: data.scammer_transcript, timestamp: new Date() }]);
      }
      const aiMsg: ChatMessage = {
        role: "ai",
        text: data.ai_response_text,
        audioBase64: data.ai_audio_base64,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
      if (data.ai_audio_base64 && autoPlayVoice) playAudio(data.ai_audio_base64);
    } catch (error) {
      console.error("Voice pipeline failed:", error);
      toast.error("Voice Processing Error.");
    }
    setIsLoading(false);
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;
    setMessages(prev => [...prev, { role: "scammer", text, timestamp: new Date() }]);
    setInputText("");
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/honeypot/direct-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          persona: selectedPersona?.id || "Elderly Uncle",
          session_id: sessionId,
          history: messages.map(m => ({
            role: m.role === "scammer" ? "user" : "assistant",
            content: m.text,
          }))
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: "ai", text: data.ai_response, timestamp: new Date() }]);
      }
    } catch (error) {
      console.error("Text chat error:", error);
    }
    setIsLoading(false);
  };

  const toggleBlock = () => {
    setIsBlocked(!isBlocked);
    if (!isBlocked) toast.success("IMEI Range Blocked in NCR Region");
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-12 w-full flex-1 min-h-0">
      {/* Phone Container */}
      <div className="relative w-full max-w-[320px] h-[500px] sm:h-[600px] bg-charcoal rounded-[3rem] border-[10px] border-charcoal shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] overflow-hidden transition-all shrink-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-charcoal rounded-b-2xl z-30" />
        <div className="relative w-full h-full bg-white flex flex-col">
          {callState === "idle" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 sm:gap-6 p-4 sm:p-5 fade-in overflow-y-auto scrollbar-hide">
              <div className="w-16 h-16 rounded-2xl bg-boxbg flex items-center justify-center text-indblue pulse-saffron shadow-inner shrink-0 mt-2">
                <ShieldCheck size={32} />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-black text-indblue">Shield Ready</p>
                <p className="text-[8px] text-silver font-bold uppercase tracking-widest leading-relaxed">Secure Line Established<br />AI Core Synchronized</p>
              </div>
              <div className="flex flex-col gap-2.5 w-full max-w-[220px]">
                <div className="space-y-2 mb-1">
                  <p className="text-[8px] text-silver font-black uppercase tracking-widest text-center">Test on your real phone</p>
                  <input 
                    type="text" 
                    placeholder="+91XXXXXXXXXX" 
                    value={testPhoneNumber}
                    onChange={(e) => setTestPhoneNumber(e.target.value)}
                    className="w-full bg-boxbg border border-silver/10 rounded-xl px-4 py-2 text-[11px] font-bold text-indblue focus:outline-none focus:ring-2 focus:ring-indblue/10 transition-all"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={handleTestCall}
                      disabled={isTestCallLoading}
                      className="py-2.5 bg-saffron/10 text-saffron border border-saffron/20 rounded-xl text-[9px] font-black hover:bg-saffron hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {isTestCallLoading ? <Loader2 size={10} className="animate-spin" /> : <Phone size={10} />}
                      CALL
                    </button>
                    <button 
                      onClick={async () => {
                        if (!testPhoneNumber) { toast.error("Enter phone number"); return; }
                        try {
                          const res = await fetch(`${API_BASE}/twilio/sms`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ to_number: testPhoneNumber, message: "DRISHYAM AI Security Alert: We have detected a suspicious login attempt from Jamtara, Jharkhand. Please do not share your OTP with anyone." })
                          });
                          if (res.ok) toast.success("SMS Alert Sent!");
                          else toast.error("SMS Failed");
                        } catch (e) { toast.error("Network Error"); }
                      }}
                      className="py-2.5 bg-indblue/10 text-indblue border border-indblue/20 rounded-xl text-[9px] font-black hover:bg-indblue hover:text-white transition-all flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare size={10} />
                      SMS
                    </button>
                  </div>
                </div>

                <div className="h-[1px] bg-silver/5 w-full my-0.5" />

                <div className="flex bg-boxbg p-1 rounded-full border border-silver/10">
                  <button onClick={() => setIsVoiceMode(false)} className={`flex-1 py-1.5 rounded-full text-[9px] font-bold flex items-center justify-center gap-1.5 ${!isVoiceMode ? "bg-indblue text-white shadow-md" : "text-silver"}`}><MessageSquare size={10} /> TEXT</button>
                  <button onClick={() => setIsVoiceMode(true)} className={`flex-1 py-1.5 rounded-full text-[9px] font-bold flex items-center justify-center gap-1.5 ${isVoiceMode ? "bg-saffron text-white shadow-md" : "text-silver"}`}><Volume2 size={10} /> VOICE</button>
                </div>
                <button onClick={startCall} className="w-full py-3 bg-indblue text-white rounded-xl text-[11px] font-black hover:bg-indblue/90 transition-all flex items-center justify-center gap-2 shadow-lg mb-2">SIMULATE HERE <Zap size={12} className="text-saffron fill-saffron" /></button>
              </div>
            </div>
          )}

          {(callState === "ringing" || callState === "warning") && (
            <div className="flex-1 flex flex-col p-6 fade-in">
              <div className="mt-12 text-center animate-bounce">
                <div className="w-16 h-16 bg-boxbg border-2 border-silver/10 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg text-silver"><User size={32} /></div>
                <h3 className="text-xl font-black text-charcoal tracking-tight">{sessionData?.caller || "UNKNOWN_NODE"}</h3>
                <p className="text-[10px] text-silver font-bold mt-1 tracking-wide">{sessionData?.location || "Scanning Origin..."}</p>
              </div>
              <div className="flex-1 flex flex-col justify-center">
                {callState === "warning" && (
                  <div className="bg-redalert/5 border-2 border-redalert/20 p-4 rounded-2xl animate-pulse">
                    <div className="flex items-center gap-2 mb-2"><ShieldAlert className="text-redalert" size={20} /><p className="text-sm font-black text-redalert tracking-tight uppercase">{isLoading ? "ANALYZING SCRIPT..." : "THREAT_DETECTED"}</p></div>
                    <p className="text-[10px] text-redalert/80 font-bold leading-relaxed">{isLoading ? "Scanning network patterns and voice artifacts..." : "High-probability fraud script matching national risk vectors."}</p>
                  </div>
                )}
              </div>
              <div className="pb-8 space-y-4">
                {callState === "warning" ? (
                  <button onClick={handOffToAI} className="w-full py-4 bg-indblue text-white rounded-[1.5rem] font-black text-xs flex items-center justify-center gap-2 hover:bg-indblue/95 transition-all shadow-xl hover:scale-[1.02]"><Brain size={16} className="text-saffron animate-pulse" /> DEPLOY AI AGENT</button>
                ) : (
                  <p className="text-center text-[10px] font-bold text-silver animate-pulse">Scanning Call Infrastructure...</p>
                )}
                <div className="flex justify-around items-center px-4 pt-4 border-t border-silver/5">
                  <div className="flex flex-col items-center gap-2 group"><div className="w-12 h-12 bg-indgreen rounded-full flex items-center justify-center text-white cursor-pointer shadow-md group-hover:scale-110 transition-transform"><Phone size={24} /></div><span className="text-[9px] font-bold text-silver uppercase tracking-widest">Accept</span></div>
                  <div className="flex flex-col items-center gap-2 group" onClick={() => setCallState("idle")}><div className="w-12 h-12 bg-redalert rounded-full flex items-center justify-center text-white cursor-pointer shadow-md group-hover:scale-110 transition-transform"><X size={24} /></div><span className="text-[9px] font-bold text-silver uppercase tracking-widest">Reject</span></div>
                </div>
              </div>
            </div>
          )}

          {callState === "active" && (
            <div className="flex-1 flex flex-col bg-indblue text-white overflow-hidden fade-in">
              <div className="flex justify-between items-center pt-8 px-5 pb-3 bg-gradient-to-b from-black/20 to-transparent">
                <div className="flex items-center gap-2"><Brain size={16} className="text-saffron animate-pulse" /><div className="flex flex-col"><span className="text-[8px] font-black tracking-[0.2em]">NODE_ACTIVE</span><div className="flex gap-1 items-center mt-0.5">{isVoiceMode && <span className="text-[7px] bg-saffron text-white px-1.5 py-0.5 rounded-sm font-black">VOICE_MODE</span>}</div></div></div>
                <button className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors" onClick={endCall}><X size={12} /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "scammer" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`max-w-[90%] p-3 rounded-2xl text-xs font-medium leading-relaxed shadow-lg ${msg.role === "scammer" ? "bg-saffron/20 border border-saffron/30 text-white rounded-br-none" : "bg-white/10 border border-white/5 text-white/90 rounded-bl-none"}`}>
                      <div className="flex items-center gap-1.5 mb-1.5"><div className={`w-1 h-1 rounded-full ${msg.role === "scammer" ? "bg-saffron" : "bg-indgreen"}`} /><span className="text-[7px] font-black uppercase tracking-widest text-white/50">{msg.role === "scammer" ? "SCAMMER_INPUT" : "DRISHYAM_AI"}</span></div>
                      <p className="tracking-tight">{msg.text}</p>
                      {msg.audioBase64 && <button onClick={() => playAudio(msg.audioBase64!)} className="mt-2 py-1 px-2.5 bg-white/10 rounded-full flex items-center gap-1.5 text-[8px] text-saffron hover:bg-saffron hover:text-white font-black tracking-widest self-start transition-all"><Volume2 size={10} /> REPLAY_VOICE</button>}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/10 border border-white/5 p-3 rounded-2xl rounded-bl-none">
                      <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 bg-saffron rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-saffron rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-saffron rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="px-4 pb-6 pt-3 bg-gradient-to-t from-black/40 to-transparent border-t border-white/5">
                {isVoiceMode ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className={`relative p-0.5 rounded-full ${isRecording ? "scale-105" : "scale-100"} transition-transform`}>{isRecording && <div className="absolute inset-0 bg-redalert/40 rounded-full animate-ping" />}<button onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} disabled={isLoading} className={`relative z-10 p-5 rounded-full transition-all shadow-xl ${isRecording ? "bg-redalert text-white ring-2 ring-redalert/30" : "bg-gradient-to-br from-saffron to-deeporange text-white"} ${isLoading ? "opacity-30 cursor-not-allowed grayscale" : ""}`}>{isLoading ? <Loader2 size={24} className="animate-spin" /> : <Mic size={24} />}</button></div>
                    <span className="text-[8px] text-white/50 font-black uppercase tracking-widest text-center">{isRecording ? "TRANSMITTING..." : "PUSH_TO_TALK"}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="INJECT SCRIPT..." disabled={isLoading} className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-[10px] placeholder:text-white/20 focus:outline-none focus:bg-white/20 text-white disabled:opacity-50 font-bold tracking-tight" />
                    <button onClick={sendMessage} disabled={isLoading || !inputText.trim()} className="p-3 bg-saffron rounded-xl text-white hover:bg-saffron/80 disabled:opacity-30 transition-all shadow-lg"><Send size={14} /></button>
                  </div>
                )}
              </div>
            </div>
          )}

          {callState === "success" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6 bg-gradient-to-b from-boxbg to-white fade-in overflow-y-auto scrollbar-hide">
              <div className="w-16 h-16 rounded-[1.5rem] bg-indgreen flex items-center justify-center text-white shadow-xl shadow-indgreen/20 animate-success"><ShieldCheck size={32} /></div>
              <div className="text-center space-y-1 mb-2"><h4 className="font-black text-indblue text-xl tracking-tighter">NODE_SECURED</h4><p className="text-[10px] text-silver font-bold leading-relaxed px-2">Intelligence extracted successfully uploaded to Grid.</p></div>
              <div className="w-full bg-white rounded-2xl border border-silver/10 shadow-lg overflow-hidden">
                <div className="bg-indblue p-3 text-white flex justify-between items-center"><span className="text-[8px] font-black tracking-widest">INTEL_LOG_V3</span><Brain size={14} className="text-saffron" /></div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between items-center border-b border-silver/5 pb-1"><span className="text-[9px] text-silver font-bold uppercase tracking-widest">PATTERN</span><span className="text-xs font-black text-indblue tracking-tight">{analysis?.analysis?.scam_type || "FRAUD_OPS"}</span></div>
                  <div className="flex justify-between items-center"><span className="text-[9px] text-silver font-bold uppercase tracking-widest">TARGET</span><span className="text-xs font-black text-indblue tracking-tight">{analysis?.analysis?.bank_name || "CENTRAL_GRID"}</span></div>
                </div>
              </div>
              <div className="w-full space-y-3">
                <button onClick={toggleBlock} className={`w-full py-4 rounded-[1.5rem] font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg group ${isBlocked ? "bg-redalert/10 text-redalert border-2 border-redalert/20" : "bg-redalert text-white"}`}>{isBlocked ? <ShieldAlert size={16} /> : <Lock size={16} />}{isBlocked ? "IMEI_PERMA_BLOCKED" : "BLOCK_IMEI_RANGE"}</button>
                <button onClick={() => { setCallState("idle"); setMessages([]); setAnalysis(null); setIsBlocked(false); }} className="w-full text-indblue font-black text-[9px] flex items-center justify-center gap-1.5 py-1.5 opacity-50 hover:opacity-100 transition-opacity tracking-widest uppercase">RE_INITIALIZE <ArrowRight size={12} /></button>
              </div>
            </div>
          )}
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-silver/20 rounded-full" />
      </div>

      {/* Cards Container */}
      <div className="flex flex-row lg:flex-col gap-4 lg:gap-6 w-full lg:w-72 shrink-0 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
        {[
          { icon: Lock, title: "TRAP_GRID", desc: "Live surveillance of scammer audio patterns via ML nodes." },
          { icon: Volume2, title: "BULBUL_v2", desc: "Real-time TTS engine with 99.2% human-parity in Indian dialects." },
          { icon: Brain, title: "DRISHYAM_AI", desc: "Forensic extraction system designed to waste attacker time." }
        ].map((item, i) => (
          <div key={i} className="group p-4 sm:p-6 bg-white rounded-[1.5rem] sm:rounded-[2rem] border border-silver/10 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 min-w-[200px] lg:min-w-0">
            <div className="w-10 h-10 rounded-xl bg-boxbg flex items-center justify-center text-indblue mb-4 group-hover:bg-saffron group-hover:text-white transition-colors"><item.icon size={20} /></div>
            <h4 className="text-[9px] font-black text-indblue uppercase tracking-widest mb-2">{item.title}</h4>
            <p className="text-[10px] text-silver font-medium leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
