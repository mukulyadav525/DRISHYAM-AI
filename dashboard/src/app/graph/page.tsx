"use client";

import { useEffect, useRef, useState } from "react";
import {
    Download,
    FileText,
    Loader2,
    Maximize2,
    Search,
    Share2,
    ZoomIn,
    ZoomOut,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useLanguage } from "@/context/LanguageContext";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";

interface GraphNode {
    id: string;
    type: string;
    label: string;
    risk?: string;
}

interface GraphEdge {
    source: string;
    target: string;
    label: string;
}

interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    root_entity?: string;
}

interface SpotlightData {
    root_entity: string;
    network: {
        nodes: GraphNode[];
        edges: GraphEdge[];
    };
    entity_intel: {
        type: string;
        confidence: number;
        report_count: number;
        recommended_action: string;
        last_seen?: string | null;
    };
    recent_sessions: {
        session_id: string;
        status: string;
        direction: string;
        created_at?: string | null;
        scam_type: string;
    }[];
    linked_reports: {
        report_id: string;
        category: string;
        scam_type: string;
        priority: string;
        status: string;
        created_at?: string | null;
    }[];
    fir_preview: {
        fir_id: string;
        summary: string;
        entities: string[];
        ready: boolean;
    };
}

function getNodeColor(type: string) {
    switch (type) {
        case "cluster":
            return "#F97316";
        case "mule":
        case "bank":
        case "upi":
            return "#007A3D";
        case "scammer":
        case "number":
        case "phone":
            return "#C0392B";
        case "session":
            return "#00216A";
        default:
            return "#64748B";
    }
}

