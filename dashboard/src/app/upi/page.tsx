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
import { API_BASE } from "@/config/api";


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
    const [forensicResult, setForensicResult] = useState<any>(null);

    // Message Scanner State
    const [messageText, setMessageText] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<any>(null);

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

    const handleLookup = async () => {
        if (!upiId) return;
        setIsLookingUp(true);
        setLookupResult(null);
        
        try {
            const result = await performAction('VPA_LOOKUP', upiId);
            if (result && result.detail) {
                setLookupResult(result.detail.is_flagged ? 'RISK' : 'SAFE');
            }
        } catch (e) {
            console.error("Lookup failed", e);
        } finally {
            setIsLookingUp(false);
        }
    };

    const handleMessageScan = async () => {
        if (!messageText) return;
        setIsScanning(true);
        setScanResult(null);

        try {
            const res = await fetch(`${API_BASE}/upi/scan-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: messageText })
            });
            if (res.ok) {
                const data = await res.json();
                setScanResult(data);
            } else {
                console.error("Failed to scan message");
            }
        } catch (error) {
            console.error("Error scanning message:", error);
        } finally {
            setIsScanning(false);
        }
    };

    const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setQrScanning(true);
        setForensicResult(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${API_BASE}/upi/scan-qr`, {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                setForensicResult(data);
                if (data.is_safe === false) performAction('SCAN_QR', 'MALICIOUS_QR_FOUND');
                else performAction('SCAN_QR', 'SAFE_QR_SCANNED');
            } else {
                setForensicResult({ success: false, error: "Server Error processing QR." });
            }
        } catch (err) {
            setForensicResult({ success: false, error: "Network Error" });
        } finally {
            setQrScanning(false);
            e.target.value = ""; // reset input
        }
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
                            <div className={`w-20 h-20 bg-boxbg rounded-2xl flex items-center justify-center mx-auto mb-4 border transition-colors ${qrScanning ? 'border-indblue animate-pulse' : 'border-silver/5'}`}>
                                <QrCode className={`transition-colors ${qrScanning ? 'text-indblue animate-bounce' : 'text-saffron'}`} size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-indblue mb-2">QR Forensic Analysis</h3>
                            <p className="text-silver text-sm max-w-sm mx-auto mb-8 italic">
                                Scanned QR codes are analyzed for "Destination Overlay" and "Malicious Redirection" before any payment occurs.
                            </p>

                            {!qrScanning && !forensicResult && (
                                <label className="cursor-pointer bg-indblue text-white px-8 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-saffron transition-all inline-block hover:-translate-y-1 shadow hover:shadow-lg">
                                    Upload QR for Scanning
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleQRUpload}
                                    />
                                </label>
                            )}

                            {qrScanning && (
                                <div className="inline-flex items-center gap-3 bg-indblue/10 text-indblue px-8 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest border border-indblue/20">
                                    <Loader2 className="animate-spin" size={16} />
                                    Processing QR...
                                </div>
                            )}

                            {forensicResult && !qrScanning && (
                                <div className="mt-6 text-left animate-in fade-in slide-in-from-bottom-4">
                                    <div className={`p-6 rounded-2xl border ${forensicResult.is_safe ? 'bg-indgreen/5 border-indgreen/20' : 'bg-red-50 border-red-200'}`}>
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className={`p-3 rounded-full shrink-0 ${forensicResult.is_safe ? 'bg-indgreen text-white' : 'bg-redalert text-white'}`}>
                                                {forensicResult.is_safe ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                                            </div>
                                            <div className="w-full">
                                                <div className="flex justify-between items-center w-full">
                                                    <h4 className={`font-bold ${forensicResult.is_safe ? 'text-indgreen' : 'text-redalert'}`}>
                                                        {forensicResult.is_safe ? "Safe QR Destination" : "Malicious QR Detected"}
                                                    </h4>
                                                    {!forensicResult.is_safe && forensicResult.payload !== 'CORRUPT_PAYLOAD' && (
                                                        <button
                                                            onClick={() => performAction('INTERCEPT_MESSAGE', 'QR_SCAM')}
                                                            className="bg-redalert text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase shrink-0">
                                                            Intercept Trap
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="mt-2 text-xs font-mono bg-white/50 p-2 rounded border border-silver/10 break-all text-charcoal">
                                                    <span className="text-silver font-bold uppercase block mb-1 text-[9px]">Decoded Payload:</span>
                                                    {forensicResult.payload}
                                                </div>

                                                {forensicResult.risk_factors && forensicResult.risk_factors.length > 0 && (
                                                    <div className="mt-3 space-y-1">
                                                        {forensicResult.risk_factors.map((tf: string, idx: number) => (
                                                            <p key={idx} className={`text-xs ${tf.includes('CRITICAL') || tf.includes('HIGH') ? 'text-redalert font-bold' : 'text-charcoal'}`}>
                                                                • {tf}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {forensicResult.checks && (
                                        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                                            {[
                                                { label: 'Payload Validation', status: forensicResult.checks.payload ? 'bg-indgreen' : 'bg-redalert' },
                                                { label: 'TLS Verification', status: forensicResult.checks.tls ? 'bg-indgreen' : 'bg-redalert' },
                                                { label: 'Merchant Mapping', status: forensicResult.checks.merchant ? 'bg-indgreen' : 'bg-redalert' }
                                            ].map((step, i) => (
                                                <div key={i} className="p-4 bg-boxbg rounded-xl border border-silver/5">
                                                    <div className={`w-2 h-2 rounded-full mx-auto mb-2 ${step.status}`} />
                                                    <p className="text-[10px] uppercase font-bold text-silver">{step.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-8 text-center">
                                        <label className="cursor-pointer text-[10px] font-bold text-silver hover:text-indblue uppercase transition-colors">
                                            Scan Another QR
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleQRUpload}
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'message' && (
                        <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                            <h3 className="text-xl font-bold text-indblue mb-6 flex items-center gap-2">
                                <MessageSquare className="text-saffron" size={20} />
                                Message Pattern Analysis
                            </h3>

                            <div className="space-y-6">
                                <textarea
                                    className="w-full p-4 bg-boxbg border border-silver/10 rounded-2xl text-sm text-charcoal outline-none focus:border-saffron/40 resize-none min-h-[120px]"
                                    placeholder="Paste suspicious WhatsApp message, SMS, or email here..."
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                ></textarea>

                                <div className="flex justify-start">
                                    <button
                                        onClick={handleMessageScan}
                                        disabled={isScanning || !messageText}
                                        className="bg-indblue text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-charcoal transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isScanning && <Loader2 size={14} className="animate-spin" />}
                                        {isScanning ? "Analyzing..." : "Scan Message"}
                                    </button>
                                </div>

                                {scanResult && (
                                    <div className={`p-6 rounded-2xl border ${scanResult.verdict === 'SAFE' ? 'bg-indgreen/5 border-indgreen/20' : 'bg-red-50 border-red-200'} animate-in fade-in duration-500 space-y-4`}>
                                        <div className="flex items-center gap-4">
                                            {scanResult.verdict === 'SAFE' ? (
                                                <div className="w-10 h-10 rounded-full bg-indgreen flex items-center justify-center text-white flex-shrink-0">
                                                    <CheckCircle2 size={24} />
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-redalert flex items-center justify-center text-white flex-shrink-0">
                                                    <AlertTriangle size={24} />
                                                </div>
                                            )}

                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <p className={`text-xs font-bold uppercase ${scanResult.verdict === 'SAFE' ? 'text-indgreen' : 'text-redalert'}`}>
                                                        {scanResult.verdict === 'SAFE' ? 'Safe Communication' : `High Probability Fraud (${scanResult.confidence}%)`}
                                                    </p>
                                                </div>
                                                <p className="text-[11px] text-charcoal">Pattern: {scanResult.pattern_detected}</p>
                                            </div>

                                            {scanResult.verdict === 'RISK' && (
                                                <div className="ml-auto">
                                                    <button
                                                        onClick={() => performAction('INTERCEPT_MESSAGE', 'SCAM_DETECTED')}
                                                        className="bg-redalert text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase hover:bg-red-700 transition-colors">
                                                        Intercept Source
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {scanResult.extracted_vpas && scanResult.extracted_vpas.length > 0 && (
                                            <div className="pt-4 border-t border-silver/10 mt-4">
                                                <p className="text-[10px] font-bold text-silver uppercase mb-3">Extracted UPI Handles (VPAs)</p>
                                                <div className="space-y-2">
                                                    {scanResult.extracted_vpas.map((vpa: any, i: number) => (
                                                        <div key={i} className={`flex justify-between items-center p-2 rounded bg-white border ${vpa.status === 'SAFE' ? 'border-indgreen/20' : 'border-red-200'} text-xs font-mono`}>
                                                            <span className={vpa.status === 'SAFE' ? 'text-indblue' : 'text-redalert'}>{vpa.vpa}</span>
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${vpa.status === 'SAFE' ? 'bg-indgreen/10 text-indgreen' : 'bg-redalert text-white'}`}>
                                                                {vpa.status}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
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
                                    <p className="text-2xl font-bold">{data?.dashboard?.vpa_checks_24h || "0"}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-bold text-indgreen">Flags</p>
                                    <p className="text-lg font-bold">{data?.dashboard?.flags || "0"}</p>
                                </div>
                            </div>
                            <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                                <div className="bg-saffron h-full" style={{ width: `${data?.dashboard?.vpa_risk_percent || 0}%` }} />
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
