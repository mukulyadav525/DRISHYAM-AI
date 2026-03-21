"use client";

import { useEffect, useState } from "react";
import { Globe, Languages, Loader2, Rocket, Server, ShieldCheck, Users } from "lucide-react";
import { toast } from "react-hot-toast";

import { API_BASE } from "@/config/api";
import { useAuth } from "@/context/AuthContext";

interface RolloutWave {
    task: string;
    wave: string;
    states: string[];
    district_count: number;
    status: string;
}

interface LanguageWave {
    task: string;
    wave: string;
    languages: string[];
    coverage: string;
    status: string;
}

interface Playbook {
    task: string;
    title: string;
    path: string;
    absolute_path: string;
    published: boolean;
}

interface CapacityPlan {
    staffing: { task: string; analysts_target: number; field_support_target: number; partner_managers_target: number };
    infra: { task: string; regions: number; active_clusters: number; target_uptime: string };
    gpu: { task: string; current_gpu_pool: number; target_gpu_pool: number; burst_strategy: string };
}

interface NationalScaleData {
    rollout_waves: RolloutWave[];
    language_waves: LanguageWave[];
    playbooks: Playbook[];
    capacity_plan: CapacityPlan;
    campaigns: {
        national_awareness: { task: string; channels: string[]; status: string };
        citizen_support: { task: string; languages: number; support_hubs: number; status: string };
        pr_and_crisis: { task: string; spokespeople: string[]; status: string };
    };
    incident_escalation: Array<{ task: string; level: string; trigger: string; owner: string }>;
    cross_border_plan: { task: string; partners: string[]; exchange_format: string; status: string };
}

interface LaunchGate {
    id: string;
    label: string;
    complete: boolean;
    detail: string;
}

interface LaunchReadiness {
    completed: number;
    total: number;
    ready_for_go_live: boolean;
    gates: LaunchGate[];
}

