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
  Loader2,
  Search,
  QrCode,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
  Upload,
  Scan,
  Eye,
  FileWarning,
  Activity,
  Smartphone
} from "lucide-react";
import { API_BASE } from "@/config/api";
import { Toaster, toast } from "react-hot-toast";
import { useActions } from "@/hooks/useActions";
import FeedModal from "@/components/FeedModal";

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
  const [activeFeature, setActiveFeature] = useState<"chat" | "deepfake" | "upi" | "bharat" | null>(null);
  const [isVideoMode, setIsVideoMode] = useState(false);

  // ── Deepfake Defense State (Ported from Dashboard) ──
  const { performAction } = useActions();
  const [isDeepfakeScanning, setIsDeepfakeScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [deepfakeVerdict, setDeepfakeVerdict] = useState<null | 'VERIFIED' | 'DEEPFAKE'>(null);
  const [deepfakeStats, setDeepfakeStats] = useState<any>(null);
  const [deepfakeAiResult, setDeepfakeAiResult] = useState<any>(null);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── UPI Shield State (Ported from Dashboard) ──
  const [upiId, setUpiId] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState<null | 'SAFE' | 'RISK'>(null);
  const [activeUpiTab, setActiveUpiTab] = useState<'lookup' | 'qr' | 'message'>('lookup');
  const [upiStats, setUpiStats] = useState<any>(null);
  const [qrScanning, setQrScanning] = useState(false);
  const [forensicResult, setForensicResult] = useState<any>(null);
  const [messageText, setMessageText] = useState("");
  const [isMessageScanning, setIsMessageScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  
  // ── Bharat Layer State (Ported from Dashboard) ──
  const [ussdStep, setUssdStep] = useState(0);
  const [ussdHistory, setUssdHistory] = useState<string[]>([]);
  const [ussdInput, setUssdInput] = useState("");
  const ussdFlow = [
    { title: "SENTINEL USSD NODE", content: "1. Report Cyber Crime\n2. Verify UPI ID\n3. Emergency Broadcast\n4. Digital Saathi" },
    { title: "REPORT SCAM", content: "Select Scam Category:\n1. KYC/Bank Fraud\n2. Jobs/Investment\n3. Sextortion\n4. Other" },
    { title: "PROCESSING...", content: "Sending report to National Command Center..." },
    { title: "SUCCESS", content: "Case Logged Successfully.\nA Digital FIR (65B) will be sent via SMS shortly." }
  ];

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

  // Fetch Deepfake stats
  useEffect(() => {
    if (activeFeature === 'deepfake') {
      const fetchDFStats = async () => {
        try {
          const res = await fetch(`${API_BASE}/system/stats/deepfake`);
          if (res.ok) setDeepfakeStats(await res.json());
        } catch (e) {
          console.error("DF Stats fetch failed:", e);
        }
      };
      fetchDFStats();
    }
  }, [activeFeature]);

  // Fetch UPI stats
  useEffect(() => {
    if (activeFeature === 'upi') {
      const fetchUPIStats = async () => {
        try {
          const res = await fetch(`${API_BASE}/system/stats/upi`);
          if (res.ok) setUpiStats(await res.json());
        } catch (e) {
          console.error("UPI Stats fetch failed:", e);
        }
      };
      fetchUPIStats();
    }
  }, [activeFeature]);

  // Poll for Admin Approval
  useEffect(() => {
    let interval: any;
    if (authStatus === 'pending' && customerId) {
      const checkStatus = async () => {
        try {
          const res = await fetch(`${API_BASE}/auth/simulation/status/${customerId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'approved') {
              setAuthStatus('approved');
              if (data.access_token) {
                localStorage.setItem('sentinel_auth', JSON.stringify({
                  token: data.access_token,
                  username: data.phone_number,
                  role: 'common'
                }));
              }
              toast.success("Security Clearance Granted");
            } else if (data.status === 'rejected') {
              setAuthStatus('login');
              toast.error("Access Request Denied by HQ");
            }
          }
        } catch (e) {
          console.error("Approval poll failed:", e);
        }
      };
      checkStatus();
      interval = setInterval(checkStatus, 5000);
    }
    return () => clearInterval(interval);
  }, [authStatus, customerId]);

  // Deepfake Scan Progress Effect
  useEffect(() => {
    if (isDeepfakeScanning && scanProgress < 100) {
      const timer = setTimeout(() => {
        setScanProgress(prev => prev + 5);
      }, 100);
      return () => clearTimeout(timer);
    } else if (scanProgress >= 100) {
      setTimeout(() => {
        setIsDeepfakeScanning(false);
        setDeepfakeVerdict(deepfakeAiResult?.verdict || 'DEEPFAKE');
      }, 500);
    }
  }, [isDeepfakeScanning, scanProgress, deepfakeAiResult]);

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

  // ── Deepfake Handlers (Ported from Dashboard) ──
  const startDeepfakeScan = async (file?: File) => {
    setIsDeepfakeScanning(true);
    setScanProgress(0);
    setDeepfakeVerdict(null);
    setDeepfakeAiResult(null);

    performAction('SCAN_VIDEO', 'FORENSIC_PIPELINE');

    try {
      const authStr = localStorage.getItem('sentinel_auth');
      const token = authStr ? JSON.parse(authStr).token : null;

      let res;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch(`${API_BASE}/forensic/deepfake/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
      } else {
        res = await fetch(`${API_BASE}/forensic/deepfake/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ media_type: 'video' })
        });
      }

      if (res.ok) {
        const result = await res.json();
        
        if (result.status === "PENDING" && result.id) {
          const pollInterval = setInterval(async () => {
            try {
              const statusRes = await fetch(`${API_BASE}/forensic/status/${result.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                if (statusData.status === "COMPLETED") {
                  clearInterval(pollInterval);
                  setDeepfakeAiResult(statusData);
                  setScanProgress(100);
                } else if (statusData.status === "FAILED") {
                  clearInterval(pollInterval);
                  setIsDeepfakeScanning(false);
                  toast.error("Forensic analysis failed.");
                } else {
                  setScanProgress(prev => Math.min(prev + 5, 95));
                }
              }
            } catch (err) {
              console.error("Polling Error:", err);
              clearInterval(pollInterval);
              setIsDeepfakeScanning(false);
            }
          }, 3000);
        } else {
          setDeepfakeAiResult(result);
          setScanProgress(100);
        }
      } else {
        setIsDeepfakeScanning(false);
      }
    } catch (err) {
      console.error("Forensic API Error:", err);
      setIsDeepfakeScanning(false);
    }
  };

  const handleLookup = () => {
    if (!upiId) return;
    setIsLookingUp(true);
    setLookupResult(null);
    performAction('VPA_LOOKUP', upiId);

    setTimeout(() => {
      setIsLookingUp(false);
      setLookupResult(upiId.toLowerCase().includes('win') || upiId.toLowerCase().includes('prize') ? 'RISK' : 'SAFE');
    }, 1500);
  };

  const handleMessageScan = async () => {
    if (!messageText) return;
    setIsMessageScanning(true);
    setScanResult(null);

    try {
      const res = await fetch(`${API_BASE}/upi/scan-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText })
      });
      if (res.ok) {
        setScanResult(await res.json());
      }
    } catch (error) {
      console.error("Error scanning message:", error);
    } finally {
      setIsMessageScanning(false);
    }
  };

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setQrScanning(true);
    setForensicResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/upi/scan-qr`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setForensicResult(data);
        performAction('SCAN_QR', data.is_safe === false ? 'MALICIOUS_QR_FOUND' : 'SAFE_QR_SCANNED');
      }
    } catch (err) {
      console.error("QR Scan failed:", err);
    } finally {
      setQrScanning(false);
    }
  };

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

  const handleUssdSubmit = async () => {
    if (ussdStep < ussdFlow.length - 1) {
      const nextStep = ussdStep + 1;
      setUssdHistory([...ussdHistory, `> ${ussdInput || '1'}`]);
      
      if (nextStep === ussdFlow.length - 1) {
        try {
          const authStr = localStorage.getItem('sentinel_auth');
          const token = authStr ? JSON.parse(authStr).token : null;
          const res = await fetch(`${API_BASE}/bharat/ussd/report?phone_number=${customerId}&scam_type=${ussdInput || 'General'}&lang=en`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            toast.success(`Report Dispatched: ${data.case_id}`);
          }
        } catch (e) {
          console.error("USSD Report Failed:", e);
        }
      }
      setUssdStep(nextStep);
      setUssdInput("");
    } else {
      setUssdStep(0);
      setUssdHistory([]);
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
              onClick={async () => {
                if (customerId.length >= 10) {
                  try {
                    const res = await fetch(`${API_BASE}/auth/simulation/request`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ phone_number: customerId })
                    });
                    if (res.ok) {
                      setAuthStatus("pending");
                      toast.success(`Request Sent to HQ: ${customerId}`);
                    } else {
                        toast.error(`HQ Rejected Request: ${res.status}`);
                    }
                  } catch (e: any) {
                    toast.error("HQ Connection Failed: " + e.message);
                  }
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
          
          <div className="w-full h-2 bg-boxbg rounded-full overflow-hidden mt-8">
            <div className="h-full bg-saffron animate-[pulse_2s_infinite]" style={{width: '60%'}} />
          </div>
          <p className="text-[10px] text-silver font-bold uppercase tracking-widest mt-6">
            Connecting to <span className="text-indblue">Sentinel HQ...</span>
          </p>
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

          {/* Feature 4: Bharat Layer */}
          <button
            onClick={() => setActiveFeature("bharat")}
            className="group bg-white p-8 rounded-[2.5rem] border border-silver/10 shadow-lg hover:shadow-2xl hover:border-saffron/20 transition-all flex flex-col items-center text-center"
          >
            <div className="w-20 h-20 bg-saffron/5 text-saffron rounded-3xl flex items-center justify-center mb-8 group-hover:bg-saffron group-hover:text-white transition-all transform group-hover:-translate-y-2">
              <Smartphone size={36} />
            </div>
            <h3 className="text-2xl font-black text-indblue mb-4">Bharat Layer</h3>
            <p className="text-xs text-silver font-medium leading-relaxed mb-6">Simulation of feature phone reporting through USSD infrastructure for rural connectivity.</p>
            <div className="mt-auto flex items-center gap-2 text-[10px] font-black text-saffron uppercase tracking-widest opacity-40 group-hover:opacity-100">
              Access USSD <ArrowRight size={14} />
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-6xl mt-4">
                {/* Analysis Interface */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl border border-silver/10 p-8 shadow-sm h-[400px] flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-boxbg/30" />

                        {isDeepfakeScanning ? (
                            <div className="z-10 text-center space-y-6 w-full max-w-xs">
                                <div className="relative w-32 h-32 mx-auto">
                                    <div className="absolute inset-0 border-4 border-saffron/10 rounded-full" />
                                    <div
                                        className="absolute inset-0 border-4 border-saffron rounded-full border-t-transparent animate-spin"
                                        style={{ animationDuration: '2s' }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-indblue">
                                        {scanProgress}%
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm font-bold text-indblue">Extracting Forensic Markers...</p>
                                    <div className="w-full h-1.5 bg-boxbg rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-saffron transition-all duration-300"
                                            style={{ width: `${scanProgress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : deepfakeVerdict ? (
                            <div className="z-10 text-center space-y-6">
                                <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-lg ${deepfakeVerdict === 'DEEPFAKE' ? 'bg-redalert/10 text-redalert' : 'bg-indgreen/10 text-indgreen'}`}>
                                    {deepfakeVerdict === 'DEEPFAKE' ? <ShieldAlert size={48} /> : <ShieldCheck size={48} />}
                                </div>
                                <div>
                                    <h3 className={`text-2xl font-bold ${deepfakeVerdict === 'DEEPFAKE' ? 'text-redalert' : 'text-indgreen'}`}>
                                        {deepfakeVerdict === 'DEEPFAKE' ? 'Deepfake Detected' : 'Verified Identity'}
                                    </h3>
                                    <p className="text-silver mt-2">Forensic analysis complete.</p>
                                </div>
                                <button
                                    onClick={() => { setDeepfakeVerdict(null); performAction('RESET_SCAN'); }}
                                    className="px-4 py-2 border border-silver/10 rounded-lg text-xs font-bold text-silver uppercase tracking-wider hover:text-indblue"
                                >
                                    Reset Scan
                                </button>
                            </div>
                        ) : (
                            <div
                                className="z-10 text-center space-y-4"
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*,video/*,audio/*,application/pdf"
                                    onChange={(e) => e.target.files?.[0] && startDeepfakeScan(e.target.files[0])}
                                />
                                <div className="w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center mx-auto border border-silver/10 group cursor-pointer hover:border-saffron/40 transition-colors" onClick={() => fileInputRef.current?.click()}>
                                    <FileWarning className="text-silver group-hover:text-saffron transition-colors" size={32} />
                                </div>
                                <p className="text-sm font-bold text-indblue">Drop Forensic Media or Documents</p>
                                <p className="text-[10px] text-silver font-medium uppercase tracking-widest leading-relaxed">
                                    Supports .mp4, .png, .mp3, .pdf • MAX 50MB
                                </p>
                                    <button
                                        onClick={() => startDeepfakeScan()}
                                        className="px-6 py-2 bg-saffron text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-deeporange transition-all"
                                    >
                                        START FORENSIC SCAN
                                    </button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Blink Frequency", value: isDeepfakeScanning ? "Analyzing..." : deepfakeVerdict ? (deepfakeAiResult?.analysis_details?.blink_frequency || "Normal") : "Ready" },
                            { label: "Temporal Sync", value: isDeepfakeScanning ? "Calculating..." : deepfakeVerdict ? (deepfakeAiResult?.analysis_details?.temporal_consistency || "98.2%") : "Ready" },
                            { label: "Correctness Prob", value: isDeepfakeScanning ? "Assessing..." : deepfakeVerdict ? `${((deepfakeAiResult?.probability || 0.85) * 100).toFixed(1)}%` : "Ready" },
                            { label: "False +ve Rate", value: isDeepfakeScanning ? "Estimating..." : deepfakeVerdict ? `${((deepfakeAiResult?.false_positive_rate || 0.02) * 100).toFixed(2)}%` : "Ready" }
                        ].map(f => (
                            <div key={f.label} className="bg-white p-4 rounded-xl border border-silver/10 text-center shadow-sm">
                                <p className="text-[9px] font-extrabold text-silver uppercase tracking-wider mb-1">{f.label}</p>
                                <p className={`text-xs font-black ${deepfakeVerdict === 'DEEPFAKE' ? 'text-redalert' : 'text-indblue'}`}>{f.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Intelligence Sidebar */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-silver/10 p-6 shadow-sm">
                        <h4 className="font-bold text-indblue mb-6 flex items-center gap-2">
                            <Brain size={18} className="text-saffron" />
                            Recent Incidents
                        </h4>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                            {deepfakeStats?.incidents && Array.isArray(deepfakeStats.incidents) ? deepfakeStats.incidents.map((inc: any, i: number) => {
                                return (
                                    <div
                                        key={i}
                                        onClick={async () => {
                                            const result = await performAction('VIEW_INCIDENT', inc.type);
                                            if (result && result.detail) {
                                                setSelectedIncident(result.detail);
                                                setIsModalOpen(true);
                                            }
                                        }}
                                        className="p-4 rounded-xl bg-boxbg/50 border border-silver/5 hover:border-saffron/20 transition-all cursor-pointer group"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <ShieldAlert size={18} className={inc.status === "Deepfake" ? "text-redalert" : "text-indgreen"} />
                                            <span className="text-[10px] font-bold uppercase text-silver">{inc.risk} Risk</span>
                                        </div>
                                        <p className="text-xs font-bold text-indblue group-hover:text-saffron transition-colors">{inc.type}</p>
                                        <p className="text-[10px] text-silver mt-1">Verdict: <span className="font-bold">{inc.status}</span></p>
                                    </div>
                                );
                            }) : (
                                <p className="text-[10px] text-silver italic">No recent incidents found.</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-indblue p-6 rounded-2xl border border-saffron/20 text-white shadow-xl relative overflow-hidden group">
                        <h4 className="font-bold mb-4 flex items-center gap-2">
                            <ShieldCheck className="text-indgreen" size={18} />
                            Model Status
                        </h4>
                        <div className="space-y-4">
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-silver">Liveness V4</span>
                                <span className="text-indgreen uppercase">{deepfakeStats?.model_status?.liveness || "Operational"}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-silver">GAN Detector</span>
                                <span className="text-indgreen uppercase">{deepfakeStats?.model_status?.gan_detector || "Active"}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold border-t border-white/5 pt-4 mt-4">
                                <span className="text-silver">False Positive</span>
                                <span className="text-saffron">{deepfakeStats?.model_status?.false_positive_rate || "0.01%"}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {activeFeature === 'upi' && (
            <div className="space-y-6 w-full max-w-6xl mt-4">
                {/* Tabs */}
                <div className="flex bg-boxbg p-1 rounded-xl border border-silver/10 self-start w-fit mx-auto">
                    <button
                        onClick={() => setActiveUpiTab('lookup')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeUpiTab === 'lookup' ? 'bg-white shadow-sm text-indblue' : 'text-silver hover:text-charcoal'}`}
                    >
                        Risk Lookup
                    </button>
                    <button
                        onClick={() => setActiveUpiTab('qr')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeUpiTab === 'qr' ? 'bg-white shadow-sm text-indblue' : 'text-silver hover:text-charcoal'}`}
                    >
                        QR Forensic
                    </button>
                    <button
                        onClick={() => setActiveUpiTab('message')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeUpiTab === 'message' ? 'bg-white shadow-sm text-indblue' : 'text-silver hover:text-charcoal'}`}
                    >
                        Message Scanner
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
                    {/* Left Panel */}
                    <div className="lg:col-span-8 space-y-6">
                        {activeUpiTab === 'lookup' && (
                            <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                    <Search size={120} />
                                </div>
                                <h3 className="text-xl font-bold text-indblue mb-6">Real-Time VPA Reputation</h3>

                                <div className="space-y-4 relative z-10">
                                    <div className="p-1 bg-boxbg rounded-2xl border border-silver/10 flex items-center focus-within:border-saffron/50 transition-colors">
                                        <div className="pl-4 text-silver">
                                            <Zap size={18} />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Enter VPA (e.g., citizen@upi)"
                                            className="w-full bg-transparent p-4 text-sm font-bold text-indblue outline-none placeholder:text-silver/50"
                                            value={upiId}
                                            onChange={(e) => setUpiId(e.target.value)}
                                        />
                                        <button
                                            onClick={handleLookup}
                                            disabled={isLookingUp}
                                            className="bg-indblue text-white px-6 py-3 rounded-xl m-1 text-xs font-bold uppercase tracking-widest hover:bg-saffron transition-all disabled:opacity-50"
                                        >
                                            {isLookingUp ? "Verifying..." : "Check"}
                                        </button>
                                    </div>

                                    {lookupResult && (
                                        <div className={`p-6 rounded-2xl border ${lookupResult === 'SAFE' ? 'bg-indgreen/5 border-indgreen/20' : 'bg-red-50 border-red-200'} animate-in fade-in slide-in-from-top-4 duration-500`}>
                                            <div className="flex gap-4 items-start">
                                                <div className={`p-3 rounded-full ${lookupResult === 'SAFE' ? 'bg-indgreen text-white' : 'bg-redalert text-white'}`}>
                                                    {lookupResult === 'SAFE' ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
                                                </div>
                                                <div>
                                                    <h4 className={`font-bold ${lookupResult === 'SAFE' ? 'text-indgreen' : 'text-redalert'}`}>
                                                        {lookupResult === 'SAFE' ? "VPA Verified Safe" : "High Risk Signature Detected"}
                                                    </h4>
                                                    <p className="text-xs text-charcoal mt-1 leading-relaxed">
                                                        {lookupResult === 'SAFE'
                                                            ? `ID ${upiId} has no fraudulent activity reported across Sentinel nodes.`
                                                            : `WARNING: ${upiId} is linked to reported scam clusters.`}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeUpiTab === 'qr' && (
                            <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm text-center">
                                <div className={`w-20 h-20 bg-boxbg rounded-2xl flex items-center justify-center mx-auto mb-4 border ${qrScanning ? 'border-indblue animate-pulse' : 'border-silver/5'}`}>
                                    <QrCode className={qrScanning ? 'text-indblue animate-bounce' : 'text-saffron'} size={40} />
                                </div>
                                <h3 className="text-xl font-bold text-indblue mb-2">QR Forensic Analysis</h3>
                                <p className="text-silver text-sm max-w-sm mx-auto mb-8 italic">Analyzing destination overlay before payment initiation.</p>

                                {!qrScanning && !forensicResult && (
                                    <label className="cursor-pointer bg-indblue text-white px-8 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-saffron transition-all inline-block shadow-lg">
                                        Upload QR Image
                                        <input type="file" className="hidden" accept="image/*" onChange={handleQRUpload} />
                                    </label>
                                )}

                                {qrScanning && <div className="inline-flex items-center gap-3 text-indblue text-xs font-bold uppercase tracking-widest"><Loader2 className="animate-spin" size={16} /> Processing QR...</div>}

                                {forensicResult && !qrScanning && (
                                    <div className="mt-6 text-left p-6 rounded-2xl border bg-boxbg/50">
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className={`p-3 rounded-full ${forensicResult.is_safe ? 'bg-indgreen text-white' : 'bg-redalert text-white'}`}>
                                                {forensicResult.is_safe ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                                            </div>
                                            <div className="w-full">
                                                <h4 className={`font-bold ${forensicResult.is_safe ? 'text-indgreen' : 'text-redalert'}`}>
                                                    {forensicResult.is_safe ? "Safe QR Destination" : "Malicious QR Detected"}
                                                </h4>
                                                <div className="mt-2 text-[10px] font-mono bg-white/50 p-3 rounded border border-silver/10 break-all">
                                                    {forensicResult.payload}
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => setForensicResult(null)} className="text-[10px] font-black text-indblue uppercase tracking-widest">Scan Alternative QR</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeUpiTab === 'message' && (
                            <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                                <h3 className="text-xl font-bold text-indblue mb-6 flex items-center gap-2">
                                    <MessageSquare className="text-saffron" size={20} /> Pattern Scanner
                                </h3>
                                <textarea
                                    className="w-full p-4 bg-boxbg border border-silver/10 rounded-2xl text-sm text-charcoal outline-none focus:border-saffron/40 resize-none min-h-[120px]"
                                    placeholder="Paste suspicious WhatsApp message..."
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                />
                                <button
                                    onClick={handleMessageScan}
                                    disabled={isMessageScanning || !messageText}
                                    className="mt-4 bg-indblue text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-charcoal transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isMessageScanning && <Loader2 size={14} className="animate-spin" />}
                                    {isMessageScanning ? "Scanning..." : "Analyze Patterns"}
                                </button>

                                {scanResult && (
                                    <div className={`mt-6 p-6 rounded-2xl border ${scanResult.verdict === 'SAFE' ? 'bg-indgreen/5 border-indgreen/20' : 'bg-red-50 border-red-200'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${scanResult.verdict === 'SAFE' ? 'bg-indgreen' : 'bg-redalert'}`}>
                                                {scanResult.verdict === 'SAFE' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                                            </div>
                                            <div>
                                                <p className={`text-xs font-bold uppercase ${scanResult.verdict === 'SAFE' ? 'text-indgreen' : 'text-redalert'}`}>
                                                    {scanResult.verdict === 'SAFE' ? 'Safe Communication' : `Fraud Probability: ${scanResult.confidence}%`}
                                                </p>
                                                <p className="text-[10px] text-charcoal font-bold mt-1">Pattern: {scanResult.pattern_detected}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Panel */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-indblue p-6 rounded-3xl border border-saffron/20 shadow-xl text-white">
                            <h4 className="font-bold text-sm mb-4 border-b border-white/10 pb-2 uppercase tracking-tighter">UPI Shield Stats</h4>
                            <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[9px] uppercase font-bold text-silver">VPA Checks (24h)</p>
                                        <p className="text-2xl font-bold">{upiStats?.dashboard?.vpa_checks_24h || "1.2k"}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] uppercase font-bold text-indgreen">Flags</p>
                                        <p className="text-lg font-bold">{upiStats?.dashboard?.flags || "14"}</p>
                                    </div>
                                </div>
                                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-saffron h-full" style={{ width: `${upiStats?.dashboard?.vpa_risk_percent || 15}%` }} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                            <h4 className="font-bold text-indblue text-xs mb-4 uppercase tracking-widest">Threat Feed</h4>
                            <div className="space-y-3">
                                {(upiStats?.threat_feed || [
                                    { type: 'ID_COLLECT', risk: 'High', time: '2m ago' },
                                    { type: 'QR_OVERLAY', risk: 'Medium', time: '15m ago' }
                                ]).slice(0, 3).map((threat: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-boxbg rounded-xl border border-silver/5">
                                        <div>
                                            <p className="text-[9px] font-black text-indblue uppercase">{threat.type}</p>
                                            <p className="text-[8px] text-silver font-bold uppercase">{threat.time}</p>
                                        </div>
                                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase ${threat.risk === 'High' ? 'bg-red-100 text-redalert' : 'bg-orange-100 text-saffron'}`}>
                                            {threat.risk}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {activeFeature === 'bharat' && (
            <div className="flex flex-col items-center justify-center flex-1 w-full max-w-4xl py-6 fade-in overflow-y-auto scrollbar-hide">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center w-full">
                {/* Feature Phone UI */}
                <div className="relative w-72 h-[520px] bg-charcoal rounded-[2.5rem] p-6 shadow-2xl border-4 border-white/5 mx-auto">
                  <div className="w-full h-full flex flex-col gap-4">
                    {/* Speaker Grill */}
                    <div className="w-16 h-1 bg-white/10 rounded-full mx-auto" />
                    
                    {/* Small Display */}
                    <div className="w-full h-48 bg-indblue rounded-xl p-4 font-mono text-white flex flex-col border-2 border-white/10 relative overflow-hidden">
                      <div className="absolute top-1 right-2 text-[8px] opacity-50 flex gap-1">
                        <span>4G</span> <Smartphone size={8} />
                      </div>
                      <div className="text-[10px] font-bold border-b border-white/20 pb-1 mb-2">
                        {ussdFlow[ussdStep].title}
                      </div>
                      <div className="flex-1 text-[9px] whitespace-pre-wrap leading-tight text-white/90">
                        {ussdFlow[ussdStep].content}
                      </div>
                      {ussdHistory.slice(-1).map((h, i) => (
                        <div key={i} className="text-[8px] text-saffron mt-2 font-black">{h}</div>
                      ))}
                    </div>

                    {/* Navigation D-Pad */}
                    <div className="grid grid-cols-3 gap-2 px-8">
                      <div />
                      <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/40 ring-1 ring-white/10 hover:bg-white/10 transition-colors"><ArrowRight size={16} className="-rotate-90" /></button>
                      <div />
                      <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/40 ring-1 ring-white/10 hover:bg-white/10 transition-colors"><ArrowRight size={16} className="rotate-180" /></button>
                      <button className="w-10 h-10 bg-saffron rounded-full flex items-center justify-center text-white shadow-lg shadow-saffron/20 border-2 border-white/20" onClick={handleUssdSubmit}>OK</button>
                      <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/40 ring-1 ring-white/10 hover:bg-white/10 transition-colors"><ArrowRight size={16} /></button>
                      <div />
                      <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/40 ring-1 ring-white/10 hover:bg-white/10 transition-colors"><ArrowRight size={16} className="rotate-90" /></button>
                      <div />
                    </div>

                    {/* Numeric Keypad */}
                    <div className="grid grid-cols-3 gap-3">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(key => (
                        <button 
                          key={key}
                          onClick={() => setUssdInput(prev => prev + key)}
                          className="py-3 bg-white/5 rounded-xl text-white font-bold text-xs ring-1 ring-white/5 hover:bg-white/10 active:scale-95 transition-all"
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Info & Instructions */}
                <div className="space-y-8">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-silver/10 shadow-sm">
                    <h4 className="text-[10px] font-black text-indblue uppercase tracking-[0.2em] mb-4">Tactical Protocol</h4>
                    <h3 className="text-2xl font-black text-indblue mb-4 leading-tight">Infrastructure-Level Scam Interception</h3>
                    <p className="text-xs text-silver font-medium leading-relaxed mb-6">
                      The Bharat Layer enables rural citizens on 2G/GSM devices to report crimes via USSD gateways. These reports are directly ingested into the National Command Dashboard for rapid response.
                    </p>
                    <ul className="space-y-4">
                      {[
                        "Enter *193# to trigger USSD menu",
                        "Select scam type via numeric input",
                        "Real-time integration with Agency Portal",
                        "Automatic generation of Section 65B FIR"
                      ].map((text, i) => (
                        <li key={i} className="flex items-center gap-3 text-xs font-bold text-indblue">
                          <div className="w-1.5 h-1.5 bg-saffron rounded-full" /> {text}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-charcoal p-6 rounded-[2rem] border border-white/5 text-white/40 font-mono text-[9px] space-y-2">
                    <p className="text-indgreen">// Network Node Simulation Active</p>
                    <p>USSD_GATEWAY: TRACE_NODE_DELHI_09</p>
                    <p>GSM_SIGNAL: CRYPTO_STABLE_88%</p>
                    <p>ENCRYPTION: AES_256_LOCAL_TUNNEL</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="w-full text-center pb-4 mt-4 shrink-0">
            <p className="text-[9px] font-black text-silver/40 uppercase tracking-[0.4em]">Integrated Anti-Fraud Ops | Sentinel Command</p>
          </footer>
        </div>
      )}

      <FeedModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        data={selectedIncident}
      />
    </div>

  );
}
