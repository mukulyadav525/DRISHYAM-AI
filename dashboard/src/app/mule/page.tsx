"use client";

import { useState, useEffect } from "react";
import {
    Briefcase,
    Search,
    ShieldAlert,
    UserPlus,
    FileSearch,
    ArrowRight,
    Filter,
    ExternalLink,
    Loader2,
    ShieldCheck
} from "lucide-react";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";
import FeedModal from "@/components/FeedModal";


interface MuleAd {
    id: number;
    title: string;
    salary: string;
    platform: string;
    risk: number;
    status: string;
}

interface MuleStats {
    ads: MuleAd[];
    patterns: { label: string; value: number }[];
}

export default function MulePage() {
    const { performAction } = useActions();
    const [isScanning, setIsScanning] = useState(false);
    const [data, setData] = useState<MuleStats | null>(null);
    const [scanProgress, setScanProgress] = useState(0);
    const [selectedIntel, setSelectedIntel] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchStats = async () => {
        try {
            const res = await fetch(`${API_BASE}/system/stats/mule`);
            if (res.ok) setData(await res.json());
        } catch (error) {
            console.error("Error fetching mule stats:", error);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const startScan = async () => {
        setIsScanning(true);
        setScanProgress(0);
        
        let progress = 0;
        const progInterval = setInterval(() => {
            progress += 5;
            if (progress <= 90) setScanProgress(progress);
        }, 100);

        try {
            const result = await performAction('SCAN_MULE_FEED');
            clearInterval(progInterval);
            setScanProgress(100);
            
            if (result && result.status === 'success') {
                toast.success(result.message);
                // Fetch fresh stats to see the new ad
                await fetchStats();
            }
        } catch (e) {
            toast.error("Interception Pipeline Failed");
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-indblue tracking-tight">Mule Recruitment Interceptor</h2>
                    <p className="text-silver mt-1">Detecting job scams and money mule recruitment campaigns.</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" size={16} />
                        <input
                            type="text"
                            placeholder="Search Recruiter ID..."
                            className="pl-10 pr-4 py-2 bg-white border border-silver/10 rounded-lg text-sm outline-none w-64 shadow-sm"
                        />
                    </div>
                    <button
                        onClick={startScan}
                        disabled={isScanning}
                        className="px-4 py-2 bg-saffron text-white rounded-lg text-sm font-semibold hover:bg-deeporange transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isScanning ? <Loader2 className="animate-spin" size={16} /> : <Filter size={16} />}
                        {isScanning ? `Analyzing ${scanProgress}%` : "Scan Active Feed"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Ad Feed */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl border border-silver/10 overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-boxbg flex justify-between items-center bg-boxbg/30">
                            <h3 className="font-bold text-indblue flex items-center gap-2">
                                <Briefcase size={18} className="text-saffron" />
                                {isScanning ? "Neural Interception in Progress..." : "Interception Feed"}
                            </h3>
                            <span className="text-[10px] font-bold text-silver uppercase tracking-widest">
                                {isScanning ? "Deep Scanning Active" : `${data?.ads?.length || 0} Active Alerts Found`}
                            </span>
                        </div>

                        <div className="divide-y divide-boxbg">
                            {isScanning && (
                                <div className="p-12 text-center animate-pulse">
                                    <div className="w-16 h-16 bg-saffron/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Loader2 className="animate-spin text-saffron" size={32} />
                                    </div>
                                    <p className="text-sm font-bold text-indblue">Crawling Job Portals & Messaging Groups...</p>
                                    <p className="text-xs text-silver mt-1">Applying linguistic fraud patterns (Phase 21 ML Stack)</p>
                                </div>
                            )}
                            {!isScanning && data?.ads && Array.isArray(data.ads) ? data.ads.map((ad) => (
                                <div key={ad.id} className="p-6 hover:bg-boxbg/20 transition-all group relative">
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${ad.risk > 0.7 ? "bg-redalert/10 text-redalert" : "bg-indblue/10 text-indblue"
                                                }`}>
                                                <UserPlus size={24} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-charcoal group-hover:text-indblue">{ad.title}</h4>
                                                    <ExternalLink size={12} className="text-silver opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <p className="text-xs text-silver mt-0.5">Offered Salary: <span className="font-bold text-indgreen">{ad.salary}</span></p>
                                                <div className="flex gap-3 mt-3">
                                                    <span className="text-[10px] bg-boxbg px-2 py-0.5 rounded text-silver font-bold uppercase">{ad.platform}</span>
                                                    <span className="text-[10px] text-silver font-medium">• SID-MULE-{(29931 + ad.id)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-1 ${ad.risk > 0.7 ? "bg-redalert/10 text-redalert" : ad.risk > 0.3 ? "bg-gold/10 text-gold" : "bg-indgreen/10 text-indgreen"
                                                }`}>
                                                {ad.status}
                                            </div>
                                            <p className="text-[10px] font-mono text-silver">Confidence: {(ad.risk * 100).toFixed(0)}%</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex gap-2">
                                        <button
                                            onClick={async () => {
                                                const id = toast.loading("Intercepting encrypted packet...");
                                                const result = await performAction('DECOMPILE_AGENT', `AD-${ad.id}`);
                                                if (result && result.detail) {
                                                    toast.success(result.message, { id });
                                                    toast.success(`Attribution: ${result.detail.attribution}`, { duration: 4000 });
                                                } else {
                                                    toast.error("Decompilation Failed", { id });
                                                }
                                            }}
                                            className="text-[10px] font-bold text-indblue bg-indblue/5 px-4 py-2 rounded-lg hover:bg-indblue hover:text-white transition-all uppercase tracking-widest">
                                            Decompile Agent Identity
                                        </button>
                                        <button
                                            onClick={() => performAction('FLAG_ACCOUNT', ad.platform, { title: ad.title })}
                                            className="text-[10px] font-bold text-redalert bg-redalert/5 px-4 py-2 rounded-lg hover:bg-redalert hover:text-white transition-all uppercase tracking-widest">
                                            Flag Account
                                        </button>
                                    </div>
                                </div>
                            )) : !isScanning && (
                                <div className="p-12 text-center text-silver italic text-sm">No suspicious recruitment ads detected.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Intelligence Sidebar */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-silver/10 p-6 shadow-sm">
                        <h4 className="font-bold text-indblue mb-6 flex items-center gap-2">
                            <FileSearch size={18} className="text-saffron" />
                            Threat Patterns
                        </h4>
                        <div className="space-y-6">
                            {(data?.patterns || []).map(p => (
                                <div key={p.label}>
                                    <div className="flex justify-between text-[11px] font-bold text-silver mb-2">
                                        <span>{p.label}</span>
                                        <span>{p.value || 0}%</span>
                                    </div>
                                    <div className="w-full h-1 bg-boxbg rounded-full overflow-hidden">
                                        <div className={`h-full ${(p.value || 0) > 80 ? 'bg-redalert' : (p.value || 0) > 70 ? 'bg-saffron' : 'bg-gold'}`} style={{ width: `${p.value || 0}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-indblue p-6 rounded-2xl border border-saffron/20 text-white shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <ShieldAlert size={64} />
                        </div>
                        <h4 className="font-bold mb-2">Targeted Campaigns</h4>
                        <p className="text-xs text-silver leading-relaxed mb-6">
                            Current surge detected in "Tier-2 College" recruitment drives. Multiple fake HR profiles active on job platforms.
                        </p>
                        <button
                            onClick={async () => {
                                const result = await performAction('VIEW_INCIDENT', 'MULE_CAMPAIGNS');
                                if (result && result.detail) {
                                    setSelectedIntel(result.detail);
                                    setIsModalOpen(true);
                                }
                            }}
                            className="flex items-center gap-2 text-[10px] font-bold uppercase bg-white/10 px-4 py-2 rounded-lg hover:bg-saffron transition-colors">
                            View Detailed Intelligence <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            <FeedModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                data={selectedIntel}
            />
        </div>
    );
}
