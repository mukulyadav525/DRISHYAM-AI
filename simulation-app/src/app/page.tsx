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
  const [authStatus, setAuthStatus] = useState<"login" | "pending" | "approved">("login");
  const [activeFeature, setActiveFeature] = useState<"chat" | "deepfake" | "upi" | null>(null);
  const [isVideoMode, setIsVideoMode] = useState(false);

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

  const speechRecRef = useRef<any>(null);
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // ── Real-Time Voice Processing via Backend (Sarvam Saaras + Bulbul) ──
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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          await processVoiceAudio(base64Audio);
        };
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
      toast.error("Microphone access denied. Grant permissions in browser.");
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
      // Use the unified voice chat endpoint (STT -> AI -> TTS)
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

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      const data = await res.json();

      // 1. Add Scammer Message (from STT)
      if (data.scammer_transcript) {
        setMessages(prev => [...prev, {
          role: "scammer",
          text: data.scammer_transcript,
          timestamp: new Date(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: "scammer",
          text: "🎤 (Voice not captured clearly — try speaking louder)",
          timestamp: new Date(),
        }]);
      }

      // 2. Add AI Message (from LLM)
      const aiMsg: ChatMessage = {
        role: "ai",
        text: data.ai_response_text,
        audioBase64: data.ai_audio_base64,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);

      // 3. Play AI Voice
      if (data.ai_audio_base64 && autoPlayVoice) {
        playAudio(data.ai_audio_base64);
      }

    } catch (error) {
      console.error("Voice pipeline failed:", error);
      toast.error("Voice Processing Error. Check Backend Connection.");
    }
    setIsLoading(false);
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
    <div className="flex flex-col items-center justify-center h-screen bg-boxbg overflow-hidden p-4 selection:bg-indblue/10 selection:text-indblue">
      <Toaster position="top-center" />

      {authStatus === "login" && (
        <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl border border-silver/10 fade-in">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-20 h-20 bg-indblue rounded-3xl flex items-center justify-center text-white mb-6 shadow-xl shadow-indblue/20">
              <User size={40} />
            </div>
            <h2 className="text-3xl font-black text-indblue tracking-tight mb-2">Citizen Login</h2>
            <p className="text-sm text-silver font-medium">Verify your phone to enter the protective grid.</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-indblue uppercase tracking-widest ml-1">Phone Number</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter 10-digit Phone Number"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full bg-boxbg border border-silver/20 rounded-2xl px-5 py-4 text-sm font-bold text-indblue focus:outline-none focus:border-indblue transition-all"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-silver">
                  <Phone size={20} />
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (customerId.length >= 10) {
                  setAuthStatus("pending");
                  toast.success(`Request Sent for approval: ${customerId}`);
                } else {
                  toast.error("Please enter a valid Phone Number");
                }
              }}
              className="w-full py-5 bg-indblue text-white rounded-2xl font-black text-sm hover:bg-indblue/90 transition-all shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              REQUEST ACCESS <ArrowRight size={18} />
            </button>

            <div className="pt-4 flex items-center gap-3">
              <div className="h-[1px] flex-1 bg-silver/10" />
              <span className="text-[10px] font-black text-silver/40 uppercase tracking-[0.2em]">Secured by BASIG</span>
              <div className="h-[1px] flex-1 bg-silver/10" />
            </div>
          </div>
        </div>
      )}

      {authStatus === "pending" && (
        <div className="w-full max-w-md bg-white rounded-[3rem] p-12 shadow-2xl border border-silver/10 text-center fade-in">
          <div className="w-24 h-24 bg-saffron/10 text-saffron rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
            <Loader2 size={48} className="animate-spin" />
          </div>
          <h2 className="text-3xl font-black text-indblue mb-4 tracking-tight">Access Pending</h2>
          <p className="text-silver text-sm font-medium mb-10 px-4">
            Security clearance is being verified by the National Command Dashboard. Please wait for official approval.
          </p>
          
          <button
            onClick={() => {
              setAuthStatus("approved");
              toast.success("Identity Clear: Access Granted");
            }}
            className="w-full py-5 bg-indgreen text-white rounded-2xl font-black text-sm hover:bg-indgreen/90 transition-all shadow-xl shadow-indgreen/20 flex items-center justify-center gap-3"
          >
            <ShieldCheck size={20} /> SIMULATE ADMIN APPROVAL
          </button>
        </div>
      )}

      {authStatus === "approved" && !activeFeature && (
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8 p-6 fade-in">
          <div className="col-span-1 md:col-span-3 text-center mb-6">
            <h2 className="text-4xl font-black text-indblue tracking-tighter mb-2">Unified Defense Simulation</h2>
            <p className="text-silver text-sm font-bold uppercase tracking-[0.2em]">Select an anti-fraud operational module</p>
          </div>

          {/* Feature 1: Chat */}
          <button
            onClick={() => setActiveFeature("chat")}
            className="group bg-white p-8 rounded-[2.5rem] border border-silver/10 shadow-lg hover:shadow-2xl hover:border-indblue/20 transition-all flex flex-col items-center text-center"
          >
            <div className="w-20 h-20 bg-indblue/5 text-indblue rounded-3xl flex items-center justify-center mb-8 group-hover:bg-indblue group-hover:text-white transition-all transform group-hover:-translate-y-2">
              <Mic size={36} />
            </div>
            <h3 className="text-2xl font-black text-indblue mb-4">Voice & Video</h3>
            <p className="text-xs text-silver font-medium leading-relaxed mb-6">Interactive AI Honeypot to intercept and analyze scam caller tactics in real-time.</p>
            <div className="mt-auto flex items-center gap-2 text-[10px] font-black text-indblue uppercase tracking-widest opacity-40 group-hover:opacity-100">
              Initialize Ops <ArrowRight size={14} />
            </div>
          </button>

          {/* Feature 2: Deepfake */}
          <button
            onClick={() => setActiveFeature("deepfake")}
            className="group bg-white p-8 rounded-[2.5rem] border border-silver/10 shadow-lg hover:shadow-2xl hover:border-saffron/20 transition-all flex flex-col items-center text-center"
          >
            <div className="w-20 h-20 bg-saffron/5 text-saffron rounded-3xl flex items-center justify-center mb-8 group-hover:bg-saffron group-hover:text-white transition-all transform group-hover:-translate-y-2">
              <ShieldAlert size={36} />
            </div>
            <h3 className="text-2xl font-black text-indblue mb-4">Deepfake Defense</h3>
            <p className="text-xs text-silver font-medium leading-relaxed mb-6">Visual forensics to detect synthetic identity manipulations and biometric bypass attempts.</p>
            <div className="mt-auto flex items-center gap-2 text-[10px] font-black text-saffron uppercase tracking-widest opacity-40 group-hover:opacity-100">
              Deploy Shield <ArrowRight size={14} />
            </div>
          </button>

          {/* Feature 3: UPI Shield */}
          <button
            onClick={() => setActiveFeature("upi")}
            className="group bg-white p-8 rounded-[2.5rem] border border-silver/10 shadow-lg hover:shadow-2xl hover:border-indgreen/20 transition-all flex flex-col items-center text-center"
          >
            <div className="w-20 h-20 bg-indgreen/5 text-indgreen rounded-3xl flex items-center justify-center mb-8 group-hover:bg-indgreen group-hover:text-white transition-all transform group-hover:-translate-y-2">
              <Zap size={36} />
            </div>
            <h3 className="text-2xl font-black text-indblue mb-4">UPI Armor</h3>
            <p className="text-xs text-silver font-medium leading-relaxed mb-6">Secure payment simulation with instant merchant verification and risk scoring.</p>
            <div className="mt-auto flex items-center gap-2 text-[10px] font-black text-indgreen uppercase tracking-widest opacity-40 group-hover:opacity-100">
              Secure App <ArrowRight size={14} />
            </div>
          </button>
          
          <div className="col-span-1 md:col-span-3 text-center mt-8">
            <button
              onClick={() => setAuthStatus("login")}
              className="text-[10px] font-black text-silver hover:text-indblue transition-colors uppercase tracking-[0.2em]"
            >
              Termination Session <X size={10} className="inline ml-1" />
            </button>
          </div>
        </div>
      )}

      {authStatus === "approved" && activeFeature && (
        <div className="flex flex-col items-center w-full max-w-6xl h-full py-2 fade-in">
          {/* Header */}
          <div className="text-center mb-4 w-full relative shrink-0">
            <button
              onClick={() => setActiveFeature(null)}
              className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] font-black text-indblue uppercase tracking-widest flex items-center gap-1 hover:text-saffron transition-colors"
            >
              <X size={14} /> Back to Hub
            </button>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indblue/10 text-indblue rounded-full text-[10px] font-bold tracking-widest uppercase mb-1">
              <ShieldCheck size={12} /> Active Node: {activeFeature === 'chat' ? 'Voice_INT' : activeFeature === 'deepfake' ? 'Visual_DF' : 'Fin_Sec'}
            </div>
            <h2 className="text-3xl font-extrabold text-indblue tracking-tight">
              {activeFeature === 'chat' && "Sentinel Voice/Video Trace"}
              {activeFeature === 'deepfake' && "Sentinel Deepfake Defense"}
              {activeFeature === 'upi' && "Sentinel UPI Armor"}
            </h2>
          </div>

          {activeFeature === 'chat' && (
            <div className="flex flex-row items-center justify-center gap-12 w-full flex-1 min-h-0">
            {/* Phone Container */}
            <div className="relative w-[320px] h-[600px] bg-charcoal rounded-[3rem] border-[10px] border-charcoal shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] overflow-hidden transition-all shrink-0">
              {/* Phone Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-charcoal rounded-b-2xl z-30" />

              {/* Screen Content */}
              <div className="relative w-full h-full bg-white flex flex-col">
                {callState === "idle" && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6 fade-in">
                    <div className="w-20 h-20 rounded-2xl bg-boxbg flex items-center justify-center text-indblue pulse-saffron shadow-inner">
                      <ShieldCheck size={40} />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xl font-black text-indblue">Shield Ready</p>
                      <p className="text-[9px] text-silver font-bold uppercase tracking-widest leading-relaxed">
                        Secure Line Established<br />AI Core Synchronized
                      </p>
                    </div>

                    <div className="flex flex-col gap-4 w-full max-w-[180px]">
                      <div className="flex bg-boxbg p-1 rounded-full border border-silver/10">
                        <button
                          onClick={() => setIsVoiceMode(false)}
                          className={`flex-1 py-1.5 rounded-full text-[9px] font-bold flex items-center justify-center gap-1 transition-all ${!isVoiceMode ? "bg-indblue text-white shadow-md" : "text-silver hover:text-charcoal"}`}
                        >
                          <MessageSquare size={10} /> TEXT
                        </button>
                        <button
                          onClick={() => setIsVoiceMode(true)}
                          className={`flex-1 py-1.5 rounded-full text-[9px] font-bold flex items-center justify-center gap-1 transition-all ${isVoiceMode ? "bg-saffron text-white shadow-md" : "text-silver hover:text-charcoal"}`}
                        >
                          <Volume2 size={10} /> VOICE
                        </button>
                      </div>

                      <button
                        onClick={startCall}
                        className="w-full py-3.5 bg-indblue text-white rounded-xl text-xs font-black hover:bg-indblue/90 transition-all flex items-center justify-center gap-2 shadow-lg hover:-translate-y-0.5 active:scale-95"
                      >
                        START TRAP <Zap size={14} className="text-saffron fill-saffron" />
                      </button>
                    </div>
                  </div>
                )}

                {(callState === "ringing" || callState === "warning") && (
                  <div className="flex-1 flex flex-col p-6 fade-in">
                    <div className="mt-12 text-center animate-bounce">
                      <div className="w-16 h-16 bg-boxbg border-2 border-silver/10 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg text-silver">
                        <User size={32} />
                      </div>
                      <h3 className="text-xl font-black text-charcoal tracking-tight">
                        {sessionData?.caller || "UNKNOWN_NODE"}
                      </h3>
                      <p className="text-[10px] text-silver font-bold mt-1 tracking-wide">
                        {sessionData?.location || "Scanning Origin..."}
                      </p>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                      {callState === "warning" && (
                        <div className="bg-redalert/5 border-2 border-redalert/20 p-4 rounded-2xl animate-pulse">
                          <div className="flex items-center gap-2 mb-2">
                            <ShieldAlert className="text-redalert" size={20} />
                            <p className="text-sm font-black text-redalert tracking-tight uppercase">
                              {isLoading ? "ANALYZING SCRIPT..." : "THREAT_DETECTED"}
                            </p>
                          </div>
                          <p className="text-[10px] text-redalert/80 font-bold leading-relaxed">
                            {isLoading ? "Scanning network patterns and voice artifacts..." : "High-probability fraud script matching national risk vectors."}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pb-8 space-y-4">
                      {callState === "warning" ? (
                        <button
                          onClick={handOffToAI}
                          className="w-full py-4 bg-indblue text-white rounded-[1.5rem] font-black text-xs flex items-center justify-center gap-2 hover:bg-indblue/95 transition-all shadow-xl hover:scale-[1.02]"
                        >
                          <Brain size={16} className="text-saffron animate-pulse" /> DEPLOY AI AGENT
                        </button>
                      ) : (
                        <p className="text-center text-[10px] font-bold text-silver animate-pulse">Scanning Call Infrastructure...</p>
                      )}
                      <div className="flex justify-around items-center px-4 pt-4 border-t border-silver/5">
                        <div className="flex flex-col items-center gap-2 group">
                          <div className="w-12 h-12 bg-indgreen rounded-full flex items-center justify-center text-white cursor-pointer shadow-md group-hover:scale-110 transition-transform"><Phone size={24} /></div>
                          <span className="text-[9px] font-bold text-silver uppercase tracking-widest">Accept</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 group">
                          <div className="w-12 h-12 bg-redalert rounded-full flex items-center justify-center text-white cursor-pointer shadow-md group-hover:scale-110 transition-transform"><X size={24} /></div>
                          <span className="text-[9px] font-bold text-silver uppercase tracking-widest">Reject</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {callState === "active" && (
                  <div className="flex-1 flex flex-col bg-indblue text-white overflow-hidden fade-in">
                    {/* Header */}
                    <div className="flex justify-between items-center pt-8 px-5 pb-3 bg-gradient-to-b from-black/20 to-transparent">
                      <div className="flex items-center gap-2">
                        <Brain size={16} className="text-saffron animate-pulse" />
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black tracking-[0.2em]">NODE_ACTIVE</span>
                          <div className="flex gap-1 items-center mt-0.5">
                            {isVoiceMode && (
                              <span className="text-[7px] bg-saffron text-white px-1.5 py-0.5 rounded-sm font-black">
                                VOICE_MODE
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors" onClick={endCall}>
                        <X size={12} />
                      </button>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide">
                      {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === "scammer" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-2 duration-300`}>
                          <div
                            className={`max-w-[90%] p-3 rounded-2xl text-xs font-medium leading-relaxed shadow-lg ${msg.role === "scammer"
                              ? "bg-saffron/20 border border-saffron/30 text-white rounded-br-none"
                              : "bg-white/10 border border-white/5 text-white/90 rounded-bl-none"
                              }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <div className={`w-1 h-1 rounded-full ${msg.role === "scammer" ? "bg-saffron" : "bg-indgreen"}`} />
                              <span className="text-[7px] font-black uppercase tracking-widest text-white/50">
                                {msg.role === "scammer" ? "SCAMMER_INPUT" : "SENTINEL_AI"}
                              </span>
                            </div>
                            <p className="tracking-tight">{msg.text}</p>
                            {msg.audioBase64 && (
                              <button
                                onClick={() => playAudio(msg.audioBase64!)}
                                className="mt-2 py-1 px-2.5 bg-white/10 rounded-full flex items-center gap-1.5 text-[8px] text-saffron hover:bg-saffron hover:text-white font-black tracking-widest self-start transition-all"
                              >
                                <Volume2 size={10} /> REPLAY_VOICE
                              </button>
                            )}
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

                    {/* Input Bar */}
                    <div className="px-4 pb-6 pt-3 bg-gradient-to-t from-black/40 to-transparent border-t border-white/5">
                      {isVoiceMode ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className={`relative p-0.5 rounded-full ${isRecording ? "scale-105" : "scale-100"} transition-transform`}>
                            {isRecording && <div className="absolute inset-0 bg-redalert/40 rounded-full animate-ping" />}
                            <button
                              onMouseDown={startRecording}
                              onMouseUp={stopRecording}
                              onMouseLeave={stopRecording}
                              onTouchStart={startRecording}
                              onTouchEnd={stopRecording}
                              disabled={isLoading}
                              className={`relative z-10 p-5 rounded-full transition-all shadow-xl ${isRecording
                                ? "bg-redalert text-white ring-2 ring-redalert/30"
                                : "bg-gradient-to-br from-saffron to-deeporange text-white"
                                } ${isLoading ? "opacity-30 cursor-not-allowed grayscale" : ""}`}
                            >
                              {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Mic size={24} />}
                            </button>
                          </div>
                          <span className="text-[8px] text-white/50 font-black uppercase tracking-widest text-center">
                            {isRecording ? "TRANSMITTING..." : "PUSH_TO_TALK"}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            ref={inputRef}
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                            placeholder="INJECT SCRIPT..."
                            disabled={isLoading}
                            className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-[10px] placeholder:text-white/20 focus:outline-none focus:bg-white/20 text-white disabled:opacity-50 font-bold tracking-tight"
                          />
                          <button
                            onClick={sendMessage}
                            disabled={isLoading || !inputText.trim()}
                            className="p-3 bg-saffron rounded-xl text-white hover:bg-saffron/80 disabled:opacity-30 transition-all shadow-lg"
                          >
                            <Send size={14} />
                          </button>
                        </div>
                      )}

                      <div className="flex justify-between mt-4 px-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1 h-1 rounded-full bg-saffron animate-pulse" />
                          <span className="text-[7px] text-white/50 font-black uppercase tracking-widest">
                            {messages.length} CYCLES_SENT
                          </span>
                        </div>
                        <span className="text-[7px] text-indgreen font-black uppercase tracking-widest animate-pulse">
                          MONITORING_ACTIVE
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {callState === "success" && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6 bg-gradient-to-b from-boxbg to-white fade-in overflow-y-auto scrollbar-hide">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-indgreen flex items-center justify-center text-white shadow-xl shadow-indgreen/20 animate-success">
                      <ShieldCheck size={32} />
                    </div>

                    <div className="text-center space-y-1 mb-2">
                      <h4 className="font-black text-indblue text-xl tracking-tighter">NODE_SECURED</h4>
                      <p className="text-[10px] text-silver font-bold leading-relaxed px-2">
                        Intelligence extracted successfully uploaded to Grid.
                      </p>
                    </div>

                    <div className="w-full bg-white rounded-2xl border border-silver/10 shadow-lg overflow-hidden">
                      <div className="bg-indblue p-3 text-white flex justify-between items-center">
                        <span className="text-[8px] font-black tracking-widest">INTEL_LOG_V3</span>
                        <Brain size={14} className="text-saffron" />
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex justify-between items-center border-b border-silver/5 pb-1">
                          <span className="text-[9px] text-silver font-bold uppercase tracking-widest">PATTERN</span>
                          <span className="text-xs font-black text-indblue tracking-tight">{analysis?.analysis?.scam_type || "FRAUD_OPS"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-silver font-bold uppercase tracking-widest">TARGET</span>
                          <span className="text-xs font-black text-indblue tracking-tight">{analysis?.analysis?.bank_name || "CENTRAL_GRID"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full space-y-3">
                      <button
                        onClick={toggleBlock}
                        className={`w-full py-4 rounded-[1.5rem] font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg group ${isBlocked
                          ? "bg-redalert/10 text-redalert border-2 border-redalert/20"
                          : "bg-redalert text-white hover:shadow-redalert/30"
                          }`}
                      >
                        {isBlocked ? <ShieldAlert size={16} /> : <Lock size={16} />}
                        {isBlocked ? "IMEI_PERMA_BLOCKED" : "BLOCK_IMEI_RANGE"}
                      </button>

                      <button
                        onClick={() => { setCallState("idle"); setMessages([]); setAnalysis(null); setIsBlocked(false); }}
                        className="w-full text-indblue font-black text-[9px] flex items-center justify-center gap-1.5 py-1.5 opacity-50 hover:opacity-100 transition-opacity tracking-widest uppercase"
                      >
                        RE_INITIALIZE <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Home Indicator */}
              <div className="absolute bottom-2 let-1/2 -translate-x-1/2 w-24 h-1 bg-silver/20 rounded-full" style={{ left: '50%' }} />
            </div>

            {/* Cards Container - Now on the Right */}
            <div className="flex flex-col gap-6 w-72 shrink-0">
              {[
                { icon: Lock, title: "TRAP_GRID", desc: "Live surveillance of scammer audio patterns via ML nodes." },
                { icon: Volume2, title: "BULBUL_v2", desc: "Real-time TTS engine with 99.2% human-parity in Indian dialects." },
                { icon: Brain, title: "SENTINEL_AI", desc: "Forensic extraction system designed to waste attacker time." }
              ].map((item, i) => (
                <div key={i} className="group p-6 bg-white rounded-[2rem] border border-silver/10 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                  <div className="w-10 h-10 rounded-xl bg-boxbg flex items-center justify-center text-indblue mb-4 group-hover:bg-saffron group-hover:text-white transition-colors">
                    <item.icon size={20} />
                  </div>
                  <h4 className="text-[9px] font-black text-indblue uppercase tracking-widest mb-2">{item.title}</h4>
                  <p className="text-[10px] text-silver font-medium leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

          {activeFeature === 'deepfake' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white rounded-[2.5rem] border border-silver/10 shadow-2xl fade-in max-w-2xl w-full mx-auto my-8 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-saffron to-deeporange" />
               <div className="w-24 h-24 bg-saffron/10 text-saffron rounded-full flex items-center justify-center mb-8 pulse-saffron">
                 <ShieldAlert size={48} />
               </div>
               <h3 className="text-3xl font-black text-indblue mb-4 tracking-tighter">Forensic Scanner Alpha</h3>
               <p className="text-silver text-sm font-medium text-center mb-10 max-w-md leading-relaxed">
                 Our visual intelligence engine is scanning for synthetic biometric artifacts. 
                 Real-time analysis detects AI-generated facial structures and voice clones.
               </p>
               
               <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="p-6 bg-boxbg rounded-2xl border border-silver/5 flex flex-col items-center gap-3 group hover:border-indblue/20 transition-all cursor-pointer">
                    <div className="w-10 h-10 bg-indblue text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                       <ShieldCheck size={20} />
                    </div>
                    <span className="text-[10px] font-black text-indblue uppercase tracking-widest">Verify Skin</span>
                  </div>
                  <div className="p-6 bg-boxbg rounded-2xl border border-silver/5 flex flex-col items-center gap-3 group hover:border-saffron/20 transition-all cursor-pointer">
                    <div className="w-10 h-10 bg-saffron text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                       <Zap size={20} />
                    </div>
                    <span className="text-[10px] font-black text-saffron uppercase tracking-widest">Deep Scan</span>
                  </div>
               </div>
               
               <button 
                 onClick={() => toast.success("Scanning complete: No synthetic artifacts found.")}
                 className="mt-10 w-full py-5 bg-indblue text-white rounded-2xl font-black text-sm hover:shadow-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
               >
                 START FORENSIC ANALYSIS <ArrowRight size={18} />
               </button>
            </div>
          )}

          {activeFeature === 'upi' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white rounded-[2.5rem] border border-silver/10 shadow-2xl fade-in max-w-2xl w-full mx-auto my-8 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indgreen to-emerald-400" />
               <div className="w-24 h-24 bg-indgreen/10 text-indgreen rounded-full flex items-center justify-center mb-8">
                 <Zap size={48} />
               </div>
               <h3 className="text-3xl font-black text-indblue mb-4 tracking-tighter">UPI Armor v4</h3>
               <p className="text-silver text-sm font-medium text-center mb-10 max-w-md leading-relaxed">
                 Sentinel UPI Shield provides a secure wrapper for high-risk transactions. 
                 Merchant reputation and transaction velocity are checked against the national grid.
               </p>

               <div className="w-full bg-boxbg rounded-[2rem] p-8 border border-silver/10 mb-8">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[10px] font-black text-silver uppercase tracking-widest">Transaction Status</span>
                    <span className="px-2 py-1 bg-indgreen/10 text-indgreen rounded text-[8px] font-black tracking-widest uppercase">SECURE</span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-silver/5 pb-2">
                       <span className="text-xs font-bold text-silver uppercase tracking-widest">Recipient</span>
                       <span className="text-sm font-black text-indblue">SENTINEL_GOV @ SBI</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-bold text-silver uppercase tracking-widest">Risk Score</span>
                       <span className="text-sm font-black text-indgreen">0.02 (CLEAN)</span>
                    </div>
                  </div>
               </div>
               
               <button 
                onClick={() => toast.success("Transaction Shielded: Safety Verified")}
                className="w-full py-5 bg-indgreen text-white rounded-2xl font-black text-sm hover:shadow-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                AUTHORIZE SECURE PAY <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* Footer */}
          <footer className="w-full text-center pb-4 mt-4 shrink-0">
            <p className="text-[9px] font-black text-silver/40 uppercase tracking-[0.4em]">For A Secured Digital India | Sentinel Protection</p>
          </footer>
        </div>
      )}
    </div>

  );
}
