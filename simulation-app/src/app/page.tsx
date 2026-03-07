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
  const [customerId, setCustomerId] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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
          persona: selectedPersona?.id || "Sentinel AI",
          customer_id: customerId
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
        setTimeout(() => setCallState("warning"), 2000);
      } else {
        const err = await res.text();
        toast.error(`Shield Initialization Failed: ${err.slice(0, 50)}`);
        setCallState("idle");
      }
    } catch (e) {
      console.error("Failed to initiate monitoring session:", e);
      toast.error("Could not reach Sentinel Command. Check network.");
      setCallState("idle");
    }
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
        setCallState("success"); // Still show success screen but warn user
      }
    } catch (e) {
      console.error("Conclude error:", e);
      toast.error("Network error during intelligence reporting.");
      setCallState("success");
    }
    setIsLoading(false);
  };

  const toggleBlock = () => {
    setIsBlocked(!isBlocked);
    if (!isBlocked) {
      toast.success("IMEI Range Blocked in NCR Region");
    }
  };

  return (
    <div className="relative min-h-screen bg-boxbg neural-grid flex flex-col items-center justify-center py-12 px-4 overflow-hidden selection:bg-saffron/30 selection:text-white">
      <Toaster position="top-center" />

      {/* Neural Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indblue/10 rounded-full blur-[100px] animate-neural" />
        <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-saffron/5 rounded-full blur-[120px] animate-neural [animation-delay:2s]" />
      </div>

      {!isLoggedIn ? (
        <div className="relative w-full max-w-md glass-card rounded-[3rem] p-12 shadow-2xl fade-in border-white/5 group">
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-indblue glass-card rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indblue/40 border-indblue/20">
            <User size={44} className="group-hover:scale-110 transition-transform duration-500" />
          </div>

          <div className="flex flex-col items-center text-center mt-6 mb-10">
            <h2 className="text-3xl font-black text-white tracking-tighter mb-2 group-hover:text-saffron transition-colors">Citizen Login</h2>
            <p className="text-[11px] text-silver font-bold uppercase tracking-[0.2em] opacity-60">Verified Identity Required for Node Entry</p>
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-saffron uppercase tracking-widest ml-1 opacity-80">UID / Phone Architecture</label>
              <div className="relative group/input">
                <input
                  type="text"
                  placeholder="Enter UID or Phone"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-sm font-bold text-white placeholder:text-silver/30 focus:outline-none focus:border-saffron/50 transition-all focus:bg-white/10"
                />
                <div className="absolute right-5 top-1/2 -translate-y-1/2 text-silver/40 group-focus-within/input:text-saffron transition-colors">
                  <ShieldCheck size={20} />
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (customerId.length >= 10) {
                  setIsLoggedIn(true);
                  toast.success(`Identity Verified: ${customerId}`);
                } else {
                  toast.error("Invalid Node ID. Try again.");
                }
              }}
              className="w-full py-5 bg-gradient-to-r from-indblue to-indblue/80 text-white rounded-2xl font-black text-xs hover:from-saffron hover:to-deeporange transition-all shadow-2xl hover:shadow-saffron/20 flex items-center justify-center gap-3 active:scale-95 border border-white/5 uppercase tracking-widest"
            >
              INITIALIZE HANDSHAKE <ArrowRight size={18} />
            </button>

            <div className="pt-6 flex flex-col items-center gap-4">
              <div className="flex items-center gap-3 w-full">
                <div className="h-[1px] flex-1 bg-white/5" />
                <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Node Protocol 7.1</span>
                <div className="h-[1px] flex-1 bg-white/5" />
              </div>
              <p className="text-[8px] text-white/30 font-bold uppercase tracking-widest">Property of Sentinel Operational Grid</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-5xl flex flex-col items-center relative z-10">
          {/* Top Bar */}
          <div className="w-full flex justify-between items-center mb-12 px-2">
            <button
              onClick={() => setIsLoggedIn(false)}
              className="glass-button px-4 py-2 rounded-xl text-[10px] font-black text-white/60 uppercase tracking-widest flex items-center gap-2 hover:text-redalert hover:bg-redalert/10 transition-all border-white/5"
            >
              <X size={14} /> DISCONNECT_NODE
            </button>
            <div className="flex flex-col items-end">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 glass-card rounded-full text-[10px] font-bold tracking-widest uppercase border-white/5">
                <div className="w-2 h-2 rounded-full bg-saffron animate-pulse" />
                <span className="text-white/80">Active Trap: Mewat-NCR Grid</span>
              </div>
              <p className="text-[10px] text-silver/40 mt-2 font-black uppercase tracking-widest">Identity: <span className="text-white/80">{customerId}</span></p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-center gap-16 w-full">
            {/* Phone Interface */}
            <div className="relative w-[340px] h-[690px] bg-[#0F0F13] rounded-[4rem] border-[10px] border-[#1A1A1F] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8),0_0_50px_rgba(255,107,34,0.05)] overflow-hidden transition-all hover:shadow-[0_60px_120px_-20px_rgba(255,107,34,0.15)] group/phone">
              {/* Phone Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-[#1A1A1F] rounded-b-3xl z-30 flex items-center justify-around px-4">
                <div className="w-2 h-2 rounded-full bg-white/5" />
                <div className="w-12 h-1 bg-white/5 rounded-full" />
              </div>

              {/* Screen Content */}
              <div className="relative w-full h-full bg-[#050508] flex flex-col">
                {callState === "idle" && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-10 p-10 fade-in">
                    <div className="relative group/shield">
                      <div className="absolute inset-0 bg-saffron/20 rounded-[2.5rem] blur-2xl group-hover/shield:blur-3xl transition-all duration-700 opacity-50" />
                      <div className="relative w-28 h-28 rounded-[2.5rem] glass-card flex items-center justify-center text-saffron pulse-saffron border-white/10">
                        <ShieldCheck size={52} />
                      </div>
                    </div>

                    <div className="text-center space-y-3">
                      <p className="text-3xl font-black text-white tracking-tighter">Shield Live</p>
                      <div className="space-y-1">
                        <p className="text-[9px] text-saffron font-black uppercase tracking-[0.3em] opacity-80">AI Core Synchronized</p>
                        <p className="text-[9px] text-white/20 font-black uppercase tracking-[0.3em]">Encrypted Handshake OK</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-8 w-full">
                      <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/5 glass-card">
                        <button
                          onClick={() => setIsVoiceMode(false)}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 transition-all ${!isVoiceMode ? "bg-white/10 text-white shadow-xl" : "text-white/30 hover:text-white/60"}`}
                        >
                          <MessageSquare size={14} /> TEXT_OPS
                        </button>
                        <button
                          onClick={() => setIsVoiceMode(true)}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 transition-all ${isVoiceMode ? "bg-saffron text-white shadow-xl" : "text-white/30 hover:text-white/60"}`}
                        >
                          <Volume2 size={14} /> VOICE_OPS
                        </button>
                      </div>

                      <button
                        onClick={startCall}
                        className="w-full py-5 bg-white text-indblue rounded-3xl text-sm font-black hover:bg-saffron hover:text-white transition-all duration-500 flex items-center justify-center gap-3 shadow-2xl hover:-translate-y-1 active:scale-95 uppercase tracking-widest border border-white/10"
                      >
                        ENGAGE TRAP <Zap size={18} className="fill-current" />
                      </button>
                    </div>
                  </div>
                )}

                {(callState === "ringing" || callState === "warning") && (
                  <div className="flex-1 flex flex-col p-10 fade-in bg-gradient-to-b from-indblue/20 to-transparent">
                    <div className="mt-16 text-center">
                      <div className="relative w-24 h-24 bg-white/5 glass-card rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl border-white/10 text-white/40 ring-4 ring-white/5 animate-pulse">
                        <User size={48} />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-3xl font-black text-white tracking-tighter">
                          {sessionData?.caller || "TRACE_IN_PROGRESS"}
                        </h3>
                        <p className="inline-block px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[9px] text-saffron font-black uppercase tracking-[0.2em]">
                          {sessionData?.location || "LOCATING_ORIGIN..."}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                      {callState === "warning" && (
                        <div className="glass-card bg-redalert/10 border-redalert/30 p-6 rounded-[2.5rem] animate-pulse">
                          <div className="flex items-center gap-4 mb-4">
                            <ShieldAlert className="text-redalert" size={28} />
                            <p className="text-lg font-black text-redalert tracking-tighter uppercase">
                              {isLoading ? "ANALYZING..." : "THREAT_FOUND"}
                            </p>
                          </div>
                          <p className="text-[11px] text-white/50 font-bold leading-relaxed">
                            {isLoading ? "Cross-referencing voice artifacts with national fraud registry..." : "High-confidence match with Mewat-style extortion script detected."}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pb-12 space-y-6">
                      {callState === "warning" ? (
                        <button
                          onClick={handOffToAI}
                          className="w-full py-6 bg-white text-indblue rounded-[2.5rem] font-black text-xs flex items-center justify-center gap-3 hover:bg-saffron hover:text-white transition-all duration-500 shadow-2xl hover:scale-105 active:scale-95 border border-white/10 uppercase tracking-[0.2em]"
                        >
                          <Brain size={20} className="animate-pulse" /> DEPLOY_SENTINEL_AI
                        </button>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex gap-2">
                            <div className="w-1.5 h-1.5 bg-silver/20 rounded-full animate-bounce" />
                            <div className="w-1.5 h-1.5 bg-silver/20 rounded-full animate-bounce [animation-delay:0.2s]" />
                            <div className="w-1.5 h-1.5 bg-silver/20 rounded-full animate-bounce [animation-delay:0.4s]" />
                          </div>
                          <p className="text-[9px] font-black text-silver/40 uppercase tracking-widest">Scanning Infrastructure</p>
                        </div>
                      )}

                      <div className="flex justify-around items-center px-4 pt-6 border-t border-white/5">
                        <div className="flex flex-col items-center gap-3 group">
                          <div className="w-16 h-16 bg-indgreen/20 glass-card rounded-full flex items-center justify-center text-indgreen cursor-pointer shadow-xl group-hover:bg-indgreen group-hover:text-white transition-all duration-300 scale-90 group-hover:scale-100"><Phone size={32} /></div>
                          <span className="text-[8px] font-black text-silver/40 uppercase tracking-widest">Accept</span>
                        </div>
                        <div className="flex flex-col items-center gap-3 group">
                          <div className="w-16 h-16 bg-redalert/20 glass-card rounded-full flex items-center justify-center text-redalert cursor-pointer shadow-xl group-hover:bg-redalert group-hover:text-white transition-all duration-300 scale-90 group-hover:scale-100"><X size={32} /></div>
                          <span className="text-[8px] font-black text-silver/40 uppercase tracking-widest">Reject</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {callState === "active" && (
                  <div className="flex-1 flex flex-col bg-[#050508] text-white overflow-hidden fade-in">
                    {/* Active Header */}
                    <div className="flex justify-between items-center pt-12 px-8 pb-6 border-b border-white/5 bg-white/5 glass-card">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="absolute inset-0 bg-saffron/40 rounded-full blur-md animate-pulse" />
                          <Brain size={24} className="relative text-saffron" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black tracking-[0.2em] text-white">SENTINEL_NODE</span>
                          <span className="text-[8px] text-white/40 font-black uppercase tracking-widest mt-0.5">Mewat-Gate-01</span>
                        </div>
                      </div>
                      <button className="glass-button p-2.5 rounded-xl hover:bg-white/10 transition-colors border-white/10" onClick={endCall}>
                        <X size={16} />
                      </button>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-hide">
                      {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === "scammer" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-4 duration-500`}>
                          <div
                            className={`max-w-[85%] p-5 rounded-3xl text-sm font-medium leading-relaxed shadow-2xl ${msg.role === "scammer"
                              ? "bg-white/5 border border-white/10 text-white rounded-br-none"
                              : "bg-saffron/10 border border-saffron/20 text-white rounded-bl-none"
                              }`}
                          >
                            <div className="flex items-center justify-between gap-4 mb-3 border-b border-white/5 pb-2">
                              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">
                                {msg.role === "scammer" ? "SCAMMER_INTENT" : "SENTINEL_COUNTER"}
                              </span>
                              <div className={`w-1.5 h-1.5 rounded-full ${msg.role === "scammer" ? "bg-redalert" : "bg-indgreen"}`} />
                            </div>
                            <p className="tracking-tight leading-loose text-white/90">{msg.text}</p>
                            {msg.audioBase64 && (
                              <button
                                onClick={() => playAudio(msg.audioBase64!)}
                                className="mt-4 py-2 px-4 bg-white/10 rounded-xl flex items-center gap-2 text-[9px] text-saffron hover:bg-saffron hover:text-white font-black tracking-widest transition-all duration-300 border border-white/5"
                              >
                                <Volume2 size={12} /> RE-GENERATE AUDIO
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="glass-card p-5 rounded-3xl rounded-bl-none">
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

                    {/* Active Controls */}
                    <div className="px-8 pb-10 pt-6 bg-white/5 glass-card border-t border-white/5">
                      {isVoiceMode ? (
                        <div className="flex flex-col items-center gap-5">
                          <div className={`relative p-2 rounded-full transform transition-all duration-500 ${isRecording ? "scale-110" : "scale-100 hover:scale-105"}`}>
                            {isRecording && <div className="absolute inset-0 bg-redalert/40 rounded-full animate-ping blur-xl" />}
                            <button
                              onMouseDown={startRecording}
                              onMouseUp={stopRecording}
                              onMouseLeave={stopRecording}
                              onTouchStart={startRecording}
                              onTouchEnd={stopRecording}
                              disabled={isLoading}
                              className={`relative z-10 p-8 rounded-full transition-all duration-500 shadow-[0_20px_40px_rgba(0,0,0,0.4)] ${isRecording
                                ? "bg-redalert text-white ring-8 ring-redalert/20"
                                : "bg-gradient-to-br from-saffron to-deeporange text-white"
                                } ${isLoading ? "opacity-20 cursor-not-allowed grayscale" : ""}`}
                            >
                              {isLoading ? <Loader2 size={36} className="animate-spin" /> : <Mic size={36} />}
                            </button>
                          </div>
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-[9px] text-white/40 font-black uppercase tracking-[0.4em]">
                              {isRecording ? "PACKET_TRANSMISSION" : "HOLD_TO_INJECT"}
                            </span>
                            <div className="flex gap-1">
                              {isRecording && [0, 1, 2, 3].map(i => <div key={i} className="w-1 h-3 bg-redalert rounded-full animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <input
                            ref={inputRef}
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                            placeholder="INJECT SCRIPT PACKET..."
                            disabled={isLoading}
                            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-xs placeholder:text-white/20 focus:outline-none focus:bg-white/10 focus:border-saffron/40 text-white transition-all disabled:opacity-50 font-bold"
                          />
                          <button
                            onClick={sendMessage}
                            disabled={isLoading || !inputText.trim()}
                            className="p-5 bg-saffron rounded-2xl text-white hover:bg-deeporange disabled:opacity-30 transition-all shadow-xl hover:-translate-y-1 active:scale-95"
                          >
                            <Send size={22} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {callState === "success" && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-10 p-10 fade-in bg-gradient-to-b from-[#050508] to-indblue/10 overflow-y-auto scrollbar-hide">
                    <div className="relative">
                      <div className="absolute inset-0 bg-indgreen/30 rounded-[3rem] blur-3xl animate-pulse" />
                      <div className="relative w-24 h-24 rounded-[3rem] bg-indgreen glass-card flex items-center justify-center text-white shadow-2xl border-white/10 animate-success">
                        <ShieldCheck size={52} />
                      </div>
                    </div>

                    <div className="text-center space-y-3">
                      <h4 className="font-black text-white text-3xl tracking-tighter uppercase">Intelligence Locked</h4>
                      <p className="text-[10px] text-silver/60 font-bold leading-relaxed uppercase tracking-widest px-4">
                        Scammer artifacts indexed and forwarded to National Operational Grid.
                      </p>
                    </div>

                    <div className="w-full glass-card rounded-[2.5rem] border-white/10 shadow-2xl overflow-hidden">
                      <div className="bg-white/5 p-5 border-b border-white/5 flex justify-between items-center px-8">
                        <span className="text-[9px] font-black tracking-[0.3em] text-saffron uppercase">Capture_Log_77a</span>
                        <Brain size={18} className="text-white/40" />
                      </div>
                      <div className="p-8 space-y-6">
                        <div className="flex justify-between items-center border-b border-white/5 pb-4">
                          <span className="text-[9px] text-white/30 font-black uppercase tracking-widest">Vector</span>
                          <span className="text-sm font-black text-white tracking-tight">{analysis?.analysis?.scam_type || "GENERIC_FRAUD"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-white/30 font-black uppercase tracking-widest">Target</span>
                          <span className="text-sm font-black text-white tracking-tight">{analysis?.analysis?.bank_name || "CENTRAL_GATEWAY"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full space-y-5">
                      <button
                        onClick={toggleBlock}
                        className={`w-full py-6 rounded-3xl font-black text-xs flex items-center justify-center gap-4 transition-all duration-500 shadow-2xl group border uppercase tracking-[0.2em] ${isBlocked
                          ? "bg-redalert/10 text-redalert border-redalert/20"
                          : "bg-redalert text-white border-white/5 hover:scale-105 active:scale-95"
                          }`}
                      >
                        {isBlocked ? <ShieldAlert size={22} /> : <Lock size={22} />}
                        {isBlocked ? "IMEI_RANGE_LOCKED" : "INITIATE_REGION_BLOCK"}
                      </button>

                      <button
                        onClick={() => { setCallState("idle"); setMessages([]); setAnalysis(null); setIsBlocked(false); }}
                        className="w-full text-white/20 font-black text-[9px] flex items-center justify-center gap-3 py-4 hover:text-saffron transition-all tracking-[0.4em] uppercase"
                      >
                        RE_ENGAGE_PROTOCOL <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Home Indicator */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-white/10 rounded-full" />
            </div>

            {/* Right Panel - Info & Legend */}
            <div className="flex flex-col gap-8 flex-1 max-w-sm">
              <div className="glass-card p-10 rounded-[3rem] border-white/5 shadow-2xl">
                <h3 className="text-xs font-black text-saffron uppercase tracking-[0.3em] mb-8">System Architecture</h3>
                <div className="space-y-10">
                  {[
                    { icon: Lock, title: "TRAP_GRID_OPERATIONAL", desc: "Live surveillance of neural scam patterns via NCR grid nodes." },
                    { icon: Volume2, title: "BULBUL_v2_ACTIVE", desc: "Low-latency TTS engine with 99.2% human-parity across 22 dialects." },
                    { icon: Brain, title: "SENTINEL_AI_CORE", desc: "Tactical extraction logic designed for max duration attacker engagement." }
                  ].map((item, i) => (
                    <div key={i} className="group flex gap-6 items-start">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 glass-card flex items-center justify-center text-saffron shrink-0 group-hover:bg-saffron group-hover:text-white transition-all duration-500 group-hover:scale-110 border-white/5">
                        <item.icon size={20} />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-white uppercase tracking-widest">{item.title}</h4>
                        <p className="text-[10px] text-silver/60 font-bold leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card p-8 rounded-[2.5rem] border-white/5 flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-indgreen/20 glass-card flex items-center justify-center text-indgreen border-white/5">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white/80 uppercase">Node Health</span>
                    <span className="text-[8px] text-indgreen font-black uppercase">99.9% Sync</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[8px] text-white/20 font-black uppercase tracking-[0.2em]">Operational Since</span>
                  <p className="text-[10px] text-white/60 font-bold">07-MAR-2026</p>
                </div>
              </div>
            </div>
          </div>

          <footer className="mt-20 text-center pb-12">
            <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.8em]">National Intelligence Grid | Sentinel Operational Phase 3.0</p>
          </footer>
        </div>
      )}
    </div>
  );
}