export default function FraudGraphPage() {
    const { t } = useLanguage();
    const { performAction, downloadSimulatedFile } = useActions();
    const [graph, setGraph] = useState<GraphData | null>(null);
    const [spotlight, setSpotlight] = useState<SpotlightData | null>(null);
    const [query, setQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const graphContainerRef = useRef<HTMLDivElement | null>(null);

    const loadSpotlight = async (entity?: string) => {
        const search = entity?.trim();
        const url = search
            ? `${API_BASE}/system/graph/spotlight?entity=${encodeURIComponent(search)}`
            : `${API_BASE}/system/graph/spotlight`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error("Unable to load entity spotlight");
        }
        const data = await res.json();
        setSpotlight(data);
        if (!search) {
            setQuery(data.root_entity || "");
        }
    };

    useEffect(() => {
        const fetchGraph = async () => {
            try {
                const [graphRes] = await Promise.all([
                    fetch(`${API_BASE}/system/graph`),
                ]);

                if (graphRes.ok) {
                    const graphData = await graphRes.json();
                    setGraph(graphData);
                }

                await loadSpotlight();
            } catch (error) {
                console.error("Error fetching graph data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        void fetchGraph();
    }, []);

    const handleSearch = async () => {
        if (!query.trim()) {
            toast.error("Enter an entity to spotlight.");
            return;
        }

        setIsSearching(true);
        try {
            await loadSpotlight(query);
            toast.success("Entity spotlight updated.");
        } catch (error) {
            console.error(error);
            toast.error("Unable to locate that entity in the graph.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleZoom = async (direction: "IN" | "OUT") => {
        await performAction("GRAPH_ZOOM", direction);
        setZoomLevel((current) => {
            const next = direction === "IN" ? current + 0.1 : current - 0.1;
            return Math.min(1.6, Math.max(0.7, Number(next.toFixed(2))));
        });
    };

    const handleMaximize = async () => {
        await performAction("GRAPH_MAXIMIZE");
        const container = graphContainerRef.current;
        if (!container) {
            return;
        }

        if (document.fullscreenElement === container) {
            await document.exitFullscreen();
            setIsFullscreen(false);
            return;
        }

        await container.requestFullscreen();
        setIsFullscreen(true);
    };

    useEffect(() => {
        const syncFullscreen = () => {
            setIsFullscreen(document.fullscreenElement === graphContainerRef.current);
        };
        document.addEventListener("fullscreenchange", syncFullscreen);
        return () => document.removeEventListener("fullscreenchange", syncFullscreen);
    }, []);

    if (isLoading && !graph) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-indblue" size={48} />
            </div>
        );
    }

    const displayNodes = spotlight?.network?.nodes?.length ? spotlight.network.nodes : (graph?.nodes || []);
    const displayEdges = spotlight?.network?.edges?.length ? spotlight.network.edges : (graph?.edges || []);

    return (
        <div className="space-y-8 h-full flex flex-col">
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
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    void handleSearch();
                                }
                            }}
                            placeholder={t("query_entity")}
                            className="pl-10 pr-4 py-2 bg-white border border-silver/10 rounded-lg text-sm outline-none w-full sm:w-72 shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => void handleSearch()}
                        disabled={isSearching}
                        className="px-4 py-2 bg-white border border-silver/10 rounded-lg text-sm font-semibold hover:border-saffron/40 transition-colors flex items-center gap-2"
                    >
                        {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        Spotlight
                    </button>
                    <button
                        onClick={async () => {
                            const rootEntity = spotlight?.root_entity || graph?.root_entity || "entity";
                            await performAction("GENERATE_FIR_FROM_GRAPH", rootEntity);
                            await downloadSimulatedFile(`GRAPH_FIR_${rootEntity.replace(/[^a-zA-Z0-9]/g, "_")}`, "pdf", {
                                targetId: rootEntity,
                                context: {
                                    root_entity: rootEntity,
                                    node_count: displayNodes.length,
                                    edge_count: displayEdges.length,
                                },
                            });
                        }}
                        className="px-4 py-2 bg-saffron text-white rounded-lg text-sm font-semibold hover:bg-deeporange flex items-center gap-2 transition-colors"
                    >
                        <FileText size={16} /> {t("generate_fir")}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 min-h-[620px]">
                <div ref={graphContainerRef} className="lg:col-span-3 bg-white rounded-2xl border border-silver/10 flex flex-col relative overflow-hidden">
                    <div className="absolute top-6 left-6 z-10 space-y-2">
                        <div className="bg-white/90 backdrop-blur p-2 rounded-lg border border-silver/10 shadow-xl">
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => void handleZoom("IN")}
                                    className="p-2 hover:bg-boxbg rounded text-indblue transition-colors"
                                >
                                    <ZoomIn size={18} />
                                </button>
                                <button
                                    onClick={() => void handleZoom("OUT")}
                                    className="p-2 hover:bg-boxbg rounded text-indblue transition-colors"
                                >
                                    <ZoomOut size={18} />
                                </button>
                                <div className="h-px bg-silver/10 mx-1" />
                                <button
                                    onClick={() => void handleMaximize()}
                                    className="p-2 hover:bg-boxbg rounded text-indblue transition-colors"
                                >
                                    <Maximize2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="absolute top-6 right-6 z-10 bg-white/90 backdrop-blur px-4 py-3 rounded-2xl border border-silver/10 shadow-sm min-w-[220px]">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Spotlight Root</p>
                        <p className="text-sm font-black text-indblue mt-1 break-all">{spotlight?.root_entity || graph?.root_entity || "Loading..."}</p>
                        <p className="text-[10px] text-silver mt-2">
                            {displayNodes.length} nodes · {displayEdges.length} edges
                        </p>
                    </div>

                    <div className="flex-1 bg-boxbg/30 relative">
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 860 620" style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}>
                            {displayEdges.map((edge, index) => {
                                const sourceIndex = displayNodes.findIndex((node) => node.id === edge.source);
                                const targetIndex = displayNodes.findIndex((node) => node.id === edge.target);
                                if (sourceIndex === -1 || targetIndex === -1) return null;

                                const x1 = 120 + (sourceIndex % 4) * 170;
                                const y1 = 100 + Math.floor(sourceIndex / 4) * 120;
                                const x2 = 120 + (targetIndex % 4) * 170;
                                const y2 = 100 + Math.floor(targetIndex / 4) * 120;

                                return (
                                    <g key={`edge-${edge.source}-${edge.target}-${index}`}>
                                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="5,5" />
                                        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} fontSize="8" fontWeight="bold" fill="#94A3B8">
                                            {edge.label}
                                        </text>
                                    </g>
                                );
                            })}

                            {displayNodes.map((node, index) => {
                                const x = 120 + (index % 4) * 170;
                                const y = 100 + Math.floor(index / 4) * 120;
                                const color = getNodeColor(node.type);

                                return (
                                    <g key={node.id}>
                                        <circle cx={x} cy={y} r="10" fill={color} />
                                        <text x={x + 16} y={y - 4} fontSize="10" fontWeight="bold" fill="#334155">
                                            {node.type.toUpperCase()}
                                        </text>
                                        <text x={x + 16} y={y + 12} fontSize="10" fill="#64748B">
                                            {node.label.slice(0, 22)}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>

                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-silver/10">
                                <div className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center mx-auto mb-2 border border-saffron/20 pulse-saffron">
                                    <Share2 className="text-saffron" size={24} />
                                </div>
                                <p className="text-xs font-bold text-indblue">{t("graph_active")}</p>
                                <p className="text-[10px] text-silver mt-1">Recent honeypot entities and graph links are live.</p>
                                <p className="text-[10px] text-indblue mt-2 font-bold">Zoom {Math.round(zoomLevel * 100)}% {isFullscreen ? "· Fullscreen" : ""}</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-boxbg/50 border-t border-silver/10 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-silver uppercase tracking-widest">
                            <div className="w-2 h-2 rounded-full bg-indgreen" /> Node Health Stable
                        </div>
                        <button
                            onClick={async () => {
                                await performAction("REFRESH_CORRELATIONS", spotlight?.root_entity || graph?.root_entity);
                                await loadSpotlight(spotlight?.root_entity || graph?.root_entity);
                            }}
                            className="text-[10px] font-bold text-indblue uppercase tracking-widest hover:text-saffron transition-colors"
                        >
                            {t("refresh_correlations")}
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-silver/10 p-6">
                        <h4 className="font-bold text-indblue mb-4">{t("entity_intel")}</h4>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between gap-3">
                                <span className="text-silver font-semibold">Entity</span>
                                <span className="font-bold text-indblue text-right break-all">{spotlight?.root_entity || graph?.root_entity}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                                <span className="text-silver font-semibold">Type</span>
                                <span className="font-bold text-charcoal">{spotlight?.entity_intel?.type || "UNKNOWN"}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                                <span className="text-silver font-semibold">Confidence</span>
                                <span className="font-bold text-indgreen">{Math.round((spotlight?.entity_intel?.confidence || 0) * 100)}%</span>
                            </div>
                            <div className="flex justify-between gap-3">
                                <span className="text-silver font-semibold">Reports</span>
                                <span className="font-bold text-redalert">{spotlight?.entity_intel?.report_count || 0}</span>
                            </div>
                        </div>
                        <div className="mt-4 p-4 rounded-xl bg-boxbg border border-silver/10">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-silver mb-2">Recommended Action</p>
                            <p className="text-xs font-semibold text-charcoal">
                                {spotlight?.entity_intel?.recommended_action || "Generate FIR and escalate to the right agency node."}
                            </p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-silver/10 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-indblue">FIR Preview</h4>
                            <span className="text-[10px] font-bold text-indgreen uppercase tracking-widest">
                                {spotlight?.fir_preview?.ready ? "READY" : "PENDING"}
                            </span>
                        </div>
                        <p className="text-xs font-bold text-indblue">{spotlight?.fir_preview?.fir_id || "FIR Preview"}</p>
                        <p className="text-xs text-silver leading-relaxed mt-3">
                            {spotlight?.fir_preview?.summary || "No FIR preview available for the current spotlight."}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {(spotlight?.fir_preview?.entities || []).map((entity) => (
                                <span
                                    key={entity}
                                    className="px-2.5 py-1 rounded-full bg-indblue/5 text-indblue text-[10px] font-bold border border-indblue/10"
                                >
                                    {entity}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-silver/10 p-6">
                        <h4 className="font-bold text-indblue mb-4">Recent Sessions</h4>
                        <div className="space-y-3">
                            {(spotlight?.recent_sessions || []).map((session) => (
                                <div key={session.session_id} className="p-3 rounded-xl bg-boxbg border border-silver/10">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-indblue">{session.session_id}</p>
                                    <p className="text-xs font-semibold text-charcoal mt-1">{session.scam_type}</p>
                                    <p className="text-[10px] text-silver mt-2 uppercase">
                                        {session.direction} · {session.status}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-silver/10 p-6">
                        <h4 className="font-bold text-indblue mb-4">Linked Reports</h4>
                        <div className="space-y-3">
                            {(spotlight?.linked_reports || []).slice(0, 3).map((report) => (
                                <div key={report.report_id} className="p-3 rounded-xl bg-boxbg border border-silver/10">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">{report.report_id}</p>
                                    <p className="text-xs font-semibold text-charcoal mt-1">{report.scam_type}</p>
                                    <p className="text-[10px] text-silver mt-2 uppercase">{report.category} · {report.priority}</p>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => downloadSimulatedFile("FRAUD_GRAPH_EVIDENCE", "pdf", {
                                targetId: spotlight?.root_entity || graph?.root_entity || undefined,
                                context: {
                                    root_entity: spotlight?.root_entity || graph?.root_entity || null,
                                    node_count: displayNodes.length,
                                    edge_count: displayEdges.length,
                                },
                            })}
                            className="w-full bg-indblue text-white py-3 rounded-xl font-bold text-sm hover:bg-charcoal transition-all flex items-center justify-center gap-2 mt-4"
                        >
                            <Download size={16} /> {t("export_evidence")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
