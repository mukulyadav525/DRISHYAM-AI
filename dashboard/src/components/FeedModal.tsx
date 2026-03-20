"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldAlert, MapPin, Activity, FileSearch } from "lucide-react";

interface FeedModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: any;
}

export default function FeedModal({ isOpen, onClose, data }: FeedModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-indblue/80 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative z-10 border border-silver/20 min-h-[400px] flex flex-col items-center justify-center"
                    >
                        {data ? (
                            <>
                                {/* Header */}
                                <div className="bg-indblue p-6 text-white relative w-full">
                                    <button
                                        onClick={onClose}
                                        className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-redalert/20 rounded-lg">
                                            <ShieldAlert className="text-redalert" size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold uppercase tracking-tight">Threat Analysis Detail</h3>
                                            <p className="text-xs text-silver/60 font-mono tracking-widest">{data.victim_id} • SECTOR_{data.location?.split(' ')[0] || 'G'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-5 sm:p-6 space-y-5 sm:space-y-6 w-full">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="p-4 bg-boxbg rounded-xl border border-silver/10">
                                            <p className="text-[10px] font-bold text-silver uppercase tracking-widest mb-1">Scam Vector</p>
                                            <p className="text-sm font-bold text-indblue">{data.scam_type}</p>
                                        </div>
                                        <div className="p-4 bg-boxbg rounded-xl border border-silver/10">
                                            <p className="text-[10px] font-bold text-silver uppercase tracking-widest mb-1">Risk Intensity</p>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-1.5 bg-silver/20 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-redalert"
                                                        style={{ width: `${(data.risk_score || 0.8) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-redalert">{Math.round((data.risk_score || 0.8) * 100)}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="flex items-center gap-2 text-xs font-bold text-indblue uppercase tracking-widest mb-3">
                                            <FileSearch size={14} className="text-saffron" /> Forensic Evidence Pipeline
                                        </h4>
                                        <ul className="space-y-2">
                                            {(data?.evidence || [
                                                "Network: Analysis of packet headers suggests location spoofing.",
                                                "Forensics: Voice signature matches known fraud patterns.",
                                                "Registry: Target VPA has been flagged by multiple financial nodes."
                                            ]).map((item: string, i: number) => (
                                                <li key={i} className="flex gap-2 text-xs text-charcoal bg-indgreen/5 p-2 rounded border border-indgreen/10">
                                                    <div className="w-1 h-1 rounded-full bg-indgreen mt-1.5 flex-shrink-0" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-4 border-t border-silver/5 gap-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-indgreen animate-pulse" />
                                            <span className="text-[10px] font-bold text-indgreen uppercase tracking-widest">{data.status}</span>
                                        </div>
                                        <button
                                            onClick={onClose}
                                            className="px-6 py-2 bg-indblue text-white rounded-lg text-xs font-bold hover:bg-charcoal transition-all shadow-lg"
                                        >
                                            ACKNOWLEDGE THREAT
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-indblue">
                                <Activity className="animate-spin" size={32} />
                                <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Synchronizing Threat Data...</p>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
