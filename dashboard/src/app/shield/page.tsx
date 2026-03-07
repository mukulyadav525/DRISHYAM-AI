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

export default function ShieldSimulationPage() {
    const [callState, setCallState] = useState<"idle" | "ringing" | "warning" | "active" | "success">("idle");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    const [autoPlayVoice, setAutoPlayVoice] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [analysis, setAnalysis] = useState<any>(null);
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

    // Focus input when active & in text mode
    useEffect(() => {
        if (callState === "active" && !isVoiceMode) inputRef.current?.focus();
    }, [callState, isVoiceMode]);

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

    const startCall = () => {
        setCallState("ringing");
        setMessages([]);
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
            alert("Microphone access is required for voice mode.");
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
            // Convert webm blob to Base64
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
                    // Send to voice chat pipeline (STT -> AI -> TTS)
                    const res = await fetch(`${API_BASE}/voice/chat`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            audio_base64: base64data,
                            persona: selectedPersona?.id || "Sentinel AI",
                            language: "hi-IN",
                            history: messages.map(m => ({
                                role: m.role === "scammer" ? "user" : "assistant",
                                content: m.text,
                            }))
                        }),
                    });

                    if (res.ok) {
                        const data = await res.json();

                        // Handle empty transcript (mic didn't pick up anything)
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

                        // Display AI Response text & audio
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
                        const errorText = await res.text();
                        console.error("Voice chat error:", errorText);

                        let errorMsg = "Voice Engine Connection Issue";
                        if (errorText.includes("Quota")) errorMsg = "AI Engine Quota Exceeded";
                        else if (errorText.includes("SARVAM")) errorMsg = "Sarvam Voice API unavailable";
                        else if (errorText.includes("ffmpeg")) errorMsg = "Audio processor not available";

                        setMessages(prev => [...prev, {
                            role: "ai",
                            text: `⚠️ [System Error: ${errorMsg}]. Try using Text Mode instead.`,
                            timestamp: new Date(),
                        }]);
                    }
                } catch (fetchErr) {
                    console.error("Voice fetch failed:", fetchErr);
                    setMessages(prev => [...prev, {
                        role: "ai",
                        text: "⚠️ [System: Could not reach voice server. Try Text Mode or check your connection.]",
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

        // Add scammer message to UI immediately
        const scammerMsg: ChatMessage = {
            role: "scammer",
            text,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, scammerMsg]);
        setInputText("");
        setIsLoading(true);

        try {
            // Direct text chat (stateless)
            const chatRes = await fetch(`${API_BASE}/honeypot/direct-chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: text,
                    persona: selectedPersona?.id || "Elderly Uncle",
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

            // If voice mode is on but user typed text, still generate AI audio
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
            const errorMsg: ChatMessage = {
                role: "ai",
                text: "⚠️ [System: API Connection Interrupted.]",
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
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
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] py-12">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-indblue">Sentinel Call Shield</h2>
                <p className="text-silver mt-2">Live AI Voice & Text Simulation</p>
            </div>

            {/* Chat Simulation Active */}

            {/* Mobile Frame Simulation */}
            <div className="relative w-[320px] h-[640px] bg-charcoal rounded-[3rem] border-[8px] border-charcoal shadow-2xl overflow-hidden">
                {/* Phone Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-charcoal rounded-b-2xl z-20" />

                {/* Screen Content */}
                <div className="relative w-full h-full bg-white flex flex-col">
                    {callState === "idle" && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
                            <div className="w-20 h-20 rounded-2xl bg-boxbg flex items-center justify-center text-indblue animate-bounce">
                                <ShieldCheck size={40} />
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-indblue">Shield Active</p>
                                <p className="text-[10px] text-silver uppercase tracking-widest mt-1">
                                    Sentinel Intelligence Active
                                </p>
                            </div>

                            {/* Mode Toggle */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsVoiceMode(false)}
                                    className={`px-4 py-2 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-all ${!isVoiceMode ? "bg-indblue text-white" : "bg-boxbg text-charcoal"
                                        }`}
                                >
                                    <MessageSquare size={12} /> Text Mode
                                </button>
                                <button
                                    onClick={() => setIsVoiceMode(true)}
                                    className={`px-4 py-2 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-all ${isVoiceMode ? "bg-saffron text-white" : "bg-boxbg text-charcoal"
                                        }`}
                                >
                                    <Volume2 size={12} /> Voice Mode
                                </button>
                            </div>

                            <button
                                onClick={startCall}
                                className="mt-4 px-6 py-2.5 bg-indblue text-white rounded-full text-xs font-bold hover:bg-indblue/90 transition-all flex items-center gap-2 shadow-lg"
                            >
                                Start Simulation <Zap size={14} className="text-saffron" />
                            </button>
                        </div>
                    )}

                    {(callState === "ringing" || callState === "warning") && (
                        <div className="flex-1 flex flex-col p-6">
                            <div className="mt-12 text-center">
                                <div className="w-16 h-16 bg-boxbg rounded-full flex items-center justify-center mx-auto mb-4">
                                    <User size={32} className="text-silver" />
                                </div>
                                <h3 className="text-xl font-bold text-charcoal">+91 4190 2341</h3>
                                <p className="text-xs text-silver">Unknown Caller (Mewat Region)</p>
                            </div>

                            <div className="flex-1 flex flex-col justify-center gap-4">
                                {callState === "warning" && (
                                    <div className="bg-redalert/10 border border-redalert/30 p-4 rounded-2xl animate-in fade-in zoom-in duration-500">
                                        <div className="flex items-center gap-3 mb-2">
                                            <ShieldAlert className="text-redalert" size={20} />
                                            <p className="text-sm font-bold text-redalert">SCAM DETECTED</p>
                                        </div>
                                        <p className="text-[10px] text-redalert/80 font-medium">
                                            Sentinel FRI: 98.4%
                                            <br />
                                            Known &quot;KYC Bank&quot; extortion script.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="pb-8 space-y-4">
                                {callState === "warning" && (
                                    <button
                                        onClick={handOffToAI}
                                        className="w-full py-4 bg-indblue text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indblue/95 transition-all shadow-lg"
                                    >
                                        <Brain size={18} className="text-saffron" /> Hand off to AI
                                    </button>
                                )}
                                <div className="flex justify-between px-6">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-12 h-12 bg-indgreen rounded-full flex items-center justify-center text-white cursor-pointer"><Phone size={24} /></div>
                                        <span className="text-[10px] font-bold text-silver">Accept</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-12 h-12 bg-redalert rounded-full flex items-center justify-center text-white cursor-pointer"><X size={24} /></div>
                                        <span className="text-[10px] font-bold text-silver">Decline</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {callState === "active" && (
                        <div className="flex-1 flex flex-col bg-indblue text-white overflow-hidden">
                            {/* Header */}
                            <div className="flex justify-between items-center pt-8 px-4 pb-3">
                                <div className="flex items-center gap-2">
                                    <Brain size={18} className="text-saffron animate-pulse" />
                                    <span className="text-[10px] font-bold tracking-widest">AI ACTIVE</span>
                                    {isVoiceMode && (
                                        <span className="text-[8px] bg-saffron/20 text-saffron px-2 py-0.5 rounded-full font-bold">
                                            🔊 VOICE
                                        </span>
                                    )}
                                </div>
                                <button className="p-1.5 bg-white/10 rounded-full hover:bg-white/20" onClick={endCall}>
                                    <X size={12} />
                                </button>
                            </div>

                            {/* AI Status */}
                            <div className="px-4 pb-2">
                                <span className="text-[8px] bg-white/10 px-2 py-1 rounded-full text-silver">
                                    Multilingual Honeypot Active
                                </span>
                            </div>

                            {/* Chat Messages */}
                            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 scrollbar-hide">
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === "scammer" ? "justify-end" : "justify-start"}`}>
                                        <div
                                            className={`max-w-[85%] p-3 rounded-2xl text-[11px] leading-relaxed flex flex-col ${msg.role === "scammer"
                                                ? "bg-saffron/20 border border-saffron/30 text-white/90 rounded-br-sm"
                                                : "bg-white/10 border border-white/10 text-white rounded-bl-sm"
                                                }`}
                                        >
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-silver">
                                                    {msg.role === "scammer" ? "You (Scammer)" : "AI Agent"}
                                                </span>
                                            </div>
                                            <p>{msg.text}</p>
                                            {msg.audioBase64 && (
                                                <button
                                                    onClick={() => playAudio(msg.audioBase64!)}
                                                    className="mt-2 flex items-center gap-1 text-[9px] text-saffron hover:text-saffron/80 font-bold self-start"
                                                >
                                                    <Volume2 size={10} /> Play Voice
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-white/10 border border-white/10 p-3 rounded-2xl rounded-bl-sm">
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
                            <div className="px-3 pb-4 pt-2 border-t border-white/10">
                                {isVoiceMode ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <button
                                            onMouseDown={startRecording}
                                            onMouseUp={stopRecording}
                                            onMouseLeave={stopRecording}
                                            onTouchStart={startRecording}
                                            onTouchEnd={stopRecording}
                                            disabled={isLoading}
                                            className={`p-4 rounded-full transition-all shadow-lg ${isRecording
                                                ? "bg-redalert text-white scale-110 animate-pulse ring-4 ring-redalert/30"
                                                : "bg-saffron text-white hover:bg-saffron/90"
                                                } ${isLoading ? "opacity-30 cursor-not-allowed" : ""}`}
                                        >
                                            {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Mic size={24} />}
                                        </button>
                                        <span className="text-[10px] text-silver font-medium text-center">
                                            {isRecording ? "Listening... Release to send" : "Hold microphone to speak as scammer"}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={inputText}
                                            onChange={(e) => setInputText(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Type as scammer..."
                                            disabled={isLoading}
                                            className="flex-1 bg-white/10 border border-white/10 rounded-full px-4 py-2.5 text-[11px] placeholder:text-white/30 focus:outline-none focus:border-saffron/50 text-white disabled:opacity-50"
                                        />
                                        <button
                                            onClick={sendMessage}
                                            disabled={isLoading || !inputText.trim()}
                                            className="p-2.5 bg-saffron rounded-full text-white hover:bg-saffron/80 disabled:opacity-30 transition-all"
                                        >
                                            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                        </button>
                                    </div>
                                )}

                                {/* Stats */}
                                <div className="flex justify-between mt-3 px-1">
                                    <span className="text-[8px] text-silver">
                                        {messages.filter(m => m.role === "scammer").length} msgs sent
                                    </span>
                                    <span className="text-[8px] text-indgreen font-bold">
                                        Extracting Intel...
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {callState === "success" && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 bg-boxbg/5 animate-in slide-in-from-bottom duration-700">
                            <div className="w-16 h-16 rounded-full bg-indgreen flex items-center justify-center text-white shadow-lg shadow-indgreen/20">
                                <ShieldCheck size={32} />
                            </div>

                            <div className="text-center">
                                <h4 className="font-bold text-indblue text-lg">Scam Neutralized</h4>
                                <p className="text-[10px] text-silver mt-1 px-4 leading-relaxed">
                                    Evidence extracted. Intelligence shared with law enforcement.
                                </p>
                            </div>

                            {/* Intelligence Box */}
                            <div className="w-full bg-white rounded-2xl border border-indblue/5 shadow-sm p-3 space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[9px] font-bold text-silver uppercase">Intel Extracted</span>
                                    <div className="flex gap-1">
                                        <div className="w-1 h-1 bg-indgreen rounded-full animate-pulse" />
                                        <div className="w-1 h-1 bg-indgreen rounded-full animate-pulse [animation-delay:0.2s]" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[11px] bg-boxbg/30 p-2 rounded-lg">
                                        <span className="text-silver">Type:</span>
                                        <span className="font-bold text-indblue">{analysis?.analysis?.scam_type || "FRAUD_ATTEMPT"}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] bg-boxbg/30 p-2 rounded-lg">
                                        <span className="text-silver">Targeted:</span>
                                        <span className="font-bold text-indblue">{analysis?.analysis?.bank_name || "Muti-Bank"}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Warning Status */}
                            <div className="w-full bg-saffron/5 border border-saffron/20 rounded-xl p-2 px-3">
                                <p className="text-[9px] text-saffron font-bold uppercase mb-1">Warning Sent To:</p>
                                <div className="flex flex-wrap gap-1">
                                    {analysis?.reported_to?.slice(0, 2).map((agency: string, i: number) => (
                                        <span key={i} className="text-[8px] bg-saffron/10 text-saffron px-1.5 py-0.5 rounded-sm font-medium border border-saffron/10">
                                            {agency}
                                        </span>
                                    ))}
                                    <span className="text-[8px] bg-saffron/10 text-saffron px-1.5 py-0.5 rounded-sm font-medium border border-saffron/10">+2 Others</span>
                                </div>
                            </div>

                            {/* User Action: Block */}
                            <div className="w-full mt-1">
                                <button
                                    onClick={toggleBlock}
                                    className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md ${isBlocked
                                        ? "bg-redalert/10 text-redalert border border-redalert/20"
                                        : "bg-redalert text-white hover:bg-redalert/90"
                                        }`}
                                >
                                    {isBlocked ? <ShieldAlert size={14} /> : <Lock size={14} />}
                                    {isBlocked ? "NUMBER BLOCKED" : "BLOCK SCAMMER"}
                                </button>
                            </div>

                            <button
                                onClick={() => { setCallState("idle"); setMessages([]); setAnalysis(null); setIsBlocked(false); }}
                                className="mt-2 text-indblue font-bold text-[10px] flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
                            >
                                Back to Shield <ArrowRight size={12} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Home Indicator */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-charcoal/20 rounded-full" />
            </div>

            {/* Desktop Explanation */}
            <div className="max-w-2xl text-center grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
                <div className="p-4 bg-white rounded-xl border border-silver/10">
                    <div className="w-8 h-8 rounded-lg bg-boxbg flex items-center justify-center text-indblue mx-auto mb-3">
                        <Lock size={16} />
                    </div>
                    <p className="text-xs font-bold text-indblue uppercase mb-1">Detection</p>
                    <p className="text-[10px] text-silver leading-relaxed">AI identifies the scam script via real-time Gemini analysis before you respond.</p>
                </div>
                <div className="p-4 bg-white rounded-xl border border-silver/10">
                    <div className="w-8 h-8 rounded-lg bg-boxbg flex items-center justify-center text-indblue mx-auto mb-3">
                        <Volume2 size={16} />
                    </div>
                    <p className="text-xs font-bold text-indblue uppercase mb-1">Voice AI</p>
                    <p className="text-[10px] text-silver leading-relaxed">Sarvam Bulbul v2 generates natural Indian-language voice responses in real-time.</p>
                </div>
                <div className="p-4 bg-white rounded-xl border border-silver/10">
                    <div className="w-8 h-8 rounded-lg bg-boxbg flex items-center justify-center text-indblue mx-auto mb-3">
                        <Brain size={16} />
                    </div>
                    <p className="text-xs font-bold text-indblue uppercase mb-1">Extraction</p>
                    <p className="text-[10px] text-silver leading-relaxed">AI keeps scammers engaged while extracting forensic evidence for law enforcement.</p>
                </div>
            </div>
        </div>
    );
}
