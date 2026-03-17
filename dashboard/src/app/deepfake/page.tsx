"use client";

import { useState, useEffect, useRef } from "react";
import {
    ShieldCheck,
    ShieldAlert,
    Video,
    Upload,
    Scan,
    Eye,
    FileWarning,
    Activity,
    Loader2
} from "lucide-react";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";
import FeedModal from "@/components/FeedModal";


interface DeepfakeStats {
    incidents: { type: string; risk: string; status: string }[];
    model_status: { liveness: string; gan_detector: string; false_positive_rate: string };
}

interface ForensicResult {
    id?: number;
    verdict: 'REAL' | 'SUSPICIOUS' | 'FAKE';
    confidence: number;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    anomalies: string[];
    analysis_details: {
        blink_frequency: string;
        temporal_consistency: string;
        lip_sync_match: string;
        visual_artifacts: string;
    };
}

export default function DeepfakePage() {
    const { performAction } = useActions();
    const [isScanning, setIsScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [verdict, setVerdict] = useState<null | 'REAL' | 'SUSPICIOUS' | 'FAKE' | 'VERIFIED' | 'DEEPFAKE'>(null);
    const [data, setData] = useState<DeepfakeStats | null>(null);
    const [aiResult, setAiResult] = useState<ForensicResult | null>(null);
    const [selectedIncident, setSelectedIncident] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchStats = async () => {
            const res = await fetch(`${API_BASE}/system/stats/deepfake`);
            if (res.ok) setData(await res.json());
        };
        fetchStats();
    }, []);

    const startScan = async (file?: File) => {
        setIsScanning(true);
        setProgress(0);
        setVerdict(null);
        setAiResult(null);

        performAction('SCAN_VIDEO', 'FORENSIC_PIPELINE');

        try {
            const authStr = localStorage.getItem('sentinel_auth');
            const token = authStr ? JSON.parse(authStr).token : null;

            let res;
            if (file) {
                const formData = new FormData();
                formData.append("file", file);

                res = await fetch(`${API_BASE}/forensic/deepfake/upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
            } else {
                res = await fetch(`${API_BASE}/forensic/deepfake/analyze`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ media_type: 'video' })
                });
            }

            if (res.ok) {
                const result = await res.json();
                
                if (result.status === "PENDING" && result.id) {
                    // Poll for completion
                    const pollInterval = setInterval(async () => {
                        try {
                            const statusRes = await fetch(`${API_BASE}/forensic/status/${result.id}`, {
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            
                            if (statusRes.ok) {
                                const statusData = await statusRes.json();
                                if (statusData.status === "COMPLETED") {
                                    clearInterval(pollInterval);
                                    setAiResult(statusData);
                                    setProgress(100);
                                    // Final UI feedback will be handled by useEffect
                                } else if (statusData.status === "FAILED") {
                                    clearInterval(pollInterval);
                                    setIsScanning(false);
                                    alert("Analysis failed. Please try again.");
                                } else {
                                    // Increment progress slightly while waiting
                                    setProgress(prev => Math.min(prev + 2, 98));
                                }
                            }
                        } catch (err) {
                            console.error("Polling Error:", err);
                            clearInterval(pollInterval);
                            setIsScanning(false);
                        }
                    }, 3000);
                } else {
                    setAiResult(result);
                    setProgress(100);
                }
            } else {
                setIsScanning(false);
            }
        } catch (err) {
            console.error("Forensic API Error:", err);
            setIsScanning(false);
        }
    };

    const handleDownloadReport = async () => {
        if (!aiResult?.id) return;
        
        try {
            const authStr = localStorage.getItem('sentinel_auth');
            const token = authStr ? JSON.parse(authStr).token : null;
            
            const res = await fetch(`${API_BASE}/forensic/report/${aiResult.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Forensic_Report_${aiResult.id}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            }
        } catch (err) {
            console.error("Download Error:", err);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            startScan(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            startScan(e.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    useEffect(() => {
        if (isScanning && progress < 100) {
            const timer = setTimeout(() => {
                setProgress(prev => prev + 5);
            }, 100);
            return () => clearTimeout(timer);
        } else if (progress >= 100) {
            setTimeout(() => {
                setIsScanning(false);
                setVerdict(aiResult?.verdict || 'FAKE');
            }, 500);
        }
    }, [isScanning, progress, aiResult]);

    const getVerdictColor = (v: string) => {
        if (v === 'REAL' || v === 'VERIFIED') return 'bg-indgreen/10 text-indgreen';
        if (v === 'SUSPICIOUS') return 'bg-gold/10 text-gold';
        return 'bg-redalert/10 text-redalert';
    };

    const getVerdictTextColor = (v: string) => {
        if (v === 'REAL' || v === 'VERIFIED') return 'text-indgreen';
        if (v === 'SUSPICIOUS') return 'text-gold';
        return 'text-redalert';
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-indblue tracking-tight">Deepfake Defense</h2>
                    <p className="text-silver mt-1">Multi-layer forensic analysis for Images, Videos, Audio, and PDFs.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isScanning}
                        className="px-6 py-2 bg-saffron text-white rounded-lg text-sm font-semibold hover:bg-deeporange transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isScanning ? <Loader2 className="animate-spin" size={16} /> : <Scan size={16} />}
                        {isScanning ? "Scanning..." : "New Forensic Scan"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl border border-silver/10 p-8 shadow-sm h-[500px] flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-boxbg/30" />

                        {isScanning ? (
                            <div className="z-10 text-center space-y-6 w-full max-w-xs">
                                <div className="relative w-32 h-32 mx-auto">
                                    <div className="absolute inset-0 border-4 border-saffron/10 rounded-full" />
                                    <div
                                        className="absolute inset-0 border-4 border-saffron rounded-full border-t-transparent animate-spin"
                                        style={{ animationDuration: '2s' }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-indblue">
                                        {progress}%
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm font-bold text-indblue">Extracting Forensic Markers...</p>
                                    <div className="w-full h-1.5 bg-boxbg rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-saffron transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : verdict ? (
                            <div className="z-10 text-center space-y-6 w-full px-8">
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-lg ${getVerdictColor(verdict)}`}>
                                    {verdict === 'FAKE' || verdict === 'DEEPFAKE' ? <ShieldAlert size={40} /> : <ShieldCheck size={40} />}
                                </div>
                                <div>
                                    <h3 className={`text-3xl font-bold ${getVerdictTextColor(verdict)}`}>
                                        {verdict}
                                    </h3>
                                    <p className="text-silver mt-2 text-sm uppercase tracking-widest font-bold">
                                        Risk Level: <span className={aiResult?.risk_level === 'HIGH' ? 'text-redalert' : 'text-indgreen'}>{aiResult?.risk_level || 'LOW'}</span>
                                    </p>
                                </div>
                                
                                {aiResult?.anomalies && aiResult.anomalies.length > 0 && (
                                    <div className="bg-boxbg/50 p-4 rounded-xl border border-silver/10 max-w-md mx-auto">
                                        <p className="text-[10px] font-bold text-silver uppercase mb-2">Detected Anomalies</p>
                                        <ul className="text-left space-y-1">
                                            {aiResult.anomalies.map((a, i) => (
                                                <li key={i} className="text-xs text-indblue flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 bg-saffron rounded-full" />
                                                    {a}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="flex gap-4 justify-center">
                                    <button
                                        onClick={() => { setVerdict(null); performAction('RESET_SCAN'); }}
                                        className="px-6 py-2 border border-silver/10 rounded-lg text-xs font-bold text-silver uppercase tracking-wider hover:text-indblue transition-all"
                                    >
                                        New Scan
                                    </button>
                                    {aiResult?.id && (
                                        <button
                                            onClick={handleDownloadReport}
                                            className="px-6 py-2 bg-indblue text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indblue/80 transition-all flex items-center gap-2"
                                        >
                                            <Upload size={14} className="rotate-180" />
                                            Download Report
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div
                                className="z-10 text-center space-y-4"
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*,video/*"
                                    onChange={handleFileChange}
                                />
                                <div className="w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center mx-auto border border-silver/10 group cursor-pointer hover:border-saffron/40 transition-colors" onClick={() => fileInputRef.current?.click()}>
                                    <Upload className="text-silver group-hover:text-saffron transition-colors" size={32} />
                                </div>
                                <p className="text-sm font-bold text-indblue">Drop Forensic Image or Video Frame</p>
                                <p className="text-[10px] text-silver font-medium uppercase tracking-widest leading-relaxed">
                                    Supports .mp4, .png, .jpg • MAX 50MB
                                </p>
                            </div>
                        )}

                        {/* Progress Overlay Simulation */}
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white to-transparent">
                            <div className="flex justify-between text-[10px] font-bold text-silver uppercase mb-2">
                                <span>Analysis Pipeline: {isScanning ? 'Processing' : verdict ? 'Complete' : 'Idle'}</span>
                                <span>{isScanning ? '...' : '0.0ms'} Latency</span>
                            </div>
                            <div className="w-full h-1 bg-boxbg rounded-full overflow-hidden">
                                <div className="h-full bg-saffron/20 w-1/3" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: "Blink Frequency", value: isScanning ? "Analyzing..." : verdict ? (aiResult?.analysis_details.blink_frequency || "Normal") : "Ready", color: verdict === 'DEEPFAKE' ? "text-redalert" : "text-indgreen" },
                            { label: "Temporal Consistency", value: isScanning ? "Calculating..." : verdict ? (aiResult?.analysis_details.temporal_consistency || "98.2%") : "Ready", color: verdict === 'DEEPFAKE' ? "text-redalert" : "text-indgreen" },
                            { label: "Lip-Sync Match", value: isScanning ? "Validating..." : verdict ? (aiResult?.analysis_details.lip_sync_match || "Verified") : "Ready", color: verdict === 'DEEPFAKE' ? "text-redalert" : "text-indgreen" }
                        ].map(f => (
                            <div key={f.label} className="bg-white p-4 rounded-xl border border-silver/10 text-center">
                                <p className="text-[9px] font-bold text-silver uppercase tracking-wider mb-1">{f.label}</p>
                                <p className={`text-sm font-bold ${f.color}`}>{f.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Intelligence Sidebar */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-silver/10 p-6 shadow-sm">
                        <h4 className="font-bold text-indblue mb-6 flex items-center gap-2">
                            <Activity size={18} className="text-saffron" />
                            Recent Incidents
                        </h4>
                        <div className="space-y-4">
                            {data?.incidents && Array.isArray(data.incidents) ? data.incidents.map((inc: any, i: number) => {
                                const Icon = inc.status === "Deepfake" ? ShieldAlert : FileWarning;
                                return (
                                    <div
                                        key={i}
                                        onClick={async () => {
                                            const result = await performAction('VIEW_INCIDENT', inc.type);
                                            if (result && result.detail) {
                                                setSelectedIncident(result.detail);
                                                setIsModalOpen(true);
                                            }
                                        }}
                                        className="p-4 rounded-xl bg-boxbg/50 border border-silver/5 hover:border-saffron/20 transition-all cursor-pointer group"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <Icon size={18} className={inc.status === "Deepfake" ? "text-redalert" : "text-gold"} />
                                            <span className="text-[10px] font-bold uppercase text-silver">{inc.risk} Risk</span>
                                        </div>
                                        <p className="text-xs font-bold text-indblue group-hover:text-saffron transition-colors">{inc.type}</p>
                                        <p className="text-[10px] text-silver mt-1">Verdict: <span className="font-bold">{inc.status}</span></p>
                                    </div>
                                );
                            }) : (
                                <p className="text-[10px] text-silver italic">No recent incidents found.</p>
                            )}
                        </div>
                        <button
                            onClick={() => performAction('VIEW_HISTORY')}
                            className="w-full py-3 mt-6 border border-silver/10 rounded-xl text-[10px] font-bold text-silver uppercase tracking-widest hover:text-indblue transition-all bg-boxbg/30">
                            View History
                        </button>
                    </div>

                    <div className="bg-indblue p-6 rounded-2xl border border-saffron/20 text-white shadow-xl relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-indgreen/10 rounded-full blur-xl group-hover:bg-indgreen/20 transition-all" />
                        <h4 className="font-bold mb-4 flex items-center gap-2">
                            <ShieldCheck className="text-indgreen" size={18} />
                            Model Status
                        </h4>
                        <div className="space-y-4">
                            <div className="flex justify-between text-xs">
                                <span className="text-silver">Liveness V4</span>
                                <span className="font-mono text-indgreen uppercase">{data?.model_status?.liveness || "Operational"}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-silver">GAN Detector</span>
                                <span className="font-mono text-indgreen uppercase">{data?.model_status?.gan_detector || "Active"}</span>
                            </div>
                            <div className="flex justify-between text-xs border-t border-white/5 pt-4 mt-4">
                                <span className="text-silver">False Positive Rate</span>
                                <span className="font-mono text-gold">{data?.model_status?.false_positive_rate || "0.01%"}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <FeedModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                data={selectedIncident}
            />
        </div>
    );
}
