"use client";

import { useState, useEffect } from "react";
import {
    PhoneIncoming,
    ShieldCheck,
    ShieldAlert,
    History,
    Search,
    Filter,
    ArrowRight,
    Loader2
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";


interface CallRecord {
    id: number;
    number: string;
    location: string;
    score: number;
    status: string;
    timestamp: string;
}

interface DetectionStats {
    risk_vectors: { name: string; value: number }[];
    active_nodes: number;
    latency_ms: number;
}

export default function DetectionGrid() {
    const { t } = useLanguage();
    const { performAction } = useActions();
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [stats, setStats] = useState<DetectionStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterRisk, setFilterRisk] = useState<'ALL' | 'SCAM'>('ALL');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [callsRes, statsRes] = await Promise.all([
                    fetch(`${API_BASE}/detection/calls?limit=10`),
                    fetch(`${API_BASE}/detection/stats`)
                ]);

                if (callsRes.ok) {
                    const callsData = await callsRes.json();
                    setCalls(callsData);
                }

                if (statsRes.ok) {
                    const statsData = await statsRes.json();
                    setStats(statsData);
                }
            } catch (error) {
                console.error("Error fetching detection data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000); // Polling for "live" feel
        return () => clearInterval(interval);
    }, []);

    const filteredCalls = calls.filter(call => {
        const matchesSearch = call.number.includes(searchQuery) || call.location.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRisk = filterRisk === 'ALL' || call.status === 'Scam';
        return matchesSearch && matchesRisk;
    });

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-indblue tracking-tight">{t("detection_grid")}</h2>
                    <p className="text-silver mt-1">{t("telecom_analysis")}</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" size={16} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t("search_number")}
                            className="pl-10 pr-4 py-2 bg-white border border-silver/10 rounded-lg text-sm outline-none focus:border-saffron/40 transition-colors w-64"
                        />
                    </div>
                    <button
                        onClick={() => {
                            setFilterRisk(prev => prev === 'ALL' ? 'SCAM' : 'ALL');
                            performAction('FILTER_RISK', filterRisk === 'ALL' ? 'SCAM' : 'ALL');
                        }}
                        className={`p-2 border rounded-lg transition-colors ${filterRisk === 'SCAM' ? 'bg-redalert text-white border-redalert' : 'bg-white border-silver/10 text-silver hover:text-indblue'}`}>
                        <Filter size={20} />
                    </button>
                </div>
            </div>

            {/* Grid Table */}
            <div className="bg-white rounded-2xl border border-silver/10 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-boxbg flex justify-between items-center">
                    <h3 className="font-bold text-indblue flex items-center gap-2">
                        <History size={18} className="text-saffron" />
                        {t("live_stream")}
                    </h3>
                    <div className="flex gap-2">
                        <span className="text-[10px] font-bold text-indgreen px-2 py-1 bg-indgreen/10 rounded-full uppercase tracking-wider">
                            {calls.length > 0 ? calls.length : 0} {t("calls_per_min")}
                        </span>
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-20 flex justify-center">
                        <Loader2 className="animate-spin text-indblue" size={32} />
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-boxbg/50 text-[10px] font-bold text-silver uppercase tracking-widest">
                                <th className="px-6 py-4">{t("source_number")}</th>
                                <th className="px-6 py-4">{t("inferred_location")}</th>
                                <th className="px-6 py-4 text-center">{t("fraud_risk_index")}</th>
                                <th className="px-6 py-4">{t("verdict")}</th>
                                <th className="px-6 py-4 text-right">{t("activity")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-boxbg">
                            {filteredCalls.map((call) => (
                                <tr key={call.id} className="hover:bg-boxbg/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${call.status === "Scam" ? "bg-redalert/10 text-redalert" : "bg-indblue/10 text-indblue"
                                                }`}>
                                                <PhoneIncoming size={16} />
                                            </div>
                                            <span className="font-mono text-sm font-bold text-charcoal">{call.number}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-silver font-medium">{call.location}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="w-24 h-1.5 bg-boxbg rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 ${call.score > 0.7 ? "bg-redalert" : call.score > 0.3 ? "bg-gold" : "bg-indgreen"
                                                        }`}
                                                    style={{ width: `${call.score * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-mono font-bold">{(call.score * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${call.status === "Scam" ? "bg-redalert/10 text-redalert" :
                                            call.status === "Suspicious" ? "bg-gold/10 text-gold" : "bg-indgreen/10 text-indgreen"
                                            }`}>
                                            {call.status === "Scam" ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                                            {call.status}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3 translate-x-2 group-hover:translate-x-0 transition-transform">
                                            <button
                                                onClick={() => performAction('BLOCK', call.number)}
                                                className="p-1.5 text-redalert hover:bg-redalert/10 rounded-lg transition-colors" title="Block Number">
                                                <ShieldAlert size={16} />
                                            </button>
                                            <button
                                                onClick={() => performAction('VIEW_DETAIL', call.number)}
                                                className="text-[10px] font-bold text-indblue uppercase tracking-widest hover:text-saffron transition-colors flex items-center gap-1">
                                                {t("details")} <ArrowRight size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                <div className="p-4 bg-boxbg/20 flex justify-between items-center px-6">
                    <button
                        onClick={() => performAction('PREV_PAGE')}
                        className="text-[10px] font-bold text-silver uppercase hover:text-indblue transition-colors">
                        {t("previous")}
                    </button>
                    <button
                        onClick={() => performAction('VIEW_HISTORY')}
                        className="text-[10px] font-bold text-silver uppercase tracking-widest hover:text-indblue transition-colors">
                        {t("view_history")}
                    </button>
                    <button
                        onClick={() => performAction('NEXT_PAGE')}
                        className="text-[10px] font-bold text-silver uppercase hover:text-indblue transition-colors">
                        {t("next")}
                    </button>
                </div>
            </div>

            {/* Grid Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-silver/10">
                    <h4 className="font-bold text-indblue mb-4">{t("top_risk_vectors")}</h4>
                    <div className="space-y-4">
                        {stats?.risk_vectors.map((v) => (
                            <div key={v.name} className="flex flex-col gap-1.5">
                                <div className="flex justify-between text-[10px] font-bold uppercase">
                                    <span className="text-charcoal">{v.name}</span>
                                    <span className="text-silver">{v.value}%</span>
                                </div>
                                <div className="w-full h-1 bg-boxbg rounded-full overflow-hidden">
                                    <div className="h-full bg-saffron" style={{ width: `${v.value}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-indblue p-6 rounded-2xl border border-saffron/20 text-white relative overflow-hidden">
                    <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-saffron/10 rounded-full blur-2xl" />
                    <h4 className="font-bold mb-2">{t("network_integrity")}</h4>
                    <p className="text-xs text-silver leading-relaxed pr-8">
                        {t("network_desc")}
                    </p>
                    <div className="mt-6 flex items-center gap-4">
                        <div className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-bold uppercase">{t("active_nodes")}: {stats?.active_nodes || 0}</div>
                        <div className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-bold uppercase">{t("latency")}: {stats?.latency_ms || 0}ms</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