export default function NationalPage() {
    const { user } = useAuth();
    const [data, setData] = useState<NationalScaleData | null>(null);
    const [readiness, setReadiness] = useState<LaunchReadiness | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!user?.token) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const headers = { Authorization: `Bearer ${user.token}` };
                const [scaleRes, readinessRes] = await Promise.all([
                    fetch(`${API_BASE}/program-office/national-scale`, { headers }),
                    fetch(`${API_BASE}/program-office/launch-readiness`, { headers }),
                ]);

                if (!scaleRes.ok || !readinessRes.ok) {
                    throw new Error("Failed to load national scale control plane.");
                }

                const scaleData = (await scaleRes.json()) as NationalScaleData;
                const readinessData = (await readinessRes.json()) as { readiness: LaunchReadiness };
                setData(scaleData);
                setReadiness(readinessData.readiness);
            } catch (error) {
                console.error(error);
                toast.error("Unable to load national scale planning.");
            } finally {
                setLoading(false);
            }
        };

        void fetchData();
    }, [user?.token]);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-indblue" size={32} />
            </div>
        );
    }

    if (!data || !readiness) {
        return <div className="text-silver">National scale planning is unavailable right now.</div>;
    }

    return (
        <div className="space-y-6 max-w-7xl">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-indblue tracking-tight underline decoration-indblue decoration-4 underline-offset-8">
                        National Scale Preparation
                    </h2>
                    <p className="text-silver mt-4 italic font-medium">
                        Phase 35 and Phase 40 control surface for rollout sequencing, capacity, and go-live gates.
                    </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-silver/10 shadow-sm min-w-[240px]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Launch Readiness</p>
                    <p className={`text-2xl font-black mt-2 ${readiness.ready_for_go_live ? "text-indgreen" : "text-saffron"}`}>
                        {readiness.completed}/{readiness.total}
                    </p>
                    <p className="text-xs text-silver mt-2">
                        {readiness.ready_for_go_live ? "All gates are green for go-live." : "Readiness is progressing through final launch gates."}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-indblue text-white p-6 rounded-3xl shadow-xl">
                    <div className="flex items-center gap-3">
                        <Rocket size={22} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Rollout Waves</p>
                    </div>
                    <p className="text-3xl font-black mt-3">{data.rollout_waves.length}</p>
                    <p className="text-xs text-white/70 mt-2">773 districts planned across four national waves.</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <Languages size={22} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Language Expansion</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">{data.language_waves[data.language_waves.length - 1]?.coverage || "0/22"}</p>
                    <p className="text-xs text-silver mt-2">Expansion waves staged toward full 22-language coverage.</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <Users size={22} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Scale Staffing</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">{data.capacity_plan.staffing.analysts_target + data.capacity_plan.staffing.field_support_target}</p>
                    <p className="text-xs text-silver mt-2">Analysts and support roles planned for 24x7 national operations.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <Globe className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">State Rollout Waves</h3>
                        </div>
                        <div className="space-y-4">
                            {data.rollout_waves.map((wave) => (
                                <div key={wave.wave} className="p-5 rounded-2xl bg-boxbg border border-silver/10">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-bold text-indblue">{wave.wave}</p>
                                            <p className="text-xs text-silver mt-1">{wave.states.join(", ")}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-black text-charcoal">{wave.district_count}</p>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-silver">{wave.status}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <Languages className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Language Expansion Waves</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {data.language_waves.map((wave) => (
                                <div key={wave.wave} className="p-5 rounded-2xl border border-silver/10 bg-boxbg">
                                    <p className="text-sm font-bold text-indblue">{wave.wave}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-saffron mt-2">{wave.coverage}</p>
                                    <p className="text-xs text-silver mt-3 leading-6">{wave.languages.join(", ")}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <ShieldCheck className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Playbooks and Escalation Plans</h3>
                        </div>
                        <div className="space-y-4">
                            {data.playbooks.map((playbook) => (
                                <div key={playbook.task} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <div>
                                        <p className="text-sm font-bold text-indblue">{playbook.title}</p>
                                        <p className="text-[10px] text-silver mt-1">{playbook.path}</p>
                                    </div>
                                    <span className={`text-[10px] font-black px-3 py-1 rounded-full ${playbook.published ? "bg-indgreen/10 text-indgreen" : "bg-redalert/10 text-redalert"}`}>
                                        {playbook.published ? "PUBLISHED" : "MISSING"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-5 space-y-6">
                    <div className="bg-charcoal text-white p-8 rounded-3xl shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <Server className="text-saffron" size={22} />
                            <h3 className="text-xl font-bold">Capacity Plan</h3>
                        </div>
                        <div className="space-y-5 text-sm">
                            <div>
                                <p className="text-white/50 uppercase text-[10px] font-bold">OCC Staffing</p>
                                <p className="font-bold mt-1">Analysts {data.capacity_plan.staffing.analysts_target} · Field Support {data.capacity_plan.staffing.field_support_target}</p>
                            </div>
                            <div>
                                <p className="text-white/50 uppercase text-[10px] font-bold">Infra Regions</p>
                                <p className="font-bold mt-1">{data.capacity_plan.infra.regions} regions · {data.capacity_plan.infra.active_clusters} active clusters</p>
                            </div>
                            <div>
                                <p className="text-white/50 uppercase text-[10px] font-bold">GPU Burst Plan</p>
                                <p className="font-bold mt-1">{data.capacity_plan.gpu.current_gpu_pool} to {data.capacity_plan.gpu.target_gpu_pool} GPU pool</p>
                                <p className="text-xs text-white/60 mt-2">{data.capacity_plan.gpu.burst_strategy}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <h3 className="text-xl font-bold text-indblue mb-5">Awareness and Support Campaigns</h3>
                        <div className="space-y-5 text-sm">
                            <div>
                                <p className="font-bold text-charcoal">National awareness</p>
                                <p className="text-silver mt-1">{data.campaigns.national_awareness.channels.join(", ")}</p>
                            </div>
                            <div>
                                <p className="font-bold text-charcoal">Citizen support at scale</p>
                                <p className="text-silver mt-1">{data.campaigns.citizen_support.languages} languages · {data.campaigns.citizen_support.support_hubs} support hubs</p>
                            </div>
                            <div>
                                <p className="font-bold text-charcoal">PR and crisis communications</p>
                                <p className="text-silver mt-1">{data.campaigns.pr_and_crisis.spokespeople.join(", ")}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <h3 className="text-xl font-bold text-indblue mb-5">Launch Readiness Gates</h3>
                        <div className="space-y-3">
                            {readiness.gates.map((gate) => (
                                <div key={gate.id} className="p-4 rounded-2xl border border-silver/10 bg-boxbg">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-indblue">{gate.label}</p>
                                            <p className="text-xs text-silver mt-1">{gate.detail}</p>
                                        </div>
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${gate.complete ? "bg-indgreen/10 text-indgreen" : "bg-saffron/10 text-saffron"}`}>
                                            {gate.complete ? "GREEN" : "PENDING"}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
