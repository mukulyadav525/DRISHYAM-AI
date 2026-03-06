"use client";

import { useState } from "react";
import {
    Building2,
    Shield,
    Search,
    Filter,
    Clock,
    CheckCircle2,
    XCircle,
    FileText,
    Scale,
    PhoneOff,
    CreditCard,
    UserX,
    ChevronRight,
    ExternalLink,
    AlertCircle,
    Download,
    Loader2
} from "lucide-react";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";

export default function AgencyPage() {
    const { performAction, downloadSimulatedFile } = useActions();
    const [activeRole, setActiveRole] = useState<'POLICE' | 'BANK' | 'TELECOM'>('POLICE');
    const [isBlockingIMEI, setIsBlockingIMEI] = useState(false);

    const cases = [
        { id: "REP-9921", amount: "₹45,000", type: "UPI Fraud", platform: "WhatsApp", status: "PENDING", priority: "CRITICAL" },
        { id: "REP-9922", amount: "₹1,20,000", type: "Investment Scam", platform: "Telegram", status: "PENDING", priority: "HIGH" }
    ];

    const bankActions = [
        { vpa: "scam.target@upi", holder: "Unknown Agent", bank: "HDFC Online", action: "FREEZE_REQUIRED" },
        { vpa: "prize.win@ybl", holder: "Mule Account #4", bank: "ICICI Digital", action: "FREEZE_REQUIRED" }
    ];

    return (
        <div className="space-y-6 max-w-7xl">
            {/* Header & Role Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-indblue tracking-tight underline decoration-indblue decoration-4 underline-offset-8">Agency Operational Portal</h2>
                    <p className="text-silver mt-4 italic font-medium">Tactical Interface for Law Enforcement & Financial Institutions (Module 7/8/9).</p>
                </div>
                <div className="flex bg-white p-1 rounded-2xl border border-silver/10 shadow-sm">
                    {(['POLICE', 'BANK', 'TELECOM'] as const).map(role => (
                        <button
                            key={role}
                            onClick={() => setActiveRole(role)}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${activeRole === role ? 'bg-indblue text-white shadow-lg' : 'text-silver hover:bg-boxbg'}`}
                        >
                            {role}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Tactical Workflow Panel */}
                <div className="lg:col-span-8 space-y-6">
                    {activeRole === 'POLICE' && (
                        <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center gap-3">
                                    <Scale className="text-indblue" size={24} />
                                    <h3 className="text-xl font-bold text-indblue tracking-tight">E-Police Evidence Queue</h3>
                                </div>
                                <div className="flex gap-2">
                                    {cases.length > 0 && (
                                        <div className="flex items-center gap-1 p-2 bg-redalert/5 text-redalert text-[9px] font-bold rounded-lg border border-redalert/10">
                                            <AlertCircle size={14} /> {cases.length} URGENT REPORTS
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                {cases.map((c) => (
                                    <div key={c.id} className="p-6 bg-boxbg rounded-3xl border border-silver/5 hover:border-indblue/30 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-6">
                                            <div className="p-3 bg-white rounded-2xl shadow-sm border border-silver/10">
                                                <FileText size={20} className="text-indblue" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-indblue">{c.id}</h4>
                                                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded ${c.priority === 'CRITICAL' ? 'bg-redalert text-white' : 'bg-indblue/10 text-indblue'}`}>
                                                        {c.priority}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] font-bold text-silver uppercase mt-1">TYPE: {c.type} | {c.amount}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => downloadSimulatedFile(`FIR_${c.id}`, 'pdf')}
                                                className="px-4 py-2 bg-white border border-indblue/20 text-indblue text-[10px] font-black rounded-xl hover:bg-indblue hover:text-white transition-all">GENERATE FIR PACKET</button>
                                            <button
                                                onClick={() => performAction('VIEW_CASE', c.id)}
                                                className="p-2 bg-indblue text-white rounded-xl shadow-lg group-hover:bg-indblue/90 transition-all">
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeRole === 'BANK' && (
                        <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center gap-3">
                                    <CreditCard className="text-indgreen" size={24} />
                                    <h3 className="text-xl font-bold text-indblue tracking-tight">Financial Intelligence (Mule Shield)</h3>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                {bankActions.map((vpa, i) => (
                                    <div key={i} className="p-6 bg-boxbg rounded-3xl border border-silver/5 flex flex-col justify-between h-48">
                                        <div>
                                            <h4 className="font-black text-indblue text-lg tracking-tight">{vpa.vpa}</h4>
                                            <p className="text-[10px] font-bold text-silver uppercase">{vpa.bank} | {vpa.holder}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => performAction('FREEZE_VPA', vpa.vpa)}
                                                className="flex-1 bg-redalert text-white text-[9px] font-black py-3 rounded-xl shadow-lg flex items-center justify-center gap-2">
                                                <UserX size={14} /> FREEZE VPA
                                            </button>
                                            <button
                                                onClick={() => performAction('MARK_RISK', vpa.vpa)}
                                                className="flex-1 bg-white border border-silver/10 text-charcoal text-[9px] font-black py-3 rounded-xl flex items-center justify-center gap-2">
                                                MARK RISK
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeRole === 'TELECOM' && (
                        <div className="bg-charcoal p-8 rounded-3xl border border-white/5 text-white">
                            <div className="flex items-center gap-3 mb-8">
                                <PhoneOff className="text-saffron" size={24} />
                                <h3 className="text-xl font-bold tracking-tight uppercase">Telecom Threat Kill-Switch</h3>
                            </div>
                            <div className="p-8 bg-white/5 rounded-3xl border border-white/10 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                        <AlertCircle size={24} className="text-white/20" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold">Awaiting Threat Detection</h4>
                                        <p className="text-[10px] opacity-60">No active mass-robocall events detected.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsBlockingIMEI(true);
                                        const id = toast.loading("Broadcasting block signal to towers...");
                                        performAction('BLOCK_IMEI', 'RANGE_772XX');
                                        setTimeout(() => toast.loading("Confirming LSA compliance...", { id }), 800);
                                        setTimeout(() => {
                                            toast.success("IMEI Range Successfully Blocked", { id });
                                            setIsBlockingIMEI(false);
                                        }, 1600);
                                    }}
                                    disabled={isBlockingIMEI}
                                    className="w-full bg-redalert text-white font-black py-4 rounded-2xl shadow-2xl hover:bg-indblue transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isBlockingIMEI ? <Loader2 className="animate-spin" size={20} /> : <PhoneOff size={20} />}
                                    BLOCK DETECTED IMEI RANGE
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tactical Stats & Tools */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Common Tools Panel */}
                    <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                        <h4 className="font-bold text-indblue text-[10px] uppercase mb-6 tracking-widest">Global Support Matrix</h4>
                        <div className="space-y-4">
                            {[
                                { name: 'IT Act v2.1 Reference', icon: Scale, url: 'https://www.meity.gov.in/content/information-technology-act-2000' },
                                { name: 'NPCI Integration Portal', icon: ExternalLink, url: 'https://www.npci.org.in/' },
                                { name: 'MHA Escalation Channel', icon: Clock, url: 'https://www.mha.gov.in/' },
                                { name: 'Section 65B Generator', icon: Download, url: '#' },
                            ].map((tool, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        performAction('USE_LE_TOOL', tool.name);
                                        if (tool.url !== '#') window.open(tool.url, '_blank');
                                        else toast.success("Section 65B AI Generator Initialized");
                                    }}
                                    className="w-full p-4 bg-boxbg hover:bg-indblue/5 rounded-2xl border border-silver/5 flex items-center justify-between transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <tool.icon size={16} className="text-indblue" />
                                        <span className="text-[11px] font-bold text-charcoal">{tool.name}</span>
                                    </div>
                                    <ChevronRight size={14} className="text-silver group-hover:translate-x-1 transition-transform" />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Live Triage Status */}
                    <div className="bg-indblue p-6 rounded-3xl border border-saffron/20 shadow-xl text-white overflow-hidden relative">
                        <Shield size={100} className="absolute -right-8 -bottom-8 text-white/5" />
                        <h4 className="font-black text-[10px] uppercase mb-6 tracking-widest text-saffron">National Triage Health</h4>
                        <div className="space-y-6 relative z-10">
                            {/* Empty state for triage health */}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
