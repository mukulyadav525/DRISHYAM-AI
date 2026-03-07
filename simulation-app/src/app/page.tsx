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
import { Toaster, toast } from "react-hot-toast";

interface Persona {
  id: string;
  label: string;
  lang: string;
}

interface ChatMessage {
  role: "scammer" | "ai";
  text: string;
  audioBase64?: string;
  timestamp: Date;
}

export default function SimulationPortal() {
  const [callState, setCallState] = useState<"idle" | "ringing" | "warning" | "active" | "success">("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [isVoiceMode, setIsVoiceMode] = useState(true); // Default to voice for realistic simulation
  const [autoPlayVoice, setAutoPlayVoice] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [sessionData, setSessionData] = useState<{ id: string; caller: string; location: string } | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    const fetchPersonas = async () => {
      try {
        const res = await fetch(`${API_BASE}/voice/personas`);
        if (res.ok) {
          const data = await res.json();
          const formatted = data.personas.map((p: any) => ({
            id: p.name,
            label: `${p.speaker === 'Male' ? '👨' : '👩'} ${p.name}`,
            lang: p.language === 'hi-IN' ? 'Hindi' : p.language === 'en-IN' ? 'English' : p.language
          }));
          setPersonas(formatted);
          if (formatted.length > 0) setSelectedPersona(formatted[0]);
        }
      } catch (error) {
        console.error("Error fetching personas:", error);
      }
    };
    fetchPersonas();
  }, []);

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
      // Initiate backend session for real-time monitoring
      const res = await fetch(`${API_BASE}/honeypot/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: selectedPersona?.id || "Sentinel AI"
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.session_id);
        setSessionData({
          id: data.session_id,
          caller: data.caller_num || "+91-TRACE-NODE",
          location: "SCANNING..." // Will be updated by detection engine
        });
        console.log("Monitoring session active:", data.session_id);
      }
    } catch (e) {
      console.error("Failed to initiate monitoring session:", e);
    }

    setTimeout(() => setCallState("warning"), 2000);
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await processVoiceAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access denied:", error);
      toast.error("Microphone access is required for voice mode.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoiceAudio = async (blob: Blob) => {
    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];

        if (!base64data || base64data.length < 50) {
          setMessages(prev => [...prev, {
            role: "ai",
            text: "⚠️ Recording too short. Hold the microphone button longer while speaking.",
            timestamp: new Date(),
          }]);
          setIsLoading(false);
          return;
        }

        try {
          const res = await fetch(`${API_BASE}/voice/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audio_base64: base64data,
              persona: selectedPersona?.id || "Sentinel AI",
              language: "hi-IN",
              session_id: sessionId, // Track session on backend
              history: messages.map(m => ({
                role: m.role === "scammer" ? "user" : "assistant",
                content: m.text,
              }))
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const transcript = data.scammer_transcript || "";
            if (transcript.length > 0) {
              setMessages(prev => [...prev, {
                role: "scammer",
                text: transcript,
                timestamp: new Date(),
              }]);
            } else {
              setMessages(prev => [...prev, {
                role: "scammer",
                text: "🎤 (Voice not captured clearly — try speaking louder)",
                timestamp: new Date(),
              }]);
            }

            const aiMsg: ChatMessage = {
              role: "ai",
              text: data.ai_response_text,
              audioBase64: data.ai_audio_base64,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, aiMsg]);

            if (autoPlayVoice && data.ai_audio_base64) {
              playAudio(data.ai_audio_base64);
            }
          } else {
            setMessages(prev => [...prev, {
              role: "ai",
              text: `⚠️ [System Error: Voice Engine Issue]. Try using Text Mode.`,
              timestamp: new Date(),
            }]);
          }
        } catch (fetchErr) {
          console.error("Voice fetch failed:", fetchErr);
          setMessages(prev => [...prev, {
            role: "ai",
            text: "⚠️ [System: Could not reach voice server.]",
            timestamp: new Date(),
          }]);
        }
        setIsLoading(false);
      };
    } catch (e) {
      console.error("Processing audio failed:", e);
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    const scammerMsg: ChatMessage = {
      role: "scammer",
      text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, scammerMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const chatRes = await fetch(`${API_BASE}/honeypot/direct-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          persona: selectedPersona?.id || "Elderly Uncle",
          session_id: sessionId, // Track session on backend
          history: messages.map(m => ({
            role: m.role === "scammer" ? "user" : "assistant",
            content: m.text,
          }))
        }),
      });

      let aiText = "⚠️ [System: AI generation failed.]";
      if (chatRes.ok) {
        const chatData = await chatRes.json();
        aiText = chatData.response;
      }

      const aiMsg: ChatMessage = {
        role: "ai",
        text: aiText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);

      if (isVoiceMode) {
        const ttsRes = await fetch(`${API_BASE}/voice/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: aiText,
            persona: selectedPersona?.id || "Elderly Uncle",
          }),
        });

        if (ttsRes.ok) {
          const ttsData = await ttsRes.json();
          if (ttsData.audio_base64) {
            setMessages(prev => prev.map((m, idx) => idx === prev.length - 1 ? { ...m, audioBase64: ttsData.audio_base64 } : m));
            if (autoPlayVoice) playAudio(ttsData.audio_base64);
          }
        }
      }
    } catch (error) {
      console.error("Text chat error:", error);
      setMessages(prev => [...prev, {
        role: "ai",
        text: "⚠️ [System: API Connection Interrupted.]",
        timestamp: new Date(),
      }]);
    }
    setIsLoading(false);
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
          session_id: sessionId, // Finalize session on backend
          history: messages.map(m => ({
            role: m.role === "scammer" ? "user" : "assistant",
            content: m.text,
          }))
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      }
    } catch (e) {
      console.error("Conclude error:", e);
    }
    setIsLoading(false);
    setCallState("success");
  };

  const toggleBlock = () => {
    setIsBlocked(!isBlocked);
    if (!isBlocked) {
      toast.success("IMEI Range Blocked in NCR Region");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-boxbg/50 py-12 px-4">
      <Toaster position="top-center" />

      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indblue/10 text-indblue rounded-full text-[10px] font-bold tracking-widest uppercase mb-4">
          <ShieldCheck size={14} /> Official Trap Node: Mewat-NCR
        </div>
        <h2 className="text-4xl font-extrabold text-indblue tracking-tight">Sentinel Trace</h2>
        <p className="text-silver mt-2 font-medium">Global AI Fraud-Interception Portal</p>
      </div>

      <div className="relative w-[340px] h-[680px] bg-charcoal rounded-[3.5rem] border-[12px] border-charcoal shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden transition-all hover:shadow-[0_60px_120px_-20px_rgba(255,107,34,0.1)]">
        {/* Phone Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-charcoal rounded-b-3xl z-30" />

        {/* Screen Content */}
        <div className="relative w-full h-full bg-white flex flex-col">
          {callState === "idle" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8 fade-in">
              <div className="w-24 h-24 rounded-3xl bg-boxbg flex items-center justify-center text-indblue pulse-saffron shadow-inner">
                <ShieldCheck size={48} />
              </div>
              <div className="text-center space-y-2">
                <p className="text-2xl font-black text-indblue">Shield Ready</p>
                <p className="text-[10px] text-silver font-bold uppercase tracking-widest leading-relaxed">
                  Secure Line Established<br />AI Core Synchronized
                </p>
              </div>

              <div className="flex flex-col gap-6 w-full max-w-[200px]">
                <div className="flex bg-boxbg p-1 rounded-full border border-silver/10">
                  <button
                    onClick={() => setIsVoiceMode(false)}
                    className={`flex-1 py-2 rounded-full text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${!isVoiceMode ? "bg-indblue text-white shadow-md" : "text-silver hover:text-charcoal"}`}
                  >
                    <MessageSquare size={12} /> TEXT
                  </button>
                  <button
                    onClick={() => setIsVoiceMode(true)}
                    className={`flex-1 py-2 rounded-full text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${isVoiceMode ? "bg-saffron text-white shadow-md" : "text-silver hover:text-charcoal"}`}
                  >
                    <Volume2 size={12} /> VOICE
                  </button>
                </div>

                <button
                  onClick={startCall}
                  className="w-full py-4 bg-indblue text-white rounded-2xl text-sm font-black hover:bg-indblue/90 transition-all flex items-center justify-center gap-2 shadow-xl hover:-translate-y-1 active:scale-95"
                >
                  START TRAP <Zap size={16} className="text-saffron fill-saffron" />
                </button>
              </div>
            </div>
          )}

          {(callState === "ringing" || callState === "warning") && (
            <div className="flex-1 flex flex-col p-8 fade-in">
              <div className="mt-16 text-center animate-bounce">
                <div className="w-20 h-20 bg-boxbg border-2 border-silver/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl text-silver">
                  <User size={40} />
                </div>
                <h3 className="text-2xl font-black text-charcoal tracking-tight">
                  {sessionData?.caller || "UNKNOWN_NODE"}
                </h3>
                <p className="text-xs text-silver font-bold mt-2 tracking-wide">
                  {sessionData?.location || "Scanning Origin..."}
                </p>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                {callState === "warning" && (
                  <div className="bg-redalert/5 border-2 border-redalert/20 p-5 rounded-3xl animate-pulse">
                    <div className="flex items-center gap-3 mb-3">
                      <ShieldAlert className="text-redalert" size={24} />
                      <p className="text-base font-black text-redalert tracking-tight uppercase">
                        {isLoading ? "ANALYZING SCRIPT..." : "THREAT_DETECTED"}
                      </p>
                    </div>
                    <p className="text-[11px] text-redalert/80 font-bold leading-relaxed">
                      {isLoading ? "Scanning network patterns and voice artifacts..." : "High-probability fraud script matching national risk vectors."}
                    </p>
                  </div>
                )}
              </div>

              <div className="pb-12 space-y-5">
                {callState === "warning" ? (
                  <button
                    onClick={handOffToAI}
                    className="w-full py-5 bg-indblue text-white rounded-[2rem] font-black text-sm flex items-center justify-center gap-3 hover:bg-indblue/95 transition-all shadow-2xl hover:scale-[1.02]"
                  >
                    <Brain size={20} className="text-saffron animate-pulse" /> DEPLOY AI AGENT
                  </button>
                ) : (
                  <p className="text-center text-xs font-bold text-silver animate-pulse">Scanning Call Infrastructure...</p>
                )}
                <div className="flex justify-around items-center px-4 pt-4 border-t border-silver/5">
                  <div className="flex flex-col items-center gap-3 group">
                    <div className="w-14 h-14 bg-indgreen rounded-full flex items-center justify-center text-white cursor-pointer shadow-lg group-hover:scale-110 transition-transform"><Phone size={28} /></div>
                    <span className="text-[10px] font-bold text-silver uppercase tracking-widest">Accept</span>
                  </div>
                  <div className="flex flex-col items-center gap-3 group">
                    <div className="w-14 h-14 bg-redalert rounded-full flex items-center justify-center text-white cursor-pointer shadow-lg group-hover:scale-110 transition-transform"><X size={28} /></div>
                    <span className="text-[10px] font-bold text-silver uppercase tracking-widest">Reject</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {callState === "active" && (
            <div className="flex-1 flex flex-col bg-indblue text-white overflow-hidden fade-in">
              {/* Header */}
              <div className="flex justify-between items-center pt-10 px-6 pb-4 bg-gradient-to-b from-black/20 to-transparent">
                <div className="flex items-center gap-3">
                  <Brain size={20} className="text-saffron animate-pulse" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black tracking-[0.2em]">NODE_ACTIVE</span>
                    <div className="flex gap-1 items-center mt-1">
                      {isVoiceMode && (
                        <span className="text-[8px] bg-saffron text-white px-2 py-0.5 rounded-sm font-black">
                          VOICE_MODE
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button className="p-2.5 bg-white/10 rounded-full hover:bg-white/20 transition-colors" onClick={endCall}>
                  <X size={14} />
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-hide">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "scammer" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-2 duration-300`}>
                    <div
                      className={`max-w-[90%] p-4 rounded-3xl text-xs font-medium leading-relaxed shadow-sm ${msg.role === "scammer"
                        ? "bg-saffron/10 border border-saffron/20 text-white rounded-br-none"
                        : "bg-white/5 border border-white/5 text-white/90 rounded-bl-none"
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${msg.role === "scammer" ? "bg-saffron" : "bg-indgreen"}`} />
                        <span className="text-[8px] font-black uppercase tracking-widest text-silver">
                          {msg.role === "scammer" ? "SCAMMER_INPUT" : "SENTINEL_AI"}
                        </span>
                      </div>
                      <p className="tracking-tight">{msg.text}</p>
                      {msg.audioBase64 && (
                        <button
                          onClick={() => playAudio(msg.audioBase64!)}
                          className="mt-3 py-1.5 px-3 bg-white/5 rounded-full flex items-center gap-2 text-[9px] text-saffron hover:bg-white/10 font-black tracking-widest self-start transition-all"
                        >
                          <Volume2 size={12} /> REPLAY_VOICE
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 border border-white/5 p-4 rounded-3xl rounded-bl-none">
                      <div className="flex gap-2">
                        <div className="w-2 h-2 bg-saffron rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-saffron rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-2 h-2 bg-saffron rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Bar */}
              <div className="px-5 pb-8 pt-4 bg-gradient-to-t from-black/40 to-transparent border-t border-white/5">
                {isVoiceMode ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className={`relative p-1 rounded-full ${isRecording ? "scale-110" : "scale-100"} transition-transform`}>
                      {isRecording && <div className="absolute inset-0 bg-redalert/40 rounded-full animate-ping" />}
                      <button
                        onMouseDown={startRecording}
                        onMouseUp={stopRecording}
                        onMouseLeave={stopRecording}
                        onTouchStart={startRecording}
                        onTouchEnd={stopRecording}
                        disabled={isLoading}
                        className={`relative z-10 p-6 rounded-full transition-all shadow-2xl ${isRecording
                          ? "bg-redalert text-white ring-4 ring-redalert/30"
                          : "bg-gradient-to-br from-saffron to-deeporange text-white hover:rotate-12"
                          } ${isLoading ? "opacity-30 cursor-not-allowed grayscale" : ""}`}
                      >
                        {isLoading ? <Loader2 size={32} className="animate-spin" /> : <Mic size={32} />}
                      </button>
                    </div>
                    <span className="text-[10px] text-silver font-black uppercase tracking-widest text-center">
                      {isRecording ? "TRANSMITTING..." : "PUSH_TO_TALK"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="INJECT SCRIPT..."
                      disabled={isLoading}
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs placeholder:text-white/20 focus:outline-none focus:bg-white/10 text-white disabled:opacity-50 font-bold tracking-tight"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={isLoading || !inputText.trim()}
                      className="p-4 bg-saffron rounded-2xl text-white hover:bg-saffron/80 disabled:opacity-30 transition-all shadow-xl"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                )}

                <div className="flex justify-between mt-6 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-saffron animate-pulse" />
                    <span className="text-[9px] text-silver font-black uppercase tracking-widest">
                      {messages.length} CYCLES_SENT
                    </span>
                  </div>
                  <span className="text-[9px] text-indgreen font-black uppercase tracking-widest animate-pulse">
                    MONITORING_ACTIVE
                  </span>
                </div>
              </div>
            </div>
          )}

          {callState === "success" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 bg-gradient-to-b from-boxbg to-white fade-in overflow-y-auto">
              <div className="w-20 h-20 rounded-[2rem] bg-indgreen flex items-center justify-center text-white shadow-2xl shadow-indgreen/30 animate-success">
                <ShieldCheck size={40} />
              </div>

              <div className="text-center space-y-2 mb-4">
                <h4 className="font-black text-indblue text-2xl tracking-tighter">NODE_SECURED</h4>
                <p className="text-[11px] text-silver font-bold leading-relaxed px-4">
                  Intelligence extracted from scammer has been successfully uploaded to the National Fraud Repository.
                </p>
              </div>

              <div className="w-full bg-white rounded-3xl border border-silver/10 shadow-xl overflow-hidden">
                <div className="bg-indblue p-4 text-white flex justify-between items-center">
                  <span className="text-[10px] font-black tracking-widest">INTEL_LOG_V3</span>
                  <Brain size={16} className="text-saffron" />
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center border-b border-silver/5 pb-2">
                    <span className="text-xs text-silver font-bold uppercase tracking-widest">PATTERN</span>
                    <span className="text-sm font-black text-indblue tracking-tight">{analysis?.analysis?.scam_type || "FRAUD_OPS"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-silver font-bold uppercase tracking-widest">TARGET</span>
                    <span className="text-sm font-black text-indblue tracking-tight">{analysis?.analysis?.bank_name || "CENTRAL_GRID"}</span>
                  </div>
                </div>
              </div>

              <div className="w-full space-y-4">
                <button
                  onClick={toggleBlock}
                  className={`w-full py-5 rounded-[2rem] font-black text-sm flex items-center justify-center gap-3 transition-all shadow-xl group ${isBlocked
                    ? "bg-redalert/10 text-redalert border-2 border-redalert/20"
                    : "bg-redalert text-white hover:shadow-redalert/30"
                    }`}
                >
                  {isBlocked ? <ShieldAlert size={20} /> : <Lock size={20} />}
                  {isBlocked ? "IMEI_PERMA_BLOCKED" : "BLOCK_IMEI_RANGE"}
                </button>

                <button
                  onClick={() => { setCallState("idle"); setMessages([]); setAnalysis(null); setIsBlocked(false); }}
                  className="w-full text-indblue font-black text-[11px] flex items-center justify-center gap-2 py-2 opacity-50 hover:opacity-100 transition-opacity tracking-widest uppercase"
                >
                  RE_INITIALIZE <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-28 h-1.5 bg-silver/20 rounded-full" />
      </div>

      <div className="mt-16 max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
        {[
          { icon: Lock, title: "TRAP_GRID", desc: "Live surveillance of scammer audio patterns via ML nodes." },
          { icon: Volume2, title: "BULBUL_v2", desc: "Real-time TTS engine with 99.2% human-parity in Indian dialects." },
          { icon: Brain, title: "SENTINEL_AI", desc: "Forensic extraction system designed to waste attacker time." }
        ].map((item, i) => (
          <div key={i} className="group p-8 bg-white rounded-[2.5rem] border border-silver/10 shadow-sm hover:shadow-xl transition-all hover:-translate-y-2">
            <div className="w-12 h-12 rounded-2xl bg-boxbg flex items-center justify-center text-indblue mb-6 group-hover:bg-saffron group-hover:text-white transition-colors">
              <item.icon size={24} />
            </div>
            <h4 className="text-xs font-black text-indblue uppercase tracking-widest mb-3">{item.title}</h4>
            <p className="text-xs text-silver font-medium leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <footer className="mt-20 text-center">
        <p className="text-[10px] font-black text-silver/40 uppercase tracking-[0.5em]">For A Secured Digital India | Sentinel Protection</p>
      </footer>
    </div>
  );
}
