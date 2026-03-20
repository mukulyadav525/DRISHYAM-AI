"use client";

import { useState, useEffect } from "react";
import {
    Share2,
    FileText,
    Download,
    Search,
    ZoomIn,
    ZoomOut,
    Maximize2,
    Loader2
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";


interface GraphData {
    nodes: { id: string; type: string; label: string }[];
    edges: { source: string; target: string; label: string }[];
}

export default function FraudGraphPage() {
    const { t } = useLanguage();
    const { performAction, downloadSimulatedFile } = useActions();
    const [data, setData] = useState<GraphData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchGraph = async () => {
            try {
                const res = await fetch(`${API_BASE}/system/graph`);
                if (res.ok) {
                    setData(await res.json());
                }
            } catch (error) {
                console.error("Error fetching graph data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchGraph();
    }, []);

    if (isLoading && !data) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-indblue" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-8 h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-indblue tracking-tight">{t("fraud_graph")}</h2>
                    <p className="text-silver mt-1">{t("cross_entity")}</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" size={16} />
                        <input
                            type="text"
                            placeholder={t("query_entity")}
                            className="pl-10 pr-4 py-2 bg-white border border-silver/10 rounded-lg text-sm outline-none w-full sm:w-64 shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => performAction('GENERATE_FIR_FROM_GRAPH')}
                        className="px-4 py-2 bg-saffron text-white rounded-lg text-sm font-semibold hover:bg-deeporange flex items-center gap-2 transition-colors">
                        <FileText size={16} /> {t("generate_fir")}
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8 min-h-[600px]">
                {/* Graph Visualization Area */}
                <div className="lg:col-span-3 bg-white rounded-2xl border border-silver/10 flex flex-col relative overflow-hidden group">
                    <div className="absolute top-6 left-6 z-10 space-y-2">
                        <div className="bg-white/90 backdrop-blur p-2 rounded-lg border border-silver/10 shadow-xl">
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => performAction('GRAPH_ZOOM', 'IN')}
                                    className="p-2 hover:bg-boxbg rounded text-indblue transition-colors"><ZoomIn size={18} /></button>
                                <button
                                    onClick={() => performAction('GRAPH_ZOOM', 'OUT')}
                                    className="p-2 hover:bg-boxbg rounded text-indblue transition-colors"><ZoomOut size={18} /></button>
                                <div className="h-px bg-silver/10 mx-1" />
                                <button
                                    onClick={() => performAction('GRAPH_MAXIMIZE')}
                                    className="p-2 hover:bg-boxbg rounded text-indblue transition-colors"><Maximize2 size={18} /></button>
                            </div>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="absolute top-6 right-6 z-10 flex gap-4">
                        {[
                            { label: "Number", color: "bg-indblue" },
                            { label: "Location", color: "bg-saffron" },
                            { label: "Bank A/C", color: "bg-indgreen" },
                            { label: "Call", color: "bg-silver" }
                        ].map(l => (
                            <div key={l.label} className="flex items-center gap-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full border border-silver/10 shadow-sm">
                                <div className={`w-2 h-2 rounded-full ${l.color}`} />
                                <span className="text-[10px] font-bold text-charcoal uppercase tracking-wider">{l.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex-1 bg-boxbg/30 relative">
                        {/* Dynamic Nodes from Backend (Simple simulation with SVG) */}
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 600">
                            {(data?.edges || []).map((edge, i) => {
                                const sourceIdx = (data?.nodes || []).findIndex(n => n.id === edge.source);
                                const targetIdx = (data?.nodes || []).findIndex(n => n.id === edge.target);
                                if (sourceIdx === -1 || targetIdx === -1) return null;

                                const x1 = 100 + (sourceIdx % 4) * 150;
                                const y1 = 100 + Math.floor(sourceIdx / 4) * 100;
                                const x2 = 100 + (targetIdx % 4) * 150;
                                const y2 = 100 + Math.floor(targetIdx / 4) * 100;

                                return (
                                    <line key={`edge-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#CBD5E1" strokeWidth="1" strokeDasharray="5,5" />
                                );
                            })}

                            {(data?.nodes || []).map((node, i) => {
                                const x = 100 + (i % 4) * 150;
                                const y = 100 + Math.floor(i / 4) * 100;
                                const color = node.type === "number" ? "#1E293B" : "#F97316";
                                return (
                                    <g key={node.id}>
                                        <circle cx={x} cy={y} r="6" fill={color} />
                                        <text x={x + 10} y={y + 4} fontSize="8" fontWeight="bold" fill="#64748B">{node.label?.slice(-4) || '...'}</text>
                                    </g>
                                );
                            })}
                        </svg>

                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-silver/10">
                                <div className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center mx-auto mb-2 border border-saffron/20 pulse-saffron">
                                    <Share2 className="text-saffron" size={24} />
                                </div>
                                <p className="text-xs font-bold text-indblue">{t("graph_active")}</p>
                                <p className="text-[10px] text-silver mt-1">{(data?.nodes || []).length} entities tracked</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-boxbg/50 border-t border-silver/10 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-silver uppercase tracking-widest">
                            <div className="w-2 h-2 rounded-full bg-indgreen" /> {t("node_health")}
                        </div>
                        <button
                            onClick={() => performAction('REFRESH_CORRELATIONS')}
                            className="text-[10px] font-bold text-indblue uppercase tracking-widest hover:text-saffron transition-colors">
                            {t("refresh_correlations")}
                        </button>
                    </div>
                </div>

                {/* Selected Entity Details */}
                <div className="bg-white rounded-2xl border border-silver/10 p-6 flex flex-col">
                    <h4 className="font-bold text-indblue mb-6 flex items-center gap-2">
                        {t("entity_intel")}
                    </h4>

                    <div className="flex-1 space-y-6">
                        <div className="p-4 bg-boxbg rounded-xl border border-silver/10">
                            <p className="text-[10px] font-bold text-silver uppercase tracking-widest mb-1 text-center">{t("current_target")}</p>
                            <p className="text-lg font-mono font-bold text-indblue text-center tracking-tighter">
                                {data?.nodes?.find(n => n.type === "number")?.label || "+91 XXXXX XXXXX"}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] font-bold text-silver uppercase tracking-widest mb-2">{t("network_profile")}</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-charcoal">{t("role")}</span>
                                        <span className="font-bold text-indblue">—</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-charcoal">{t("confidence")}</span>
                                        <span className="font-bold text-indgreen">—</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-charcoal">{t("report_count")}</span>
                                        <span className="font-bold text-redalert">0</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-silver/5">
                        <button
                            onClick={() => downloadSimulatedFile('FRAUD_GRAPH_EVIDENCE', 'pdf')}
                            className="w-full bg-indblue text-white py-3 rounded-xl font-bold text-sm hover:bg-charcoal transition-all flex items-center justify-center gap-2 mb-3">
                            <Download size={16} /> {t("export_evidence")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
