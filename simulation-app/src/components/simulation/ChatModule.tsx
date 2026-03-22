"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Brain,
  Loader2,
  Lock,
  MessageSquare,
  Mic,
  Phone,
  Send,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";

interface ChatMessage {
  role: "scammer" | "ai";
  text: string;
  audioBase64?: string;
  timestamp: string;
}

interface SessionSummary {
  session_id: string;
  status: string;
  direction: string;
  persona: string;
  caller_num: string;
  customer_id: string | null;
  citizen_banner: string;
  citizen_safe: boolean;
  threat_profile: {
    location: string;
    risk_band: string;
    pattern: string;
  };
  live_summary: {
    scam_type: string;
    bank_name: string;
    urgency_level: string;
    risk_score: number;
    details: string;
    key_entities: string[];
    entity_count: number;
    scammer_turns: number;
    ai_turns: number;
    minutes_engaged: number;
    fatigue_score: number;
    last_scammer_message?: string | null;
    last_ai_message?: string | null;
  };
  transcript: ChatMessage[];
  updated_at: string;
}

interface ChatModuleProps {
  customerId: string;
  selectedPersona: { id: string; label: string; lang: string } | null;
  setActiveFeature: (feature: "chat" | "deepfake" | "upi" | "bharat" | null) => void;
}

type CallState = "idle" | "ringing" | "warning" | "active" | "success";

function getStoredToken() {
  if (typeof window === "undefined") return null;
  const authStr = localStorage.getItem("drishyam_auth");
  if (!authStr) return null;
  try {
    return JSON.parse(authStr).token ?? null;
  } catch {
    return null;
  }
}

