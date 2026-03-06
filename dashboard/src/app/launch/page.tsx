"use client";

import { useState } from "react";
import {
    Rocket,
    Map,
    Calendar,
    Users,
    FileText,
    BarChart3,
    Globe,
    ShieldCheck,
    CheckCircle2,
    ChevronRight,
    Download,
    TrendingUp,
    Zap,
    Cpu,
    Target,
    Layers,
    Loader2
} from "lucide-react";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";

export default function LaunchPage() {
    const { performAction, downloadSimulatedFile } = useActions();
    const [selectedWave, setSelectedWave] = useState(2);
    const [isDeploying, setIsDeploying] = useState(false);

    const waves = [
        { id: 1, title: "Wave 1: Northern Hubs", states: ["Delhi", "NCR", "Haryana"], status: "OPERATIONAL", color: "bg-indgreen" },
        { id: 2, title: "Wave 2: Financial Corridors", states: ["Mumbai", "Bengaluru", "Hyderabad"], status: "ACTIVE", color: "bg-indblue" },
        { id: 3, title: "Wave 3: Border Regions", states: ["Punjab", "Rajasthan", "West Bengal"], status: "PENDING", color: "bg-saffron" }
    ];

    const metrics = [
        { label: "Agency Integration", val: "92%", detail: "Target: 95%" },
        { label: "Citizen Coverage", val: "48%", detail: "Phase: Onboarding" },
        { label: "System Uptime", val: "99.9%", detail: "SLA Compliant" }
    ];

    const handleDeploy = () => {
        setIsDeploying(true);
        const id = toast.loading("Initializing secure handshake with NIC nodes...");
        performAction('INITIATE_PILOT');
        setTimeout(() => toast.loading("Authorizing MHA clearance tokens...", { id }), 1000);
        setTimeout(() => toast.loading("Deploying Phase 34 logic to edge...", { id }), 2000);
        setTimeout(() => {
            toast.success("National Pilot Wave 2 Successfully Activated", { id });
            setIsDeploying(false);
        }, 3500);
    };

    return (
        <div className="space-y-6 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-indblue tracking-tight underline decoration-indgreen decoration-4 underline-offset-8">Launch Control Center</h2>
                    <p className="text-silver mt-4 italic font-medium">Strategic Planning & National Rollout Command (Phases 34-36).</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-white p-3 rounded-2xl border border-silver/10 shadow-sm flex items-center gap-3">
                        <Rocket className="text-indgreen animate-bounce" size={20} />
                        <div>
                            <p className="text-[10px] font-bold text-indblue uppercase leading-none">PRE-FLIGHT STATUS</p>
                            <p className="text-xs font-bold text-indgreen uppercase">T-MINUS 04 DAYS</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Rollout Roadmap */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex justify-between items-center mb-10">
                            <div className="flex items-center gap-3">
                                <Map className="text-indblue" size={24} />
                                <h3 className="text-xl font-bold text-indblue">National Rollout Roadmap</h3>
                            </div>
                            <div className="flex gap-1 bg-boxbg p-1 rounded-xl border border-silver/10">
                                {[1, 2, 3].map(w => (
                                    <button
                                        key={w}
                                        onClick={() => setSelectedWave(w)}
                                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${selectedWave === w ? 'bg-indblue text-white shadow-md' : 'text-silver'}`}
                                    >
                                        WAVE {w}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="relative space-y-12">
                            {/* Visual Timeline Path */}
                            <div className="absolute top-0 left-6 w-0.5 h-full bg-silver/10 -z-0" />

                            {waves.map((wave) => (
                                <div key={wave.id} className="relative z-10 flex gap-8">
                                    <div className={`w-12 h-12 rounded-2xl ${wave.color} flex items-center justify-center border-4 border-white shadow-xl shrink-0`}>
                                        <Layers size={20} className={wave.id <= selectedWave ? 'text-white' : 'text-charcoal/40'} />
                                    </div>
                                    <div className={`flex-1 p-6 rounded-3xl border transition-all ${selectedWave === wave.id ? 'bg-indblue/5 border-indblue' : 'bg-boxbg border-silver/5'}`}>
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="font-bold text-indblue">{wave.title}</h4>
                                            <span className={`text-[8px] font-black px-2 py-1 rounded-full border ${selectedWave === wave.id ? 'bg-indblue text-white' : 'bg-white text-silver'}`}>
                                                {wave.status}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {wave.states.map((s, i) => (
                                                <span key={i} className="text-[10px] font-bold px-3 py-1 bg-white rounded-lg border border-silver/10 text-charcoal">
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Revenue Ops & ROI */}
                    <div className="bg-indblue p-8 rounded-3xl border border-saffron/20 shadow-xl text-white relative overflow-hidden">
                        <BarChart3 size={150} className="absolute -right-8 -bottom-8 text-white/5" />
                        <div className="flex items-center justify-between mb-10">
                            <div className="flex items-center gap-3">
                                <TrendingUp className="text-saffron" size={24} />
                                <h3 className="text-xl font-bold uppercase tracking-tight">Revenue Operations (Phase 36)</h3>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-white/40 uppercase">Target ARR</p>
                                <p className="text-xl font-black text-saffron">₹106 Cr</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                            {/* Empty state for revenue operations */}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Launch Action */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Launch Trigger */}
                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm text-center">
                        <div className="w-20 h-20 bg-indgreen/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Target size={40} className="text-indgreen" />
                        </div>
                        <h4 className="text-xl font-bold text-indblue mb-2">Ready for Pilot Deployment</h4>
                        <p className="text-xs text-silver mb-8 leading-relaxed px-4">
                            Proceed to activate Phase 34. This will enable agency dashboards for Delhi NRI & Mewat Police nodes.
                        </p>
                        <button
                            onClick={handleDeploy}
                            disabled={isDeploying}
                            className={`w-full py-4 rounded-2xl font-black text-xs tracking-widest transition-all flex items-center justify-center gap-3 ${isDeploying ? 'bg-silver text-white' : 'bg-indgreen text-white hover:bg-indblue shadow-lg hover:shadow-indblue/20'}`}
                        >
                            {isDeploying ? <Cpu className="animate-spin" size={18} /> : <Rocket size={18} />}
                            {isDeploying ? 'EXECUTING LAUNCH PROTOCOLS...' : 'INITIATE NATIONAL PILOT'}
                        </button>
                    </div>

                    {/* Scale-up Readiness */}
                    <div className="bg-charcoal p-6 rounded-3xl border border-white/10 shadow-sm text-white">
                        <h4 className="font-bold text-xs mb-6 flex items-center gap-2 uppercase tracking-widest">
                            <Cpu className="text-indgreen" size={16} /> Scale Readiness
                        </h4>
                        <div className="space-y-6">
                            {metrics.map((m, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between items-center text-[10px] font-bold">
                                        <span className="opacity-60">{m.label}</span>
                                        <span className="text-indgreen">{m.val}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-indgreen" style={{ width: m.val }} />
                                    </div>
                                    <p className="text-[8px] opacity-40 font-bold uppercase">{m.detail}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Playbook Downloads */}
                    <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                        <h4 className="font-bold text-indblue text-[10px] uppercase mb-6 tracking-widest">Onboarding Playbooks</h4>
                        <div className="space-y-3">
                            {[
                                { name: 'Operation Manual v1.1', file: 'manual_op.pdf' },
                                { name: 'Escalation Protocol', file: 'protocol_esc.pdf' },
                                { name: 'Agency Integration Guide', file: 'agency_guide.pdf' }
                            ].map((p, i) => (
                                <button
                                    key={i}
                                    onClick={() => downloadSimulatedFile(p.name.toUpperCase().replace(/\s/g, '_'), 'pdf')}
                                    className="w-full flex items-center justify-between p-3 bg-boxbg hover:bg-indblue/5 rounded-xl border border-silver/5 transition-all group">
                                    <span className="text-[10px] font-bold text-charcoal">{p.name}</span>
                                    <Download size={14} className="text-silver group-hover:text-indblue" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
