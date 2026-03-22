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
import FeedModal from "@/components/FeedModal";
import { useRouter } from "next/navigation";


interface CallRecord {
    id: number;
    number: string;
    location: string;
    score: number;
    status: string;
    recommended_action: string;
    honeypot_candidate: boolean;
    timestamp: string;
}

interface DetectionStats {
    risk_vectors: { name: string; value: number }[];
    active_nodes: number;
    latency_ms: number;
    routing: {
        honeypot_candidates: number;
        flag_and_warn: number;
        allow: number;
    };
}

export default function DetectionGrid() {
    const router = useRouter();
    const { t } = useLanguage();
    const { performAction } = useActions();
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [stats, setStats] = useState<DetectionStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterRisk, setFilterRisk] = useState<'ALL' | 'SCAM'>('ALL');
    const [selectedCall, setSelectedCall] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [page, setPage] = useState(1);
    const pageSize = 5;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [callsRes, statsRes] = await Promise.all([
                    fetch(`${API_BASE}/detection/calls?limit=10`),
                    fetch(`${API_BASE}/detection/stats`)
                ]);

                if (callsRes.ok) {
                    const callsData = await callsRes.json();
                    setCalls(Array.isArray(callsData) ? callsData : []);
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

    const filteredCalls = (calls || []).filter(call => {
        const matchesSearch = call.number?.includes(searchQuery) || call.location?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRisk = filterRisk === 'ALL' || call.status === 'Scam';
        return matchesSearch && matchesRisk;
    });
    const totalPages = Math.max(1, Math.ceil(filteredCalls.length / pageSize));
    const currentCalls = filteredCalls.slice((page - 1) * pageSize, page * pageSize);

    useEffect(() => {
        setPage(1);
    }, [searchQuery, filterRisk]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    return (
        <div className="space-y-6 sm:space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-indblue tracking-tight">{t("detection_grid")}</h2>
                    <p className="text-silver mt-1 text-sm">{t("telecom_analysis")}</p>
                </div>
                <div className="flex gap-3 sm:gap-4">
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" size={16} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t("search_number")}
                            className="pl-10 pr-4 py-2 bg-white border border-silver/10 rounded-lg text-sm outline-none focus:border-saffron/40 transition-colors w-full sm:w-64"
                        />
                    </div>
                    <button
                        onClick={() => {
                            setFilterRisk(prev => prev === 'ALL' ? 'SCAM' : 'ALL');
                            performAction('FILTER_RISK', filterRisk === 'ALL' ? 'SCAM' : 'ALL');
                        }}
                        className={`p-2 border rounded-lg transition-colors flex-shrink-0 ${filterRisk === 'SCAM' ? 'bg-redalert text-white border-redalert' : 'bg-white border-silver/10 text-silver hover:text-indblue'}`}>
                        <Filter size={20} />
                    </button>
                </div>
            </div>

            {/* Grid Table */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-silver/10 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Honeypot Routes</p>
                    <p className="text-2xl font-black text-redalert mt-2">{stats?.routing?.honeypot_candidates || 0}</p>
                    <p className="text-xs text-silver mt-2">Calls ready to route into AI interception.</p>
                </div>
                <div className="bg-white rounded-2xl border border-silver/10 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Flag and Warn</p>
                    <p className="text-2xl font-black text-gold mt-2">{stats?.routing?.flag_and_warn || 0}</p>
                    <p className="text-xs text-silver mt-2">Suspicious calls still under citizen-side caution workflow.</p>
                </div>
                <div className="bg-white rounded-2xl border border-silver/10 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Allow</p>
                    <p className="text-2xl font-black text-indgreen mt-2">{stats?.routing?.allow || 0}</p>
                    <p className="text-xs text-silver mt-2">Low-risk calls cleared by the current scoring model.</p>
                </div>
            </div>

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
                    <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="bg-boxbg/50 text-[10px] font-bold text-silver uppercase tracking-widest">
                                <th className="px-6 py-4">{t("source_number")}</th>
                                <th className="px-6 py-4">{t("inferred_location")}</th>
                                <th className="px-6 py-4 text-center">{t("fraud_risk_index")}</th>
                                <th className="px-6 py-4">{t("verdict")}</th>
                                <th className="px-6 py-4">{t("activity")}</th>
                                <th className="px-6 py-4 text-right">{t("activity")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-boxbg">
                            {currentCalls.map((call) => (
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
                                                    className={`h-full transition-all duration-500 ${call.score > 70 ? "bg-redalert" : call.score > 30 ? "bg-gold" : "bg-indgreen"
                                                        }`}
                                                    style={{ width: `${call.score}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-mono font-bold">{Number(call.score || 0).toFixed(0)}%</span>
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
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            <p className="text-xs font-bold text-charcoal">{call.recommended_action}</p>
                                            {call.honeypot_candidate ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-redalert/10 text-redalert text-[10px] font-bold uppercase tracking-wide">
                                                    AI Route Ready
                                                </span>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3 translate-x-2 group-hover:translate-x-0 transition-transform">
                                            <button
                                                onClick={() => performAction('BLOCK', call.number)}
                                                className="p-1.5 text-redalert hover:bg-redalert/10 rounded-lg transition-colors" title="Block Number">
                                                <ShieldAlert size={16} />
                                            </button>
                                            {call.honeypot_candidate ? (
                                                <button
                                                    onClick={async () => {
                                                        const result = await performAction('ROUTE_TO_HONEYPOT', call.number, { location: call.location, source: 'detection_grid' });
                                                        if (result?.detail?.session_id) {
                                                            router.push("/honeypot");
                                                        }
                                                    }}
                                                    className="text-[10px] font-bold text-redalert uppercase tracking-widest hover:text-indblue transition-colors"
                                                >
                                                    Route
                                                </button>
                                            ) : null}
                                            <button
                                                onClick={async () => {
                                                    const result = await performAction('VIEW_DETAIL', call.number, { location: call.location });
                                                    if (result && result.detail) {
                                                        setSelectedCall(result.detail);
                                                        setIsModalOpen(true);
                                                    }
                                                }}
                                                className="text-[10px] font-bold text-indblue uppercase tracking-widest hover:text-saffron transition-colors flex items-center gap-1">
                                                {t("details")} <ArrowRight size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                )}

                <div className="p-4 bg-boxbg/20 flex justify-between items-center px-6">
                    <button
                        onClick={() => {
                            if (page > 1) {
                                void performAction('PREV_PAGE', String(page - 1));
                                setPage((current) => Math.max(1, current - 1));
                            }
                        }}
                        disabled={page === 1}
                        className="text-[10px] font-bold text-silver uppercase hover:text-indblue transition-colors">
                        {t("previous")}
                    </button>
                    <span className="text-[10px] font-bold text-silver uppercase tracking-widest">
                        Page {page} / {totalPages}
                    </span>
                    <button
                        onClick={() => {
                            void performAction('VIEW_HISTORY', 'DETECTION_GRID');
                            router.push("/history");
                        }}
                        className="text-[10px] font-bold text-silver uppercase tracking-widest hover:text-indblue transition-colors">
                        {t("view_history")}
                    </button>
                    <button
                        onClick={() => {
                            if (page < totalPages) {
                                void performAction('NEXT_PAGE', String(page + 1));
                                setPage((current) => Math.min(totalPages, current + 1));
                            }
                        }}
                        disabled={page === totalPages}
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
                        {(stats?.risk_vectors || []).map((v) => (
                            <div key={v.name} className="flex flex-col gap-1.5">
                                <div className="flex justify-between text-[10px] font-bold uppercase">
                                    <span className="text-charcoal">{v.name}</span>
                                    <span className="text-silver">{v.value || 0}%</span>
                                </div>
                                <div className="w-full h-1 bg-boxbg rounded-full overflow-hidden">
                                    <div className="h-full bg-saffron" style={{ width: `${v.value || 0}%` }} />
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

            <FeedModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                data={selectedCall}
            />
        </div>
    );
}
