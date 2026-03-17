"use client";

import { useState, useEffect } from "react";
import {
    Landmark,
    TrendingUp,
    ShieldAlert,
    ShieldCheck,
    Globe,
    Users,
    Activity,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    Filter,
    Download,
    Cpu,
    Zap,
    AlertTriangle,
    Database,
    Loader2
} from "lucide-react";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";

export default function CommandPage() {
    const { performAction, downloadSimulatedFile } = useActions();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`${API_BASE}/system/stats/command`);
                if (res.ok) setData(await res.json());
            } catch (error) {
                console.error("Error fetching command stats:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const statePerformance = data?.state_performance || [
        { state: "Uttar Pradesh", cases: 14205, resolved: "92%", trend: "down" },
        { state: "Maharashtra", cases: 12100, resolved: "88%", trend: "up" },
        { state: "Karnataka", cases: 9500, resolved: "94%", trend: "down" },
        { state: "West Bengal", cases: 8800, resolved: "85%", trend: "up" }
    ];

    const alerts = data?.alerts || [
        { id: 1, msg: "New Scam Pod detected in Noida Sector 15", time: "2m ago", severity: "HIGH" },
        { id: 2, msg: "Massive VPA rotation detected in Jamtara", time: "15m ago", severity: "CRITICAL" }
    ];

    return (
        <div className="space-y-6 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-indblue tracking-tight underline decoration-indblue decoration-4 underline-offset-8">National Command Intelligence Dashboard</h2>
                    <p className="text-silver mt-4 italic font-medium">Strategic "War Room" for National Anti-Fraud Response (Module 6).</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-white p-3 rounded-2xl border border-silver/10 shadow-sm flex items-center gap-3">
                        <Activity className="text-indgreen animate-pulse" size={20} />
                        <div>
                            <p className="text-[10px] font-bold text-indblue uppercase leading-none">WAR ROOM STATUS</p>
                            <p className="text-xs font-bold text-indgreen uppercase">LIVE | ACTIVE OPS</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Stats Cards */}
                <div className="bg-indblue p-6 rounded-3xl text-white relative overflow-hidden shadow-xl">
                    <Zap size={60} className="absolute -right-4 -bottom-4 text-white/10" />
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Rupees Saved (Live)</p>
                    <h3 className="text-2xl font-black mt-2">₹{(data?.rupees_saved || 1420500000).toLocaleString('en-IN')}</h3>
                    <div className="flex items-center gap-1 text-[10px] mt-4 text-indgreen font-bold bg-white/10 w-fit px-2 py-1 rounded-full border border-white/10">
                        <ArrowUpRight size={12} /> +12% vs last month
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <p className="text-[10px] font-bold text-silver uppercase tracking-widest">Active Scam Clusters</p>
                    <h3 className="text-2xl font-black text-indblue mt-2">{data?.active_clusters || "..."}</h3>
                    <div className="flex items-center gap-1 text-[10px] mt-4 text-redalert font-bold bg-redalert/10 w-fit px-2 py-1 rounded-full border border-redalert/10">
                        High Persistence Detected
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <p className="text-[10px] font-bold text-silver uppercase tracking-widest">Mule VPA Freeze Requests</p>
                    <h3 className="text-2xl font-black text-indblue mt-2">{data?.freeze_requests || 0}</h3>
                    <p className="text-[10px] text-silver font-medium mt-4">{((data?.freeze_requests || 0) > 0 ? "85.2" : "0.0")}% Auto-Execution Rate</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <p className="text-[10px] font-bold text-silver uppercase tracking-widest">National Cyber Hygiene</p>
                    <h3 className="text-2xl font-black text-indblue mt-2">{data?.cyber_hygiene || "0.0%"}</h3>
                    <div className="h-1.5 w-full bg-boxbg rounded-full mt-4 overflow-hidden">
                        <div className="h-full bg-indgreen" style={{ width: data?.cyber_hygiene || "0%" }} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* National Heatmap / Performance */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-3">
                                <Globe className="text-indblue" size={24} />
                                <h3 className="text-xl font-bold text-indblue">State-level Response Matrix</h3>
                            </div>
                            <button className="flex items-center gap-2 p-2 bg-boxbg rounded-xl border border-silver/10 text-[10px] font-bold text-indblue">
                                <Filter size={14} /> FILTER BY AGENT
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-silver/10">
                                        <th className="pb-4 text-[10px] font-bold text-silver uppercase tracking-widest">State / UT</th>
                                        <th className="pb-4 text-[10px] font-bold text-silver uppercase tracking-widest">Live Cases</th>
                                        <th className="pb-4 text-[10px] font-bold text-silver uppercase tracking-widest">Resolution Rate</th>
                                        <th className="pb-4 text-[10px] font-bold text-silver uppercase tracking-widest">Threat Trend</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-silver/5">
                                    {(Array.isArray(statePerformance) ? statePerformance : []).map((s: any, i: number) => (
                                        <tr key={i} className="group hover:bg-boxbg/50 transition-colors">
                                            <td className="py-4 font-bold text-indblue text-sm">{s.state || 'N/A'}</td>
                                            <td className="py-4 text-xs font-bold text-charcoal">{(s.cases || 0).toLocaleString()}</td>
                                            <td className="py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-indblue">{s.resolved}</span>
                                                    <div className="w-20 h-1 bg-boxbg rounded-full overflow-hidden">
                                                        <div className="h-full bg-indblue" style={{ width: s.resolved }} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                {s.trend === 'up' ? (
                                                    <ArrowUpRight className="text-redalert" size={16} />
                                                ) : (
                                                    <ArrowDownRight className="text-indgreen" size={16} />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Scam Weather Forecast */}
                    <div className="bg-charcoal p-8 rounded-3xl border border-white/5 shadow-2xl text-white relative overflow-hidden group">
                        <Calendar size={120} className="absolute -right-8 -bottom-8 text-white/5" />
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <ShieldAlert className="text-saffron" size={24} />
                                <h3 className="text-xl font-bold uppercase tracking-tight">Scam Weather Forecast</h3>
                            </div>
                            <span className="text-[10px] font-bold bg-white/10 px-3 py-1 rounded-full border border-white/10 uppercase">Predictive Intelligence</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {(data?.forecast || [
                                { day: 'Today', trend: 'High Activity', color: 'text-redalert' },
                                { day: 'Tomorrow', trend: 'Moderate', color: 'text-saffron' },
                                { day: 'Weekend', trend: 'Critical Spike', color: 'text-redalert' }
                            ]).map((d: any, i: number) => (
                                <div key={i} className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-[10px] uppercase font-bold text-white/40 mb-2">{d.day}</p>
                                    <p className={`text-sm font-bold ${d.color || 'text-saffron'}`}>{d.trend}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Panel: OCC Health */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-2 mb-6 text-redalert">
                            <AlertTriangle size={20} />
                            <h4 className="font-bold text-sm uppercase">Active Intelligence Alerts</h4>
                        </div>
                        <div className="space-y-4">
                            {(Array.isArray(alerts) ? alerts : []).map((a: any) => (
                                <div key={a.id} className="p-3 bg-redalert/5 border border-redalert/10 rounded-xl">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded ${a.severity === 'CRITICAL' ? 'bg-redalert text-white' : 'bg-saffron text-white'}`}>
                                            {a.severity}
                                        </span>
                                        <span className="text-[8px] text-silver font-bold uppercase">{a.time}</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-indblue leading-snug">{a.msg}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* OCC Disaster Recovery Health */}
                    <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm overflow-hidden relative">
                        <Database size={60} className="absolute -right-4 -bottom-4 text-indblue/5" />
                        <h4 className="font-bold text-indblue text-xs uppercase mb-6 flex items-center gap-2">
                            <Cpu size={14} /> Systems Health (OCC)
                        </h4>
                        <div className="space-y-4 relative z-10">
                            {[
                                { label: 'Detection Nodes', status: data?.system_health?.detection_nodes || 'Operational', color: 'text-indgreen' },
                                { label: 'VPA Interceptor', status: data?.system_health?.vpa_interceptor || 'Busy', color: data?.system_health?.vpa_interceptor === 'Operational' ? 'text-indgreen' : 'text-saffron' },
                                { label: 'Voice AI Core', status: data?.system_health?.voice_ai_core || 'Operational', color: 'text-indgreen' }
                            ].map((s: any, i: number) => (
                                <div key={i} className="flex justify-between items-center text-[10px]">
                                    <span className="text-silver font-bold uppercase">{s.label}</span>
                                    <span className={`font-mono font-bold ${s.color}`}>{s.status}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => downloadSimulatedFile('SYSTEM_LOGS', 'txt')}
                            className="w-full mt-6 flex items-center justify-center p-3 border border-indblue rounded-xl text-[10px] font-extrabold text-indblue hover:bg-indblue/5">
                            <Download size={14} className="mr-2" /> DOWNLOAD SYSTEM LOGS
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