export default function ChatModule({
  customerId,
  selectedPersona,
}: ChatModuleProps) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [autoPlayVoice, setAutoPlayVoice] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [isTakeBackActive, setIsTakeBackActive] = useState(false);
  const [sessionData, setSessionData] = useState<{
    id: string;
    caller: string;
    location: string;
    riskBand: string;
    threatPattern: string;
    citizenBanner: string;
  } | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [isTestCallLoading, setIsTestCallLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, summary]);

  useEffect(() => {
    if (!sessionId || (callState !== "active" && callState !== "success")) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshSummary(sessionId);
    }, 4000);

    return () => window.clearInterval(interval);
  }, [sessionId, callState]);

  const playAudio = (base64Audio: string) => {
    if (!base64Audio) return;
    try {
      const byteChars = atob(base64Audio);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i += 1) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      void audio.play();
    } catch (error) {
      console.error("Audio playback failed:", error);
    }
  };

  const refreshSummary = async (sid: string) => {
    try {
      const res = await fetch(`${API_BASE}/honeypot/session/${sid}/summary`);
      if (!res.ok) return null;
      const data = await res.json();
      setSummary(data);
      return data as SessionSummary;
    } catch (error) {
      console.error("Summary refresh failed:", error);
      return null;
    }
  };

  const startCall = async () => {
    setCallState("ringing");
    setMessages([]);
    setSummary(null);
    setAnalysis(null);
    setSessionId(null);
    setIsTakeBackActive(false);
    setIsBlocked(false);

    try {
      const res = await fetch(`${API_BASE}/honeypot/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: selectedPersona?.id || "Elderly Uncle",
          customer_id: customerId,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setSessionId(data.session_id);
      setSessionData({
        id: data.session_id,
        caller: data.caller_num || "+91-TRACE-NODE",
        location: data.location || "National relay grid",
        riskBand: data.risk_band || "HIGH",
        threatPattern: data.threat_pattern || "Suspicious fraud script",
        citizenBanner: data.citizen_banner || "Suspicious caller detected.",
      });

      window.setTimeout(() => setCallState("warning"), 1400);
    } catch (error) {
      console.error("Failed to initiate monitoring session:", error);
      toast.error("Could not initialize the protective node.");
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
      let activeSessionId = sessionId;
      if (!activeSessionId) {
        const sessionResponse = await fetch(`${API_BASE}/honeypot/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            persona: selectedPersona?.id || "Elderly Uncle",
            customer_id: customerId,
            caller_num: testPhoneNumber,
          }),
        });
        if (!sessionResponse.ok) {
          throw new Error("Could not initialize a live call session");
        }
        const sessionDataResponse = await sessionResponse.json();
        activeSessionId = sessionDataResponse.session_id;
        setSessionId(sessionDataResponse.session_id);
        setSessionData({
          id: sessionDataResponse.session_id,
          caller: sessionDataResponse.caller_num || testPhoneNumber,
          location: sessionDataResponse.location || "National relay grid",
          riskBand: sessionDataResponse.risk_band || "HIGH",
          threatPattern: sessionDataResponse.threat_pattern || "Suspicious fraud script",
          citizenBanner: sessionDataResponse.citizen_banner || "Suspicious caller detected.",
        });
      }

      const token = getStoredToken();
      const res = await fetch(`${API_BASE}/twilio/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          to_number: testPhoneNumber,
          persona: selectedPersona?.id || "Elderly Uncle",
          session_id: activeSessionId,
          customer_id: customerId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Call setup failed");
      }

      toast.success("DRISHYAM AI is dialing your phone now.");
      setCallState("warning");
    } catch (error: any) {
      console.error("Test call error:", error);
      toast.error(error.message || "Unable to place test call.");
    } finally {
      setIsTestCallLoading(false);
    }
  };

  const handOffToAI = async () => {
    if (!sessionId) {
      toast.error("No active session is available.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/honeypot/session/${sessionId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: selectedPersona?.id || "Elderly Uncle",
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      if (data.greeting) {
        setMessages([
          {
            role: "ai",
            text: data.greeting,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
      setSummary(data.summary);
      setCallState("active");
      setIsTakeBackActive(false);
      toast.success("AI has taken over the suspicious caller.");
    } catch (error) {
      console.error("Handoff failed:", error);
      toast.error("AI handoff could not be completed.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTakeBack = async () => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      if (isTakeBackActive) {
        await handOffToAI();
        return;
      }

      const res = await fetch(`${API_BASE}/honeypot/session/${sessionId}/take-back`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      setSummary(data.summary);
      setIsTakeBackActive(true);
      toast.success("Citizen control restored.");
    } catch (error) {
      console.error("Take-back failed:", error);
      toast.error("Unable to return control to the citizen.");
    } finally {
      setIsLoading(false);
    }
  };

  const endCall = async () => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/honeypot/direct-conclude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          customer_id: customerId,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setAnalysis(data);
      setCallState("success");
      await refreshSummary(sessionId);
      toast.success("Evidence secured and routed to the grid.");
    } catch (error) {
      console.error("Conclude error:", error);
      toast.error("Could not finalize the session cleanly.");
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    if (callState !== "active") return;
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
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          await processVoiceAudio(reader.result as string);
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access denied:", error);
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
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/voice/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_base64: base64Audio,
          persona: selectedPersona?.id || "Elderly Uncle",
          session_id: sessionId,
          history: messages.map((message) => ({
            role: message.role === "scammer" ? "user" : "assistant",
            content: message.text,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      const nextMessages: ChatMessage[] = [];

      if (data.scammer_transcript) {
        nextMessages.push({
          role: "scammer",
          text: data.scammer_transcript,
          timestamp: new Date().toISOString(),
        });
      }

      nextMessages.push({
        role: "ai",
        text: data.ai_response_text,
        audioBase64: data.ai_audio_base64,
        timestamp: new Date().toISOString(),
      });

      setMessages((prev) => [...prev, ...nextMessages]);

      if (data.ai_audio_base64 && autoPlayVoice && !isTakeBackActive) {
        playAudio(data.ai_audio_base64);
      }

      await refreshSummary(sessionId);
    } catch (error) {
      console.error("Voice pipeline failed:", error);
      toast.error("Voice processing failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || isLoading || !sessionId) return;

    const scammerMessage: ChatMessage = {
      role: "scammer",
      text,
      timestamp: new Date().toISOString(),
    };

    const nextHistory = [...messages, scammerMessage];
    setMessages(nextHistory);
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
          history: nextHistory.map((message) => ({
            role: message.role === "scammer" ? "user" : "assistant",
            content: message.text,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: data.ai_response,
          timestamp: new Date().toISOString(),
        },
      ]);
      await refreshSummary(sessionId);
    } catch (error) {
      console.error("Text chat error:", error);
      toast.error("Unable to relay the caller message.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBlock = () => {
    setIsBlocked((prev) => !prev);
    if (!isBlocked) {
      toast.success("IMEI range blocked in regional command grid.");
    }
  };

  const resetModule = () => {
    setCallState("idle");
    setMessages([]);
    setAnalysis(null);
    setSummary(null);
    setSessionId(null);
    setSessionData(null);
    setInputText("");
    setIsBlocked(false);
    setIsTakeBackActive(false);
    setIsRecording(false);
  };

  const transcript = summary?.transcript?.length ? summary.transcript : messages;
  const entities = summary?.live_summary?.key_entities || [];

  return (
    <div className="flex flex-col lg:flex-row items-start justify-center gap-6 lg:gap-8 w-full">
      <div className="relative w-full max-w-[320px] h-[560px] sm:h-[620px] bg-charcoal rounded-[3rem] border-[10px] border-charcoal shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] overflow-hidden shrink-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-charcoal rounded-b-2xl z-30" />
        <div className="relative w-full h-full bg-white flex flex-col">
          {callState === "idle" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 p-5 fade-in">
              <div className="w-16 h-16 rounded-2xl bg-boxbg flex items-center justify-center text-indblue pulse-saffron shadow-inner">
                <ShieldCheck size={32} />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-black text-indblue">Shield Ready</p>
                <p className="text-[9px] text-silver font-bold uppercase tracking-widest leading-relaxed">
                  One tap lets AI take over the suspicious caller while the citizen stays protected.
                </p>
              </div>

              <div className="w-full max-w-[240px] space-y-3">
                <div className="space-y-2">
                  <p className="text-[8px] text-silver font-black uppercase tracking-widest text-center">
                    Test on your real phone
                  </p>
                  <input
                    type="text"
                    placeholder="+91XXXXXXXXXX"
                    value={testPhoneNumber}
                    onChange={(event) => setTestPhoneNumber(event.target.value)}
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
                        if (!testPhoneNumber) {
                          toast.error("Enter phone number");
                          return;
                        }

                        try {
                          const res = await fetch(`${API_BASE}/twilio/sms`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              to_number: testPhoneNumber,
                              message: "DRISHYAM AI Security Alert: Suspicious scam pattern detected. Do not share OTP or approve collect requests.",
                            }),
                          });
                          if (!res.ok) {
                            throw new Error("SMS dispatch failed");
                          }
                          toast.success("SMS alert sent.");
                        } catch (error) {
                          console.error(error);
                          toast.error("Unable to send SMS alert.");
                        }
                      }}
                      className="py-2.5 bg-indblue/10 text-indblue border border-indblue/20 rounded-xl text-[9px] font-black hover:bg-indblue hover:text-white transition-all flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare size={10} />
                      SMS
                    </button>
                  </div>
                </div>

                <div className="h-px bg-silver/5" />

                <button
                  onClick={startCall}
                  className="w-full py-3 bg-indblue text-white rounded-xl text-[11px] font-black hover:bg-indblue/90 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  SIMULATE THREAT
                  <Zap size={12} className="text-saffron fill-saffron" />
                </button>
              </div>
            </div>
          )}

          {(callState === "ringing" || callState === "warning") && (
            <div className="flex-1 flex flex-col p-6 fade-in">
              <div className="mt-12 text-center">
                <div className="w-16 h-16 bg-boxbg border-2 border-silver/10 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg text-silver">
                  <Phone size={28} />
                </div>
                <h3 className="text-xl font-black text-charcoal tracking-tight">
                  {sessionData?.caller || "UNKNOWN NODE"}
                </h3>
                <p className="text-[10px] text-silver font-bold mt-1 tracking-wide">
                  {sessionData?.location || "Scanning origin..."}
                </p>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                {callState === "warning" ? (
                  <div className="bg-redalert/5 border-2 border-redalert/20 p-4 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldAlert className="text-redalert" size={20} />
                      <p className="text-sm font-black text-redalert uppercase tracking-tight">Threat Detected</p>
                    </div>
                    <p className="text-[10px] text-redalert/80 font-bold leading-relaxed">
                      {sessionData?.citizenBanner || "Suspicious fraud script detected."}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-redalert/70">
                      <span>{sessionData?.riskBand}</span>
                      <span className="text-silver/40">•</span>
                      <span>{sessionData?.threatPattern}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-[10px] font-bold text-silver animate-pulse">
                    Scanning call infrastructure...
                  </p>
                )}
              </div>

              <div className="pb-8 space-y-4">
                {callState === "warning" ? (
                  <button
                    onClick={handOffToAI}
                    disabled={isLoading}
                    className="w-full py-4 bg-indblue text-white rounded-[1.5rem] font-black text-xs flex items-center justify-center gap-2 hover:bg-indblue/95 transition-all shadow-xl"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} className="text-saffron" />}
                    LET AI HANDLE
                  </button>
                ) : null}

                <div className="flex justify-around items-center px-4 pt-4 border-t border-silver/5">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-indgreen rounded-full flex items-center justify-center text-white shadow-md">
                      <Phone size={24} />
                    </div>
                    <span className="text-[9px] font-bold text-silver uppercase tracking-widest">Accept</span>
                  </div>
                  <button
                    onClick={resetModule}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-12 h-12 bg-redalert rounded-full flex items-center justify-center text-white shadow-md">
                      <X size={24} />
                    </div>
                    <span className="text-[9px] font-bold text-silver uppercase tracking-widest">Reject</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {callState === "active" && (
            <div className="flex-1 flex flex-col bg-gradient-to-b from-indblue to-[#001447] text-white p-6">
              <div className="pt-8">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck size={18} className="text-saffron" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">
                    Citizen Protection Mode
                  </span>
                </div>
                <h3 className="text-2xl font-black tracking-tight leading-tight">
                  {isTakeBackActive ? "Citizen back on the line" : "AI is handling the caller"}
                </h3>
                <p className="text-[11px] text-white/70 font-semibold mt-3 leading-relaxed">
                  {isTakeBackActive
                    ? "Control has been returned. You can now speak directly or route the caller back to the AI."
                    : summary?.citizen_banner || "The citizen is protected while DRISHYAM keeps the scammer engaged."}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/50">Persona</p>
                  <p className="text-sm font-black mt-1">{summary?.persona || selectedPersona?.id || "Elderly Uncle"}</p>
                </div>
                <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/50">Risk</p>
                  <p className="text-sm font-black mt-1">{summary?.threat_profile?.risk_band || sessionData?.riskBand || "HIGH"}</p>
                </div>
                <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/50">Location</p>
                  <p className="text-xs font-black mt-1">{summary?.threat_profile?.location || sessionData?.location || "Relay grid"}</p>
                </div>
                <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/50">Entities</p>
                  <p className="text-sm font-black mt-1">{summary?.live_summary?.entity_count || 0}</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-white/10 border border-white/10 p-4">
                <p className="text-[8px] font-black uppercase tracking-widest text-saffron">Live Summary</p>
                <p className="text-sm font-bold mt-2 leading-relaxed">
                  {summary?.live_summary?.details || "No transcript captured yet. Inject caller input to continue the simulation."}
                </p>
                <div className="mt-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-white/60">
                  <span>{summary?.live_summary?.scam_type || "UNKNOWN"}</span>
                  <span className="text-white/20">•</span>
                  <span>{summary?.live_summary?.urgency_level || "MEDIUM"}</span>
                </div>
              </div>

              <div className="mt-auto space-y-3 pt-6">
                <button
                  onClick={toggleTakeBack}
                  disabled={isLoading}
                  className="w-full py-3.5 bg-white/10 border border-white/15 rounded-2xl font-black text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-white/15 transition-all"
                >
                  {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                  {isTakeBackActive ? "RETURN TO SAFE MODE" : "TAKE BACK CONTROL"}
                </button>
                <button
                  onClick={endCall}
                  disabled={isLoading}
                  className="w-full py-3.5 bg-saffron text-white rounded-2xl font-black text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-deeporange transition-all shadow-lg"
                >
                  {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                  END AND SECURE EVIDENCE
                </button>
                <p className="text-[9px] text-white/40 text-center font-bold uppercase tracking-widest">
                  The citizen sees live protection status without hearing the scammer.
                </p>
              </div>
            </div>
          )}

          {callState === "success" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6 bg-gradient-to-b from-boxbg to-white fade-in overflow-y-auto">
              <div className="w-16 h-16 rounded-[1.5rem] bg-indgreen flex items-center justify-center text-white shadow-xl shadow-indgreen/20">
                <ShieldCheck size={32} />
              </div>
              <div className="text-center space-y-1">
                <h4 className="font-black text-indblue text-xl tracking-tighter">Node Secured</h4>
                <p className="text-[10px] text-silver font-bold leading-relaxed px-2">
                  Transcript, extracted entities, and intelligence report have been secured.
                </p>
              </div>
              <div className="w-full bg-white rounded-2xl border border-silver/10 shadow-lg overflow-hidden">
                <div className="bg-indblue p-3 text-white flex justify-between items-center">
                  <span className="text-[8px] font-black tracking-widest">INTEL LOG</span>
                  <Brain size={14} className="text-saffron" />
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between items-center border-b border-silver/5 pb-1">
                    <span className="text-[9px] text-silver font-bold uppercase tracking-widest">Pattern</span>
                    <span className="text-xs font-black text-indblue tracking-tight">
                      {analysis?.analysis?.scam_type || summary?.live_summary?.scam_type || "FRAUD_OPS"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-silver/5 pb-1">
                    <span className="text-[9px] text-silver font-bold uppercase tracking-widest">Target</span>
                    <span className="text-xs font-black text-indblue tracking-tight">
                      {analysis?.analysis?.bank_name || summary?.live_summary?.bank_name || "CENTRAL_GRID"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-silver font-bold uppercase tracking-widest">Reports</span>
                    <span className="text-xs font-black text-indblue tracking-tight">
                      {analysis?.reports_created ?? 0}
                    </span>
                  </div>
                </div>
              </div>
              {analysis?.session_summary?.routing ? (
                <div className="w-full bg-white rounded-2xl border border-silver/10 shadow-lg p-4">
                  <p className="text-[8px] font-black uppercase tracking-widest text-indblue">Routing Summary</p>
                  <p className="mt-3 text-xs font-bold text-charcoal">
                    Agencies: {(analysis.session_summary.routing.routed_agencies || []).join(" | ") || "Pending"}
                  </p>
                  {(analysis.session_summary.routing.reports || []).length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {analysis.session_summary.routing.reports.map((report: any) => (
                        <div key={report.report_id} className="rounded-xl border border-silver/10 bg-boxbg px-3 py-2">
                          <p className="text-[10px] font-black text-indblue uppercase">
                            {report.category} | {report.report_id}
                          </p>
                          <p className="mt-1 text-[10px] font-bold text-charcoal">
                            {report.platform} | {report.priority}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {analysis.session_summary.routing.recovery_case ? (
                    <div className="mt-3 rounded-xl border border-indblue/10 bg-indblue/5 px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-indblue">Recovery Case</p>
                      <p className="mt-1 text-xs font-bold text-charcoal">
                        {analysis.session_summary.routing.recovery_case.incident_id} | {analysis.session_summary.routing.recovery_case.bank_status}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="w-full space-y-3">
                <button
                  onClick={toggleBlock}
                  className={`w-full py-4 rounded-[1.5rem] font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${isBlocked ? "bg-redalert/10 text-redalert border-2 border-redalert/20" : "bg-redalert text-white"}`}
                >
                  {isBlocked ? <ShieldAlert size={16} /> : <Lock size={16} />}
                  {isBlocked ? "IMEI RANGE BLOCKED" : "BLOCK IMEI RANGE"}
                </button>
                <button
                  onClick={resetModule}
                  className="w-full text-indblue font-black text-[9px] flex items-center justify-center gap-1.5 py-1.5 opacity-50 hover:opacity-100 transition-opacity tracking-widest uppercase"
                >
                  REINITIALIZE
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-silver/20 rounded-full" />
      </div>

      <div className="w-full lg:flex-1 space-y-4">
        {callState === "active" || callState === "success" ? (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 p-5 bg-white rounded-[2rem] border border-silver/10 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h4 className="text-[10px] font-black text-indblue uppercase tracking-[0.2em]">Live Summary Feed</h4>
                    <p className="text-xs text-silver font-medium mt-1">
                      Citizen-safe status, extracted entities, and fatigue telemetry update live.
                    </p>
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-redalert/10 text-redalert text-[10px] font-black uppercase tracking-widest">
                    {summary?.threat_profile?.risk_band || sessionData?.riskBand || "HIGH"}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="rounded-2xl bg-boxbg p-4 border border-silver/5">
                    <p className="text-[8px] font-black text-silver uppercase tracking-widest">Scam Type</p>
                    <p className="text-sm font-black text-indblue mt-2">{summary?.live_summary?.scam_type || "UNKNOWN"}</p>
                  </div>
                  <div className="rounded-2xl bg-boxbg p-4 border border-silver/5">
                    <p className="text-[8px] font-black text-silver uppercase tracking-widest">Minutes Engaged</p>
                    <p className="text-sm font-black text-indblue mt-2">{summary?.live_summary?.minutes_engaged || 0}</p>
                  </div>
                  <div className="rounded-2xl bg-boxbg p-4 border border-silver/5">
                    <p className="text-[8px] font-black text-silver uppercase tracking-widest">Fatigue Score</p>
                    <p className="text-sm font-black text-indblue mt-2">{summary?.live_summary?.fatigue_score || 0}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-silver/10 p-4">
                  <p className="text-[8px] font-black uppercase tracking-widest text-saffron">Latest AI Readout</p>
                  <p className="text-sm font-bold text-charcoal mt-2 leading-relaxed">
                    {summary?.live_summary?.last_ai_message || "The AI response will appear here once the caller engages."}
                  </p>
                  <p className="text-xs text-silver mt-3 leading-relaxed">
                    {summary?.live_summary?.details || "No high-confidence tactics extracted yet."}
                  </p>
                </div>
              </div>

              <div className="p-5 bg-white rounded-[2rem] border border-silver/10 shadow-sm">
                <h4 className="text-[10px] font-black text-indblue uppercase tracking-[0.2em] mb-4">Extracted Intel</h4>
                <div className="space-y-3">
                  <div className="rounded-2xl bg-boxbg p-4 border border-silver/5">
                    <p className="text-[8px] font-black text-silver uppercase tracking-widest">Targeted Institution</p>
                    <p className="text-sm font-black text-charcoal mt-2">
                      {summary?.live_summary?.bank_name || "Unknown"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-boxbg p-4 border border-silver/5">
                    <p className="text-[8px] font-black text-silver uppercase tracking-widest">Urgency</p>
                    <p className="text-sm font-black text-charcoal mt-2">
                      {summary?.live_summary?.urgency_level || "MEDIUM"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-boxbg p-4 border border-silver/5 min-h-[160px]">
                    <p className="text-[8px] font-black text-silver uppercase tracking-widest">Entities</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entities.length > 0 ? entities.map((entity) => (
                        <span
                          key={entity}
                          className="px-2.5 py-1.5 rounded-full bg-indblue/5 text-indblue text-[10px] font-black border border-indblue/10"
                        >
                          {entity}
                        </span>
                      )) : (
                        <p className="text-xs text-silver font-medium">
                          No entity extracted yet. Continue the caller simulation to capture phone numbers, VPAs, or IDs.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
              <div className="p-5 bg-white rounded-[2rem] border border-silver/10 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h4 className="text-[10px] font-black text-indblue uppercase tracking-[0.2em]">Scammer Relay Console</h4>
                    <p className="text-xs text-silver font-medium mt-1">
                      Simulate what the caller says while the citizen remains protected.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsVoiceMode(false)}
                      className={`px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${!isVoiceMode ? "bg-indblue text-white border-indblue" : "bg-white text-silver border-silver/20"}`}
                    >
                      TEXT
                    </button>
                    <button
                      onClick={() => setIsVoiceMode(true)}
                      className={`px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${isVoiceMode ? "bg-saffron text-white border-saffron" : "bg-white text-silver border-silver/20"}`}
                    >
                      VOICE
                    </button>
                  </div>
                </div>

                {isVoiceMode ? (
                  <div className="flex flex-col items-center gap-4 py-6">
                    <button
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      onMouseLeave={stopRecording}
                      onTouchStart={startRecording}
                      onTouchEnd={stopRecording}
                      disabled={isLoading}
                      className={`relative p-5 rounded-full transition-all shadow-xl ${isRecording ? "bg-redalert text-white" : "bg-gradient-to-br from-saffron to-deeporange text-white"} ${isLoading ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Mic size={24} />}
                    </button>
                    <p className="text-[10px] font-black uppercase tracking-widest text-silver">
                      {isRecording ? "Recording caller audio..." : "Push to talk as the scammer"}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(event) => setInputText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void sendMessage();
                        }
                      }}
                      placeholder="Type the caller script here..."
                      disabled={isLoading}
                      className="flex-1 bg-boxbg border border-silver/20 rounded-xl px-4 py-3 text-sm placeholder:text-silver/40 focus:outline-none focus:border-indblue transition-all text-charcoal font-semibold"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={isLoading || !inputText.trim()}
                      className="p-3 bg-saffron rounded-xl text-white hover:bg-deeporange disabled:opacity-30 transition-all shadow-lg"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between rounded-2xl bg-boxbg border border-silver/10 px-4 py-3">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-silver">Voice Replay</p>
                    <p className="text-xs text-charcoal font-semibold mt-1">Auto-play AI voice when generated</p>
                  </div>
                  <button
                    onClick={() => setAutoPlayVoice((prev) => !prev)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${autoPlayVoice ? "bg-indgreen" : "bg-silver/40"}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${autoPlayVoice ? "left-6" : "left-0.5"}`} />
                  </button>
                </div>
              </div>

              <div className="p-5 bg-white rounded-[2rem] border border-silver/10 shadow-sm">
                <h4 className="text-[10px] font-black text-indblue uppercase tracking-[0.2em] mb-4">Transcript Monitor</h4>
                <div className="max-h-[360px] overflow-y-auto space-y-3 pr-1">
                  {transcript.length > 0 ? transcript.map((message, index) => (
                    <div
                      key={`${message.timestamp}-${index}`}
                      className={`p-3 rounded-2xl border text-xs leading-relaxed ${message.role === "scammer" ? "bg-saffron/5 border-saffron/15 text-charcoal" : "bg-indblue/5 border-indblue/10 text-charcoal"}`}
                    >
                      <p className="text-[8px] font-black uppercase tracking-widest text-silver mb-2">
                        {message.role === "scammer" ? "Caller" : "DRISHYAM AI"}
                      </p>
                      <p className="font-semibold">{message.text}</p>
                      {"audioBase64" in message && message.audioBase64 ? (
                        <button
                          onClick={() => playAudio(message.audioBase64!)}
                          className="mt-3 py-1.5 px-2.5 bg-white rounded-full flex items-center gap-1.5 text-[8px] text-indblue hover:bg-indblue hover:text-white font-black tracking-widest transition-all"
                        >
                          <Volume2 size={10} />
                          REPLAY
                        </button>
                      ) : null}
                    </div>
                  )) : (
                    <div className="p-4 rounded-2xl bg-boxbg border border-silver/10 text-xs text-silver font-medium">
                      Transcript will populate as soon as the AI or caller speaks.
                    </div>
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Lock,
                title: "PROTECTED HANDOFF",
                desc: "Citizen can hand the suspicious caller to AI and stay out of the audio path.",
              },
              {
                icon: Volume2,
                title: "LIVE SUMMARY",
                desc: "Threat type, urgency, and extracted entities surface without exposing the citizen to the caller.",
              },
              {
                icon: Brain,
                title: "TRANSCRIPT INTEL",
                desc: "Every turn is retained for downstream graphing, FIR packaging, and recovery workflows.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group p-5 bg-white rounded-[2rem] border border-silver/10 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <div className="w-10 h-10 rounded-xl bg-boxbg flex items-center justify-center text-indblue mb-4 group-hover:bg-saffron group-hover:text-white transition-colors">
                  <item.icon size={20} />
                </div>
                <h4 className="text-[9px] font-black text-indblue uppercase tracking-widest mb-2">{item.title}</h4>
                <p className="text-[11px] text-silver font-medium leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
