"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, User, ShieldCheck, ShieldAlert, History, Activity } from "lucide-react";

interface CustomerSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: any;
}

export default function CustomerSearchModal({ isOpen, onClose, data }: CustomerSearchModalProps) {
    if (!data) return null;

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
                        <div className={`p-8 text-white relative flex items-center gap-6 ${(data?.score || 0) > 700 ? 'bg-indblue' : 'bg-redalert'}`}>
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <div className="w-24 h-24 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                                <User size={48} />
                            </div>

                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-2xl font-bold tracking-tight">{data?.name || "Unknown Citizen"}</h3>
                                    <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-black uppercase tracking-widest leading-none">
                                        ID: {data?.uid || "N/A"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full animate-pulse ${data?.status === 'SECURE' ? 'bg-indgreen' : 'bg-gold'}`} />
                                    <p className="text-sm font-bold opacity-80 uppercase tracking-wider">{(data?.status || 'UNKNOWN').replace('_', ' ')}</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-8 space-y-8">
                            <div className="grid grid-cols-3 gap-6">
                                <div className="p-6 bg-boxbg rounded-2xl border border-silver/10 text-center">
                                    <p className="text-[10px] font-bold text-silver uppercase tracking-widest mb-2">Sentinel Score</p>
                                    <p className={`text-3xl font-black ${(data?.score || 0) > 700 ? 'text-indgreen' : 'text-redalert'}`}>{data?.score || 0}</p>
                                </div>
                                <div className="p-6 bg-boxbg rounded-2xl border border-silver/10 text-center">
                                    <p className="text-[10px] font-bold text-silver uppercase tracking-widest mb-2">Threats Blocked</p>
                                    <p className="text-3xl font-black text-indblue">{data?.details?.threats_blocked || 0}</p>
                                </div>
                                <div className="p-6 bg-boxbg rounded-2xl border border-silver/10 text-center">
                                    <p className="text-[10px] font-bold text-silver uppercase tracking-widest mb-2">Total Calls</p>
                                    <p className="text-3xl font-black text-indblue">{data?.details?.total_calls || 0}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="flex items-center gap-2 text-xs font-bold text-indblue uppercase tracking-widest">
                                    <Activity size={16} className="text-saffron" /> Protection Analytics
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3 p-4 bg-indgreen/5 rounded-xl border border-indgreen/10">
                                        <ShieldCheck className="text-indgreen" size={20} />
                                        <div>
                                            <p className="text-[10px] font-bold text-silver uppercase mb-0.5">Device Integrity</p>
                                            <p className="text-xs font-bold text-indblue">VERIFIED SAFE</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-4 bg-saffron/5 rounded-xl border border-saffron/10">
                                        <ShieldAlert className="text-saffron" size={20} />
                                        <div>
                                            <p className="text-[10px] font-bold text-silver uppercase mb-0.5">Network Security</p>
                                            <p className="text-xs font-bold text-indblue">ENCRYPTED NODE</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-silver/10 flex justify-between items-center">
                                <div className="flex items-center gap-2 text-silver">
                                    <History size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Last Activity: {data?.details?.last_active ? new Date(data.details.last_active).toLocaleString() : 'N/A'}</span>
                                </div>
                                <button className="px-8 py-3 bg-indblue text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-charcoal transition-all shadow-xl shadow-indblue/20">
                                    DOWNLOAD AUDIT LOG
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
