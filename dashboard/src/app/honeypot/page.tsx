"use client";

import { useState, useEffect } from "react";
import {
    ShieldAlert,
    MessageSquare,
    User,
    Mic,
    Pause,
    Terminal,
    Brain,
    Loader2
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";


interface Session {
    id: number;
    session_id: string;
    caller_num: string;
    persona: string;
    status: string;
    created_at: string;
}

interface Persona {
    name: string;
    language: string;
    speaker: string;
    pace: number;
}

interface HoneypotStats {
    time_wasted: string;
    data_extracted: number;
    fatigue_index: string;
}

export default function HoneypotPage() {
    const { t } = useLanguage();
    const { performAction } = useActions();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [stats, setStats] = useState<HoneypotStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [sessionsRes, personasRes, statsRes] = await Promise.all([
                    fetch(`${API_BASE}/honeypot/sessions`),
                    fetch(`${API_BASE}/voice/personas`),
                    fetch(`${API_BASE}/honeypot/stats`)
                ]);

                if (sessionsRes.ok) setSessions(await sessionsRes.json());
                if (personasRes.ok) {
                    const data = await personasRes.json();
                    setPersonas(data.personas);
                }
                if (statsRes.ok) setStats(await statsRes.json());
            } catch (error) {
                console.error("Error fetching honeypot data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 20000);
        return () => clearInterval(interval);
    }, []);

    if (isLoading && sessions.length === 0) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-indblue" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-indblue tracking-tight">{t("honeypot_engine")}</h2>
                    <p className="text-silver mt-1">{t("agentic_orchestration")}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => performAction('OPTIMIZE_STRATEGIES')}
                        className="px-4 py-2 bg-white border border-silver/10 rounded-lg text-sm font-semibold text-charcoal hover:bg-boxbg flex items-center gap-2 transition-colors">
                        <Brain size={16} className="text-saffron" />
                        {t("optimize_strategies")}
                    </button>
                    <button
                        onClick={() => performAction('LAUNCH_PROBE')}
                        className="px-4 py-2 bg-saffron text-white rounded-lg text-sm font-semibold hover:bg-deeporange transition-colors">
                        {t("launch_probe")}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Active Sessions */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl border border-silver/10 overflow-hidden">
                        <div className="p-6 border-b border-boxbg flex justify-between items-center bg-boxbg/30">
                            <h3 className="font-bold text-indblue flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-redalert animate-pulse" />
                                {t("live_interceptions")}
                            </h3>
                            <span className="text-[10px] font-bold text-silver uppercase tracking-widest">{sessions.length} {t("sessions_active")}</span>
                        </div>

                        <div className="divide-y divide-boxbg">
                            {sessions.map((session) => (
                                <div key={session.id} className="p-6 hover:bg-boxbg/10 transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-indblue/10 flex items-center justify-center text-indblue">
                                                <MessageSquare size={24} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-charcoal">{session.caller_num}</p>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-boxbg rounded text-silver uppercase tracking-wider">{session.session_id}</span>
                                                </div>
                                                <p className="text-xs text-silver font-medium mt-0.5">{t("persona")}: <span className="text-indblue font-bold">{session.persona}</span></p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-mono font-bold text-charcoal tracking-tighter">
                                                {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <p className="text-[10px] text-silver font-bold uppercase tracking-widest">{session.status}</p>
                                        </div>
                                    </div>

                                    <div className="bg-boxbg/50 p-4 rounded-xl border border-silver/5 mb-4">
                                        <p className="text-[10px] font-bold text-silver uppercase tracking-widest mb-2 flex items-center gap-1">
                                            <Terminal size={12} /> {t("live_transcript")}
                                        </p>
                                        <p className="text-xs italic text-charcoal/80 leading-relaxed">
                                            {t("sample_transcript_placeholder")}
                                        </p>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => performAction('PAUSE_SESSION', session.session_id)}
                                                className="p-2 bg-boxbg text-silver rounded-lg hover:text-redalert transition-colors"><Pause size={16} /></button>
                                            <button
                                                onClick={() => performAction('INTERVENE_SESSION', session.session_id)}
                                                className="p-2 bg-boxbg text-silver rounded-lg hover:text-indblue transition-colors hover:bg-indblue/5 font-bold text-[10px] uppercase px-4">{t("intervene")}</button>
                                        </div>
                                        <div className="text-[10px] font-bold text-indgreen uppercase tracking-widest flex items-center gap-1">
                                            <Mic size={12} /> {t("audio_verified")}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Persona Management */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-silver/10 p-6">
                        <h4 className="font-bold text-indblue mb-6 flex items-center gap-2">
                            <User size={18} className="text-saffron" />
                            {t("persona_library")}
                        </h4>
                        <div className="space-y-4">
                            {personas.map((p) => (
                                <div key={p.name} className={`p-4 rounded-xl border transition-all border-silver/10 bg-white hover:border-indblue/30`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="font-bold text-sm text-indblue">{p.name}</p>
                                        <div className={`w-2 h-2 rounded-full bg-indgreen animate-pulse`} />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-silver font-medium italic">"{p.speaker} voice profile"</p>
                                        <p className="text-[10px] font-bold text-charcoal uppercase tracking-widest">{p.language}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => performAction('CREATE_PERSONA')}
                            className="w-full py-3 mt-6 border-2 border-dashed border-silver/20 rounded-xl text-[10px] font-bold text-silver uppercase tracking-widest hover:border-saffron/40 hover:text-saffron transition-all">
                            {t("create_persona")}
                        </button>
                    </div>

                    <div className="bg-indblue p-6 rounded-2xl border border-saffron/20 text-white shadow-xl">
                        <h4 className="font-bold mb-4 flex items-center gap-2 text-saffron">
                            <ShieldAlert size={18} />
                            {t("extraction_metrics")}
                        </h4>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-silver">{t("time_wasted")}</span>
                                <span className="font-mono font-bold">{stats?.time_wasted || "0h 0m"}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-silver">{t("data_extracted")}</span>
                                <span className="font-mono font-bold">{stats?.data_extracted || "0"}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-silver">{t("fatigue_index")}</span>
                                <span className="font-mono font-bold text-indgreen">{stats?.fatigue_index || "0%"}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
