"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, Users, IndianRupee, AlertTriangle, ArrowRight, BarChart3, Globe, Download, Zap } from "lucide-react";

interface StatDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: "scams" | "citizens" | "savings" | "threats" | null;
    data: any;
    onActionClick?: (action: string) => void;
}

export default function StatDetailModal({ isOpen, onClose, type, data, onActionClick }: StatDetailModalProps) {
    if (!type || !data) return null;

    const config = {
        scams: {
            title: "Total Scams Blocked",
            icon: ShieldCheck,
            color: "indblue",
            accent: "blue",
            description: "Deep-dive into blocked fraudulent interactions across the national grid.",
            metrics: data?.stat_details?.scams?.metrics || [],
            actions: ["View Detection Grid", "Export Forensic Audit"]
        },
        citizens: {
            title: "Citizens Protected",
            icon: Users,
            color: "indgreen",
            accent: "green",
            description: "Real-time monitoring of nodes and active protection participants.",
            metrics: data?.stat_details?.citizens?.metrics || [],
            actions: ["Search Citizen Registry", "Initialize New Node"]
        },
        savings: {
            title: "Estimated Savings",
            icon: IndianRupee,
            color: "gold",
            accent: "amber",
            description: "Projected financial loss prevented through automated intervention.",
            metrics: data?.stat_details?.savings?.metrics || [],
            actions: ["Financial Impact Report", "View Recovery Stats"]
        },
        threats: {
            title: "Active Threats",
            icon: AlertTriangle,
            color: "redalert",
            accent: "red",
            description: "Immediate high-intensity surgences requiring tactical response.",
            metrics: data?.stat_details?.threats?.metrics || [],
            actions: ["Initialize Geo-Layer", "Broadcast Regional Alert"]
        }
    };

    const current = config[type];
    const Icon = current.icon;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-indblue/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden relative z-10 border border-silver/20"
                    >
                        {/* Header */}
                        <div className={`p-8 text-white relative bg-${current.color}`}>
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X size={24} />
                            </button>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                                    <Icon size={32} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold tracking-tight uppercase">{current.title}</h3>
                                    <p className="text-white/60 text-xs font-mono uppercase tracking-widest leading-none mt-1">
                                        Intelligence Domain: Tactical_{type}
                                    </p>
                                </div>
                            </div>
                            <p className="text-sm opacity-80 leading-relaxed max-w-xl">{current.description}</p>
                        </div>

                        {/* Content */}
                        <div className="p-8 space-y-8">
                            <div className="grid grid-cols-3 gap-4">
                                {current.metrics.map((m: any, i: number) => (
                                    <div key={i} className="p-4 bg-boxbg rounded-2xl border border-silver/10 hover:border-silver/20 transition-all">
                                        <p className="text-[10px] font-bold text-silver uppercase tracking-widest mb-1">{m.label}</p>
                                        <div className="flex items-baseline justify-between">
                                            <p className="text-xl font-bold text-indblue">{m.value}</p>
                                            <span className={`text-[10px] font-black ${m.trend?.startsWith('+') || m.trend === 'MAX' || m.trend === 'SURGE' || m.trend === 'LIVE' || m.trend === 'SECURE' ? 'text-indgreen' : 'text-silver'}`}>
                                                {m.trend || 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-4">
                                <h4 className="flex items-center gap-2 text-xs font-bold text-indblue uppercase tracking-widest">
                                    <Zap size={16} className="text-saffron" /> Tactical Menu & Actions
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {current.actions.map((action: string, i: number) => (
                                        <button
                                            key={i}
                                            onClick={() => onActionClick?.(action)}
                                            className="flex items-center justify-between p-4 bg-white rounded-xl border border-silver/20 hover:border-indblue hover:shadow-lg transition-all group"
                                        >
                                            <span className="text-sm font-bold text-indblue">{action}</span>
                                            <ArrowRight className="text-silver group-hover:text-indblue transition-colors" size={18} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-silver/10 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 text-silver">
                                        <Globe size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Live Hub: NCR_GRID</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-silver">
                                        <BarChart3 size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Confidence: 99.4%</span>
                                    </div>
                                </div>
                                <button className="flex items-center gap-2 px-6 py-3 bg-boxbg text-indblue border border-silver/20 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-silver/10 transition-all">
                                    <Download size={14} /> Download Segment
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
