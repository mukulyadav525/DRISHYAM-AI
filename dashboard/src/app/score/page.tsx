"use client";

import { useState, useEffect } from "react";
import {
    Activity,
    ShieldCheck,
    Globe,
    Users,
    ArrowUpRight,
    Info,
    Code,
    Lock,
    Search,
    IndianRupee,
    BarChart3,
    CheckCircle2,
    Database,
    Cpu,
    RefreshCw,
    Download
} from "lucide-react";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";


interface ScoreStats {
    national: { value: number; change: string; nodes: number; heatmap: number[] };
    factors: { label: string; value: string; percent: number }[];
}

export default function ScorePage() {
    const { performAction, downloadSimulatedFile } = useActions();
    const [citizenId, setCitizenId] = useState("");
    const [isComputing, setIsComputing] = useState(false);
    const [shownScore, setShownScore] = useState<number | null>(null);
    const [data, setData] = useState<ScoreStats | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`${API_BASE}/system/stats/score`);
                if (res.ok) setData(await res.json());
            } catch (error) {
                console.error("Error fetching score stats:", error);
            }
        };
        fetchStats();
    }, []);

    const computeScore = async () => {
        if (!citizenId) return;
        setIsComputing(true);
        setShownScore(null);

        try {
            const res = await fetch(`${API_BASE}/system/stats/score/compute?uid=${citizenId}`);
            if (res.ok) {
                const result = await res.json();
                setShownScore(result.score);
            } else {
                setShownScore(0);
            }
        } catch (error) {
            console.error("Error computing score:", error);
            setShownScore(0);
        } finally {
            setIsComputing(false);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-indblue tracking-tight underline decoration-saffron decoration-4 underline-offset-8">Sentinel Score Engine</h2>
                    <p className="text-silver mt-4 italic font-medium">Real-time "Cyber Hygiene" metric for the 1.4B Indian Citizenry.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setIsRefreshing(true);
                            performAction('REFRESH_SCORE');
                            setTimeout(() => {
                                setIsRefreshing(false);
                                toast.success("Cyber Immunity Index Updated");
                            }, 1500);
                        }}
                        disabled={isRefreshing}
                        className="px-4 py-2 bg-white border border-silver/10 rounded-lg text-sm font-semibold text-charcoal hover:bg-boxbg flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={isRefreshing ? "animate-spin text-saffron" : "text-silver"} />
                        {isRefreshing ? "Calculating..." : "Refresh Analysis"}
                    </button>
                    <button
                        onClick={() => performAction('VIEW_SCORE_HISTORY')}
                        className="px-4 py-2 bg-white border border-silver/10 rounded-lg text-sm font-semibold text-charcoal hover:bg-boxbg flex items-center gap-2 transition-colors">
                        <Activity size={16} className="text-silver" />
                        View History
                    </button>
                    <div className="bg-white p-3 rounded-2xl border border-silver/10 shadow-sm flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-indgreen animate-ping" />
                        <p className="text-[10px] font-bold text-indblue uppercase">Live Score Nodes: {data?.national?.nodes?.toLocaleString() || "4,520"}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Score Visualization & Breakdown */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-xl font-bold text-indblue">National Cyber Immunity Index</h3>
                                <p className="text-xs text-silver mt-1">Aggregated trust score across all operational districts.</p>
                            </div>
                            <div className="text-right">
                                <span className="text-4xl font-black text-indblue tracking-tighter">{data?.national?.value ?? "0"}</span>
                                <p className="text-[10px] uppercase font-bold text-indgreen flex items-center justify-end gap-1">
                                    <ArrowUpRight size={12} /> {data?.national?.change || "0%"}
                                </p>
                            </div>
                        </div>

                        {/* Simulated Heatmap Placeholder */}
                        <div className="h-64 bg-boxbg rounded-3xl border border-silver/5 flex items-center justify-center relative overflow-hidden group">
                            <Globe size={180} className="text-silver/10 absolute -right-20 -bottom-20 group-hover:scale-110 transition-transform duration-1000" />
                            <div className="z-10 text-center">
                                <p className="text-[10px] font-bold text-silver uppercase tracking-widest mb-4">Regional Distribution</p>
                                <div className="flex gap-4 items-end h-32">
                                    {data?.national?.heatmap && Array.isArray(data.national.heatmap) ? data.national.heatmap.map((h, i) => (
                                        <div key={i} className="w-8 bg-indblue rounded-t-lg transition-all duration-700 hover:bg-saffron cursor-help" style={{ height: `${h}%` }} />
                                    )) : (
                                        [45, 62, 38, 55, 72, 48].map((h, i) => (
                                            <div key={i} className="w-8 bg-indblue/20 rounded-t-lg" style={{ height: `${h}%` }} />
                                        ))
                                    )}
                                </div>
                                <div className="flex justify-between mt-2 text-[8px] font-bold text-silver uppercase">
                                    <span>North</span>
                                    <span>South</span>
                                    <span>East</span>
                                    <span>West</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                            {data?.factors && Array.isArray(data.factors) ? data.factors.map(f => (
                                <div key={f.label} className="p-4 bg-boxbg rounded-2xl border border-silver/5">
                                    <p className="text-[10px] font-bold text-silver uppercase mb-2">{f.label}</p>
                                    <p className="text-lg font-bold text-indblue">{f.value}</p>
                                    <div className="w-full h-1 bg-silver/10 rounded-full mt-2">
                                        <div className={`h-full ${f.percent > 90 ? 'bg-indgreen' : 'bg-saffron'}`} style={{ width: `${f.percent}%` }} />
                                    </div>
                                </div>
                            )) : (
                                <p className="text-[10px] text-silver italic">No factors currently analyzed.</p>
                            )}
                        </div>
                    </div>

                    {/* API Documentation Section */}
                    <div className="bg-indblue p-8 rounded-3xl border border-saffron/20 shadow-xl text-white overflow-hidden relative">
                        <Code size={100} className="absolute -right-8 -top-8 text-white/5 rotate-12" />
                        <div className="flex items-center gap-2 mb-6">
                            <Lock className="text-saffron" size={20} />
                            <h3 className="text-xl font-bold">Guardian API: Bank Integration</h3>
                        </div>
                        <div className="bg-black/20 font-mono text-xs p-6 rounded-2xl border border-white/10 space-y-4">
                            <div className="flex gap-4">
                                <span className="text-indgreen font-bold">GET</span>
                                <span className="text-white/60">/api/v1/citizen/trust-score?uid=AADHAAR_HASH</span>
                            </div>
                            <div className="text-white/40 border-t border-white/5 pt-4">
                                <p className="mb-2">// Sample Response</p>
                                <pre className="text-indgreen">
                                    {`{
  "score": "...",
  "verdict": "PENDING",
  "factors": {}
}`}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Simulation & Tools */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-2 mb-6">
                            <Cpu className="text-saffron" size={20} />
                            <h4 className="font-bold text-indblue text-sm">Citizen Score Simulator</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-silver uppercase">Citizen Identifier (Aadhaar/Phone Hash)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={citizenId}
                                        onChange={(e) => setCitizenId(e.target.value)}
                                        placeholder="e.g. hash_7822x..."
                                        className="flex-1 p-3 bg-boxbg rounded-xl border border-silver/10 text-xs font-mono outline-none focus:border-saffron"
                                    />
                                    <button
                                        onClick={computeScore}
                                        disabled={isComputing}
                                        className="bg-indblue text-white p-3 rounded-xl hover:bg-saffron transition-colors disabled:opacity-50"
                                    >
                                        <Search size={16} />
                                    </button>
                                </div>
                            </div>

                            {isComputing && (
                                <div className="py-8 text-center animate-pulse">
                                    <Database className="mx-auto text-silver mb-2 animate-bounce" size={24} />
                                    <p className="text-[10px] text-silver font-bold uppercase">Polling Detection Nodes...</p>
                                </div>
                            )}

                            {shownScore && (
                                <div className="p-6 bg-boxbg rounded-2xl border border-silver/10 text-center animate-in zoom-in-95 duration-500">
                                    <p className="text-[10px] font-bold text-silver uppercase">Computed Score</p>
                                    <h5 className={`text-5xl font-black my-2 tracking-tighter ${shownScore > 700 ? 'text-indgreen' : 'text-redalert'}`}>
                                        {shownScore}
                                    </h5>
                                    <div className="flex items-center justify-center gap-2">
                                        <ShieldCheck className={shownScore > 700 ? 'text-indgreen' : 'text-redalert'} size={14} />
                                        <p className="text-[10px] font-bold text-charcoal uppercase">
                                            Verdict: {shownScore > 700 ? 'Level 1 Trust' : 'Requires Inoculation'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => downloadSimulatedFile('CITIZEN_SCORE_AUDIT', 'pdf')}
                            className="w-full mt-6 py-3 bg-indblue/5 border border-indblue/10 rounded-xl text-[10px] font-bold text-indblue uppercase tracking-widest hover:bg-indblue hover:text-white transition-all flex items-center justify-center gap-2">
                            <Download size={14} />
                            Download Full Financial Audit
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                        <h4 className="font-bold text-indblue text-sm mb-4">Factor Weightage (v2.1)</h4>
                        <div className="space-y-4">
                            {[
                                { label: 'Inoculation Drills', weight: '--', icon: Activity },
                                { label: 'VPA Reputation', weight: '--', icon: IndianRupee },
                                { label: 'Deepfake History', weight: '--', icon: ShieldCheck },
                                { label: 'Report Accuracy', weight: '--', icon: BarChart3 },
                            ].map((f, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-boxbg rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <f.icon className="text-silver" size={14} />
                                        <p className="text-[11px] font-bold text-charcoal">{f.label}</p>
                                    </div>
                                    <p className="text-[11px] font-bold text-indblue">{f.weight}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
