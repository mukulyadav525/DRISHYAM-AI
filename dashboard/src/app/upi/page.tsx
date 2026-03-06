"use client";

import { useState, useEffect } from "react";
import {
    Search,
    ShieldCheck,
    ShieldAlert,
    QrCode,
    MessageSquare,
    AlertTriangle,
    Zap,
    CheckCircle2,
    XCircle,
    Copy,
    ExternalLink,
    Loader2
} from "lucide-react";
import { useActions } from "@/hooks/useActions";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";

interface UPIDashboard {
    vpa_checks_24h: string;
    flags: string;
    vpa_risk_percent: number;
}

interface UPIThreat {
    id: string;
    time: string;
    risk: string;
    type: string;
}

interface UPIStats {
    dashboard: UPIDashboard;
    threat_feed: UPIThreat[];
}

export default function UPIPage() {
    const { performAction } = useActions();
    const [upiId, setUpiId] = useState("");
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [lookupResult, setLookupResult] = useState<null | 'SAFE' | 'RISK'>(null);
    const [activeTab, setActiveTab] = useState<'lookup' | 'qr' | 'message'>('lookup');
    const [data, setData] = useState<UPIStats | null>(null);

    const [qrScanning, setQrScanning] = useState(false);
    const [qrResult, setQrResult] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`${API_BASE}/system/stats/upi`);
                if (res.ok) setData(await res.json());
            } catch (error) {
                console.error("Error fetching upi stats:", error);
            }
        };
        fetchStats();
    }, []);

    const handleLookup = () => {
        if (!upiId) return;
        setIsLookingUp(true);
        setLookupResult(null);
        performAction('VPA_LOOKUP', upiId);

        setTimeout(() => {
            setIsLookingUp(false);
            // Simulate risk logic
            setLookupResult(upiId.toLowerCase().includes('win') || upiId.toLowerCase().includes('prize') ? 'RISK' : 'SAFE');
        }, 1500);
    };

    return (
        <div className="space-y-6 max-w-6xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-indblue tracking-tight">UPI Shield & WhatsApp Interceptor</h2>
                    <p className="text-silver mt-1 italic font-medium">Protecting the digital payment layer from "Collect-Request" traps.</p>
                </div>
                <div className="flex bg-boxbg p-1 rounded-xl border border-silver/10 self-start">
                    <button
                        onClick={() => setActiveTab('lookup')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'lookup' ? 'bg-white shadow-sm text-indblue' : 'text-silver hover:text-charcoal'}`}
                    >
                        Risk Lookup
                    </button>
                    <button
                        onClick={() => setActiveTab('qr')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'qr' ? 'bg-white shadow-sm text-indblue' : 'text-silver hover:text-charcoal'}`}
                    >
                        QR Forensic
                    </button>
                    <button
                        onClick={() => setActiveTab('message')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'message' ? 'bg-white shadow-sm text-indblue' : 'text-silver hover:text-charcoal'}`}
                    >
                        Message Scanner
                    </button>
                </div>
            </div>

            {/* Main Interface Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Panel: Primary Operation */}
                <div className="lg:col-span-8 space-y-6">
                    {activeTab === 'lookup' && (
                        <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                <Search size={120} />
                            </div>

                            <h3 className="text-xl font-bold text-indblue mb-6">Real-Time UPI Reputation Check</h3>

                            <div className="space-y-4 relative z-10">
                                <div className="p-1 bg-boxbg rounded-2xl border border-silver/10 flex items-center focus-within:border-saffron/50 transition-colors">
                                    <div className="pl-4 text-silver">
                                        <Zap size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Enter VPA (e.g., citizen@upi or phone@ybl)"
                                        className="w-full bg-transparent p-4 text-sm font-bold text-indblue outline-none placeholder:text-silver/50"
                                        value={upiId}
                                        onChange={(e) => setUpiId(e.target.value)}
                                    />
                                    <button
                                        onClick={handleLookup}
                                        disabled={isLookingUp}
                                        className="bg-indblue text-white px-6 py-3 rounded-xl m-1 text-xs font-bold uppercase tracking-widest hover:bg-saffron transition-all disabled:opacity-50"
                                    >
                                        {isLookingUp ? "Verifying..." : "Check Reputation"}
                                    </button>
                                </div>

                                {lookupResult && (
                                    <div className={`p-6 rounded-2xl border ${lookupResult === 'SAFE' ? 'bg-indgreen/5 border-indgreen/20' : 'bg-red-50 border-red-200'} animate-in fade-in slide-in-from-top-4 duration-500`}>
                                        <div className="flex gap-4 items-start">
                                            <div className={`p-3 rounded-full ${lookupResult === 'SAFE' ? 'bg-indgreen text-white' : 'bg-redalert text-white'}`}>
                                                {lookupResult === 'SAFE' ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
                                            </div>
                                            <div>
                                                <h4 className={`font-bold ${lookupResult === 'SAFE' ? 'text-indgreen' : 'text-redalert'}`}>
                                                    {lookupResult === 'SAFE' ? "VPA Verified Safe" : "High Risk Signature Detected"}
                                                </h4>
                                                <p className="text-xs text-charcoal mt-1 leading-relaxed">
                                                    {lookupResult === 'SAFE'
                                                        ? `The ID ${upiId} has zero history of reported fraudulent activity across NPCI nodes.`
                                                        : `WARNING: ${upiId} is linked to 4 reported "Lottery Win" scam complaints in the last 48 hours.`}
                                                </p>
                                                {lookupResult === 'RISK' && (
                                                    <div className="mt-4 flex gap-3">
                                                        <button
                                                            onClick={() => performAction('FREEZE_VPA', upiId)}
                                                            className="text-[10px] font-bold bg-redalert text-white px-4 py-2 rounded-lg uppercase tracking-wider">Freeze Alert</button>
                                                        <button
                                                            onClick={() => performAction('VIEW_VPA_HISTORY', upiId)}
                                                            className="text-[10px] font-bold border border-redalert/20 text-redalert px-4 py-2 rounded-lg uppercase tracking-wider">VPA History</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'qr' && (
                        <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm text-center">
                            <div className="w-20 h-20 bg-boxbg rounded-2xl flex items-center justify-center mx-auto mb-4 border border-silver/5">
                                <QrCode className="text-saffron" size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-indblue mb-2">QR Forensic Analysis</h3>
                            <p className="text-silver text-sm max-w-sm mx-auto mb-8 italic">
                                Scanned QR codes are analyzed for "Destination Overlay" and "Malicious Redirection" before any payment occurs.
                            </p>
                            <button
                                onClick={() => {
                                    setQrScanning(true);
                                    performAction('SCAN_QR', 'SIMULATED_PAYLOAD');
                                    setTimeout(() => {
                                        setQrScanning(false);
                                        setQrResult(true);
                                    }, 2000);
                                }}
                                disabled={qrScanning}
                                className="bg-indblue text-white px-8 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-saffron transition-all inline-block disabled:opacity-50"
                            >
                                {qrScanning ? "Processing QR..." : qrResult ? "Scan Successful - Safe" : "Upload QR for Scanning"}
                            </button>

                            <div className="mt-12 grid grid-cols-3 gap-4">
                                {[
                                    { label: 'Payload Validation', status: qrResult ? 'bg-indgreen' : 'bg-silver/30' },
                                    { label: 'TLS Verification', status: qrResult ? 'bg-indgreen' : 'bg-silver/30' },
                                    { label: 'Merchant Mapping', status: qrResult ? 'bg-indgreen' : 'bg-silver/30' }
                                ].map((step, i) => (
                                    <div key={i} className="p-4 bg-boxbg rounded-xl border border-silver/5">
                                        <div className={`w-2 h-2 rounded-full mx-auto mb-2 ${step.status}`} />
                                        <p className="text-[10px] uppercase font-bold text-silver">{step.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'message' && (
                        <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                            <h3 className="text-xl font-bold text-indblue mb-6 flex items-center gap-2">
                                <MessageSquare className="text-saffron" size={20} />
                                Message Pattern Analysis
                            </h3>

                            <div className="space-y-6">
                                <div className="p-4 bg-boxbg rounded-2xl border border-silver/10 text-sm text-charcoal italic leading-relaxed">
                                    "CONGRATULATIONS! You have won Rs. 75,00,000 in KBC Lottery. To claim your prize, click this link to pay Rs 499 processing fee on VPA: kbc-rewards@upi and share screenshot."
                                </div>
                                <div className="flex items-center gap-4 p-4 bg-red-50 border border-red-100 rounded-2xl">
                                    <AlertTriangle className="text-redalert" />
                                    <div>
                                        <p className="text-xs font-bold text-redalert uppercase">High Probability Fraud (98.4%)</p>
                                        <p className="text-[11px] text-charcoal">Pattern: "Lottery Claim" with "Advance Fee" VPA request.</p>
                                    </div>
                                    <div className="ml-auto">
                                        <button
                                            onClick={() => performAction('INTERCEPT_MESSAGE', 'KBC_SCAM')}
                                            className="bg-redalert text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase">Intercept Source</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel: Stats & Intelligence */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-indblue p-6 rounded-3xl border border-saffron/20 shadow-xl text-white">
                        <h4 className="font-bold text-sm mb-4 border-b border-white/10 pb-2">UPI Shield Dashboard</h4>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-silver">VPA Checks (24h)</p>
                                    <p className="text-2xl font-bold">{data?.dashboard.vpa_checks_24h || "..."}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-bold text-indgreen">Flags</p>
                                    <p className="text-lg font-bold">{data?.dashboard.flags || "..."}</p>
                                </div>
                            </div>
                            <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                                <div className="bg-saffron h-full" style={{ width: `${data?.dashboard.vpa_risk_percent || 0}%` }} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                        <h4 className="font-bold text-indblue text-sm mb-4">Live Threat Feed (UPI)</h4>
                        <div className="space-y-4">
                            {data?.threat_feed && Array.isArray(data.threat_feed) ? data.threat_feed.map((threat, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-boxbg rounded-xl">
                                    <div>
                                        <p className="text-[10px] font-bold text-charcoal truncate w-24">...{threat.id}</p>
                                        <p className="text-[9px] text-silver uppercase font-bold">{threat.type}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase ${threat.risk === 'High' ? 'bg-red-100 text-redalert' : 'bg-orange-100 text-saffron'}`}>
                                            {threat.risk}
                                        </span>
                                        <p className="text-[9px] text-silver mt-1">{threat.time}</p>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-[10px] text-silver italic">No active threats detected.</p>
                            )}
                        </div>
                        <button
                            onClick={() => performAction('VIEW_THREAT_MAP')}
                            className="w-full mt-6 py-2 border border-silver/20 rounded-xl text-[10px] font-bold text-silver uppercase tracking-widest hover:bg-indblue hover:text-white transition-all">
                            View Full Threat Map
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
