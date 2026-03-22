"use client";

import { useState, useEffect } from "react";
import {
    ScanEye,
    Share2,
    Activity,
    Brain,
    Clock,
    ShieldAlert,
    FileJson,
    Download,
    MapPin,
    TrendingUp,
    Search,
    ChevronRight,
    Lock,
    Users,
    Fingerprint,
    Scale,
    Loader2
} from "lucide-react";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";

interface Cluster {
    id: string;
    risk: string;
    location: string;
    linkedVPAs: number;
    calls: number;
}

interface VoiceStressProfile {
    stress_score: number;
    script_reading_fatigue: number;
    shift_change_detected: boolean;
    operator_consistency: string;
}

interface CareerProfile {
    profile_id: string;
    career_timeline: { date: string; role: string }[];
    hierarchy_level: string;
    promotion_detected: boolean;
    total_attempts_estimated: number;
}

interface ProsecutionProfile {
    readiness_score: number;
    court_ready: boolean;
    gaps: string[];
    economic_damage_inr: number;
    sentencing_recommendation: string;
}

export default function ProfilingPage() {
    const { performAction, downloadSimulatedFile } = useActions();
    const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [voiceStress, setVoiceStress] = useState<VoiceStressProfile | null>(null);
    const [careerProfile, setCareerProfile] = useState<CareerProfile | null>(null);
    const [prosecutionProfile, setProsecutionProfile] = useState<ProsecutionProfile | null>(null);

    useEffect(() => {
        const fetchClusters = async () => {
            try {
                const res = await fetch(`${API_BASE}/profiling/clusters`);
                if (res.ok) setClusters(await res.json());
            } catch (error) {
                console.error("Error fetching clusters:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchClusters();
    }, []);

    useEffect(() => {
        if (!selectedCluster) {
            setVoiceStress(null);
            setCareerProfile(null);
            setProsecutionProfile(null);
            return;
        }

        const loadClusterProfiles = async () => {
            const body = JSON.stringify({ cluster_id: selectedCluster });
            const headers = { "Content-Type": "application/json" };
            const [voiceRes, careerRes, prosecutionRes] = await Promise.all([
                fetch(`${API_BASE}/profiling/voice-stress/analyse`, { method: "POST", headers, body }),
                fetch(`${API_BASE}/profiling/career-graph/build`, { method: "POST", headers, body }),
                fetch(`${API_BASE}/profiling/prosecution/score`, { method: "POST", headers, body }),
            ]);

            if (voiceRes.ok) setVoiceStress(await voiceRes.json());
            if (careerRes.ok) setCareerProfile(await careerRes.json());
            if (prosecutionRes.ok) setProsecutionProfile(await prosecutionRes.json());
        };

        loadClusterProfiles().catch((error) => {
            console.error("Cluster profile load failed:", error);
        });
    }, [selectedCluster]);

    const selectedClusterData = clusters.find((cluster) => cluster.id === selectedCluster) || null;
    const heatmapBars = Array.from({ length: 24 }).map((_, index) => {
        const base = selectedClusterData ? selectedClusterData.calls : 8;
        return 25 + ((base + index * 7) % 60);
    });

    const handleExport = async () => {
        if (!selectedClusterData) {
            toast.error("Select a cluster first");
            return;
        }
        setIsExporting(true);
        try {
            await performAction('EXPORT_INTERPOL', selectedClusterData.id, {
                location: selectedClusterData.location,
                linked_vpas: selectedClusterData.linkedVPAs,
                honeypot_hits: selectedClusterData.calls,
                risk_level: selectedClusterData.risk,
            });
            await downloadSimulatedFile('INTERPOL_DOSSIER', 'json', {
                targetId: selectedClusterData.id,
                context: {
                    cluster_id: selectedClusterData.id,
                    location: selectedClusterData.location,
                    linked_vpas: selectedClusterData.linkedVPAs,
                    honeypot_hits: selectedClusterData.calls,
                    risk_level: selectedClusterData.risk,
                    entities: careerProfile?.career_timeline || [],
                },
            });
        } finally {
            setIsExporting(false);
        }
    };

    if (isLoading && clusters.length === 0) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-indblue" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-indblue tracking-tight underline decoration-redalert decoration-4 underline-offset-8">Scammer Reverse Profiling</h2>
                    <p className="text-silver mt-4 italic font-medium">De-anonymizing domestic scam clusters via Honeypot Intelligence (Module 11).</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-white p-3 rounded-2xl border border-silver/10 shadow-sm flex items-center gap-3">
                        <ScanEye className="text-redalert" size={20} />
                        <div>
                            <p className="text-[10px] font-bold text-indblue uppercase leading-none">Intelligence Mode</p>
                            <p className="text-xs font-bold text-redalert uppercase">Proactive Search Active</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Cluster Intelligence Map & List */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-indblue flex items-center gap-2">
                                <Share2 size={20} className="text-indblue" />
                                Cluster Intelligence Graph
                            </h3>
                            <div className="flex gap-2">
                                <span className="text-[8px] font-bold px-2 py-1 bg-indblue text-white rounded uppercase">View: Scam Pods</span>
                            </div>
                        </div>

                        {/* Graph Simulation */}
                        <div className="h-80 bg-charcoal rounded-3xl border border-white/5 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                {/* Simulated Nodes */}
                                <div className="relative">
                                    <div className="w-16 h-16 bg-redalert/20 rounded-full border-2 border-redalert animate-pulse flex items-center justify-center z-10 relative">
                                        <div className="w-4 h-4 bg-redalert rounded-full" />
                                    </div>
                                    <div className="absolute top-[-40px] left-[-60px] w-20 h-20 bg-indblue/10 rounded-full border border-indblue/30 flex items-center justify-center">
                                        <div className="w-2 h-2 bg-indblue rounded-full" />
                                    </div>
                                    <div className="absolute bottom-[-20px] right-[-80px] w-24 h-24 bg-saffron/10 rounded-full border border-saffron/30 flex items-center justify-center">
                                        <div className="w-2 h-2 bg-saffron rounded-full" />
                                    </div>
                                    {/* Connection Lines (Simulated) */}
                                    <div className="absolute top-1/2 left-1/2 w-[120px] h-[1px] bg-redalert/30 -translate-y-1/2 -translate-x-[110px] rotate-[30deg]" />
                                    <div className="absolute top-1/2 left-1/2 w-[140px] h-[1px] bg-redalert/30 -translate-y-1/2 translate-x-10 rotate-[-15deg]" />
                                </div>
                            </div>
                            <div className="absolute bottom-4 left-4 text-[10px] font-mono text-white/40 space-y-1">
                                <p>CLUSTER_ID: POD-72X</p>
                                <p>COORD: 28.6139° N, 77.2090° E</p>
                            </div>
                            <div className="absolute top-4 right-4 flex gap-2">
                                <div className="flex bg-black/40 p-2 rounded-lg gap-3 backdrop-blur-md border border-white/5">
                                    <div className="flex items-center gap-1 text-[8px] text-white">
                                        <div className="w-1.5 h-1.5 rounded-full bg-redalert" /> PODS
                                    </div>
                                    <div className="flex items-center gap-1 text-[8px] text-white">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indblue" /> VPAs
                                    </div>
                                    <div className="flex items-center gap-1 text-[8px] text-white">
                                        <div className="w-1.5 h-1.5 rounded-full bg-saffron" /> PHONES
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pod List */}
                        <div className="mt-6 space-y-3">
                            {clusters.map((c: Cluster) => (
                                <div
                                    key={c.id}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${selectedCluster === c.id ? 'bg-indblue/5 border-indblue' : 'bg-boxbg border-silver/5 hover:border-indblue/30'}`}
                                    onClick={() => setSelectedCluster(c.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-xl bg-white border border-silver/10 ${c.risk === 'CRITICAL' ? 'text-redalert' : 'text-indblue'}`}>
                                            <Fingerprint size={18} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-indblue text-sm">{c.id} - {c.location}</h4>
                                            <p className="text-[10px] font-bold text-silver uppercase tracking-tight">Linked: {c.linkedVPAs} VPAs | {c.calls} Honeypot Hits</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                    <span className={`text-[8px] font-bold px-2 py-1 rounded uppercase ${c.risk === 'CRITICAL' ? 'bg-redalert text-white' : 'bg-indblue/10 text-indblue'}`}>
                                            {c.risk} Risk
                                        </span>
                                        <ChevronRight size={16} className="text-silver group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Psych Console */}
                    <div className="bg-indblue p-8 rounded-3xl border border-saffron/20 shadow-xl text-white relative overflow-hidden">
                        <Brain size={120} className="absolute -right-8 -bottom-8 text-white/5" />
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <Activity className="text-saffron" size={24} />
                                <h3 className="text-xl font-bold uppercase tracking-tight">Psychological Profiling Console</h3>
                            </div>
                            <span className="text-[10px] font-bold bg-white/10 px-3 py-1 rounded-full border border-white/10 uppercase">Live Call Analysis (Sim)</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-saffron">
                                    <span>Voice Stress Level</span>
                                    <span>{voiceStress ? `${voiceStress.stress_score}%` : "--"}</span>
                                </div>
                                <div className="h-12 flex gap-1 items-end">
                                    {Array.from({ length: 8 }).map((_, index) => {
                                        const value = voiceStress ? Math.max(10, Math.min(100, voiceStress.stress_score - index * 6)) : 8;
                                        return (
                                            <div
                                                key={index}
                                                className="flex-1 rounded-t bg-saffron/70"
                                                style={{ height: `${value}%` }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-indgreen">
                                    <span>Aggression Index</span>
                                    <span>{voiceStress ? `${Math.round(voiceStress.script_reading_fatigue * 100)}%` : "--"}</span>
                                </div>
                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-indgreen" style={{ width: `${Math.round((voiceStress?.script_reading_fatigue || 0) * 100)}%` }} />
                                </div>
                                <p className="text-[10px] italic opacity-60">
                                    Technique detected: {voiceStress ? voiceStress.operator_consistency.replaceAll("_", " ") : "Awaiting Analysis..."}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 bg-black/20 rounded-2xl border border-white/5 font-mono text-[10px] space-y-1">
                            <p className="text-indgreen">// Behavioral Attribution</p>
                            <p className="opacity-60 text-white leading-loose">
                                {careerProfile
                                    ? `${careerProfile.hierarchy_level} profile with ${careerProfile.total_attempts_estimated} estimated attempts.`
                                    : "Awaiting real-time call analysis..."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Panel Tools */}
                <div className="lg:col-span-4 space-y-6">

                    {/* LEA Tool: Prosecution Readiness */}
                    <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-2 mb-6">
                            <Scale className="text-indblue" size={20} />
                            <h4 className="font-bold text-indblue text-sm uppercase">Law Enforcement Toolkit</h4>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-bold text-silver uppercase">
                                    <span>Prosecution Readiness</span>
                                    <span className="text-indblue">{prosecutionProfile ? `${prosecutionProfile.readiness_score}%` : "--%"}</span>
                                </div>
                                <div className="h-2 w-full bg-boxbg rounded-full overflow-hidden">
                                    <div className="h-full bg-indblue" style={{ width: `${prosecutionProfile?.readiness_score || 0}%` }} />
                                </div>
                            </div>

                            <div className="space-y-3">
                                {(prosecutionProfile?.gaps || []).map((gap) => (
                                    <div key={gap} className="p-3 bg-boxbg rounded-xl border border-silver/5">
                                        <p className="text-[10px] font-bold uppercase text-silver">Gap</p>
                                        <p className="text-[11px] font-bold text-charcoal mt-1">{gap}</p>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => {
                                    if (!selectedCluster) return toast.error("Select a cluster first");
                                    performAction('REVEAL_PROFILE', selectedCluster);
                                }}
                                className="w-full bg-indblue text-white font-bold py-3 rounded-xl hover:bg-indblue/90 shadow-lg flex items-center justify-center gap-2 text-xs">
                                <Lock size={14} />
                                REVEAL FULL CLUSTER PROFILE
                            </button>
                        </div>
                    </div>

                    {/* Interpol / Global Export */}
                    <div className="bg-charcoal p-6 rounded-3xl border border-white/10 shadow-sm text-white relative overflow-hidden">
                        <Download size={80} className="absolute -right-6 -top-6 text-white/5" />
                        <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
                            <FileJson className="text-indgreen" size={16} />
                            Intelligence Export
                        </h4>
                        <p className="text-[10px] opacity-60 mb-6 leading-relaxed">
                            Package cluster data into international law enforcement formats (JSON-LD / Interpol Stix v2.1) for cross-border cooperation.
                        </p>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="w-full bg-indgreen text-charcoal font-bold py-3 rounded-xl hover:bg-indgreen/90 transition-all flex items-center justify-center gap-2 text-xs"
                        >
                            {isExporting ? <Activity className="animate-spin" size={14} /> : <Download size={14} />}
                            {isExporting ? 'PACKAGING DATA...' : 'EXPORT TO INTERPOL PORTAL'}
                        </button>
                    </div>

                    {/* Operational Heatmap */}
                    <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock className="text-saffron" size={20} />
                            <h4 className="font-bold text-indblue text-sm uppercase tracking-tight text-xs">Operational Shift-Change</h4>
                        </div>
                        <div className="grid grid-cols-12 gap-1 h-32 items-end">
                            {heatmapBars.map((height, i) => (
                                <div
                                    key={i}
                                    className={`w-full rounded-t-sm transition-all duration-500 ${i > 8 && i < 20 ? 'bg-indblue' : 'bg-silver/10'}`}
                                    style={{ height: `${height}%` }}
                                />
                            ))}
                        </div>
                        <div className="flex justify-between mt-2 text-[8px] font-bold text-silver uppercase">
                            <span>00:00</span>
                            <span>SHIFTS ACTIVE (IST)</span>
                            <span>23:59</span>
                        </div>
                        <div className="mt-4 p-3 bg-indblue/5 rounded-xl border border-indblue/10">
                            <p className="text-[10px] font-bold text-indblue leading-snug">
                                {selectedClusterData
                                    ? `${selectedClusterData.id} is mapped to ${selectedClusterData.calls} honeypot hits and ${selectedClusterData.linkedVPAs} linked VPAs.`
                                    : "Select a cluster to generate temporal patterns."}
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
