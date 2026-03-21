"use client";

import { FormEvent, useEffect, useState } from "react";
import { Handshake, Link2, Loader2, ShieldAlert, Wallet } from "lucide-react";
import { toast } from "react-hot-toast";

import { API_BASE } from "@/config/api";
import { useAuth } from "@/context/AuthContext";

interface PartnerPlan {
    task: string;
    title: string;
    status: string;
}

interface PartnerPlaybook {
    task: string;
    title: string;
    path: string;
    absolute_path: string;
    published: boolean;
}

interface PartnerIntegration {
    partner_name: string;
    segment: string;
    owner: string;
    region_scope: string;
    mou_status: string;
    sandbox_access_status: string;
    production_access_status: string;
    api_access_status: string;
    credential_status: string;
    sla_status: string;
    escalation_contact: string | null;
    next_milestone: string;
    status: string;
    last_checked_at: string | null;
}

interface PartnerData {
    summary: {
        tracked: number;
        live: number;
        at_risk: number;
        mou_signed: number;
        api_ready: number;
    };
    integration_plans: PartnerPlan[];
    playbooks: PartnerPlaybook[];
    integrations: PartnerIntegration[];
}

export default function PartnersPage() {
    const { user } = useAuth();
    const [data, setData] = useState<PartnerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({
        partner_name: "Meta Scam Advisory Bridge",
        segment: "TELECOM",
        owner: "Partner Success Desk",
        region_scope: "INDIA",
        mou_status: "PROPOSAL_SENT",
        sandbox_access_status: "REQUESTED",
        production_access_status: "PLANNED",
        api_access_status: "PENDING",
        credential_status: "NOT_ISSUED",
        sla_status: "IN_NEGOTIATION",
        escalation_contact: "partner-bridge@drishyam.ai",
        next_milestone: "Finalize sandbox webhook and escalation contact exchange",
        status: "ON_TRACK",
    });

    const headers = user?.token
        ? {
              Authorization: `Bearer ${user.token}`,
              "Content-Type": "application/json",
          }
        : undefined;

    const loadPartners = async () => {
        if (!headers) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/program-office/partners`, {
                headers: { Authorization: headers.Authorization },
            });
            if (!res.ok) {
                throw new Error("Failed to fetch partner execution status.");
            }
            setData((await res.json()) as PartnerData);
        } catch (error) {
            console.error(error);
            toast.error("Unable to load partner execution workspace.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadPartners();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.token]);

    const submitPartner = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!headers) return;

        const res = await fetch(`${API_BASE}/program-office/partners`, {
            method: "POST",
            headers,
            body: JSON.stringify(form),
        });

        if (!res.ok) {
            const payload = await res.json().catch(() => null);
            toast.error(payload?.detail || "Partner status save failed.");
            return;
        }

        toast.success("Partner status saved.");
        await loadPartners();
    };

    const advancePartner = async (partner: PartnerIntegration) => {
        if (!headers) return;

        const nextApiStatus = partner.api_access_status === "PENDING" ? "SANDBOX_ACTIVE" : "ACTIVE";
        const nextStatus = partner.status === "AT_RISK" ? "ON_TRACK" : partner.api_access_status === "SANDBOX_ACTIVE" ? "LIVE" : "ON_TRACK";

        const res = await fetch(`${API_BASE}/program-office/partners/${encodeURIComponent(partner.partner_name)}/status`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                sandbox_access_status: "READY",
                api_access_status: nextApiStatus,
                credential_status: "ISSUED",
                status: nextStatus,
                note: "Advanced from partner execution console.",
            }),
        });

        if (!res.ok) {
            const payload = await res.json().catch(() => null);
            toast.error(payload?.detail || "Partner update failed.");
            return;
        }

        toast.success(`${partner.partner_name} updated.`);
        await loadPartners();
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-indblue" size={32} />
            </div>
        );
    }

    if (!data) {
        return <div className="text-silver">Partner execution data is unavailable right now.</div>;
    }

    return (
        <div className="space-y-6 max-w-7xl">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-indblue tracking-tight underline decoration-indblue decoration-4 underline-offset-8">
                        Partner Execution Control
                    </h2>
                    <p className="text-silver mt-4 italic font-medium">
                        Live MoU, sandbox, API, and escalation tracking for the partner rollout lane.
                    </p>
                </div>
                <div className="bg-indblue text-white p-4 rounded-2xl shadow-xl min-w-[260px]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Tracked Integrations</p>
                    <p className="text-2xl font-black mt-2">{data.summary.tracked}</p>
                    <p className="text-xs text-white/70 mt-2">{data.summary.mou_signed} signed MoUs and {data.summary.api_ready} API lanes ready.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <Handshake size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Live</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">{data.summary.live}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <Link2 size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">API Ready</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">{data.summary.api_ready}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <Wallet size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">MoU Signed</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">{data.summary.mou_signed}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <ShieldAlert size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">At Risk</p>
                    </div>
                    <p className="text-3xl font-black text-redalert mt-3">{data.summary.at_risk}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-8 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <Handshake className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Partner Status Board</h3>
                        </div>
                        <div className="space-y-4">
                            {data.integrations.map((partner) => (
                                <div key={partner.partner_name} className="p-5 rounded-2xl bg-boxbg border border-silver/10">
                                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-base font-bold text-indblue">{partner.partner_name}</p>
                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${partner.status === "LIVE" ? "bg-indgreen/10 text-indgreen" : partner.status === "AT_RISK" ? "bg-redalert/10 text-redalert" : "bg-saffron/10 text-saffron"}`}>
                                                    {partner.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-silver">{partner.segment} · {partner.region_scope} · Owner: {partner.owner}</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 text-xs text-charcoal">
                                                <p><span className="font-bold text-indblue">MoU:</span> {partner.mou_status}</p>
                                                <p><span className="font-bold text-indblue">Sandbox:</span> {partner.sandbox_access_status}</p>
                                                <p><span className="font-bold text-indblue">API:</span> {partner.api_access_status}</p>
                                                <p><span className="font-bold text-indblue">Credentials:</span> {partner.credential_status}</p>
                                                <p><span className="font-bold text-indblue">SLA:</span> {partner.sla_status}</p>
                                                <p><span className="font-bold text-indblue">Prod:</span> {partner.production_access_status}</p>
                                            </div>
                                            <p className="text-xs text-silver">Next milestone: {partner.next_milestone}</p>
                                            <p className="text-xs text-silver">Escalation: {partner.escalation_contact || "Not assigned"}</p>
                                        </div>
                                        <button
                                            onClick={() => void advancePartner(partner)}
                                            className="px-4 py-2 rounded-xl bg-indblue text-white text-sm font-semibold hover:bg-indblue/90 transition-colors"
                                        >
                                            Advance Status
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <Link2 className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Execution Plans and Playbooks</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {data.integration_plans.map((plan) => (
                                <div key={plan.task} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <p className="text-sm font-bold text-indblue">{plan.task}</p>
                                    <p className="text-xs text-charcoal mt-2">{plan.title}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indgreen mt-3">{plan.status}</p>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-3">
                            {data.playbooks.map((playbook) => (
                                <div key={playbook.task + playbook.title} className="p-4 rounded-2xl border border-silver/10 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-bold text-indblue">{playbook.task} · {playbook.title}</p>
                                        <p className="text-xs text-silver mt-1">{playbook.path}</p>
                                    </div>
                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${playbook.published ? "bg-indgreen/10 text-indgreen" : "bg-redalert/10 text-redalert"}`}>
                                        {playbook.published ? "PUBLISHED" : "MISSING"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-4">
                    <div className="bg-charcoal text-white p-8 rounded-3xl shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <ShieldAlert size={22} className="text-saffron" />
                            <h3 className="text-xl font-bold">Track New Partner</h3>
                        </div>
                        <form onSubmit={submitPartner} className="space-y-4">
                            <input
                                value={form.partner_name}
                                onChange={(event) => setForm((current) => ({ ...current, partner_name: event.target.value }))}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/40"
                                placeholder="Partner name"
                            />
                            <input
                                value={form.owner}
                                onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/40"
                                placeholder="Owner"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    value={form.segment}
                                    onChange={(event) => setForm((current) => ({ ...current, segment: event.target.value.toUpperCase() }))}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/40"
                                    placeholder="Segment"
                                />
                                <input
                                    value={form.region_scope}
                                    onChange={(event) => setForm((current) => ({ ...current, region_scope: event.target.value.toUpperCase() }))}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/40"
                                    placeholder="Region"
                                />
                            </div>
                            <textarea
                                value={form.next_milestone}
                                onChange={(event) => setForm((current) => ({ ...current, next_milestone: event.target.value }))}
                                className="w-full min-h-[120px] px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/40"
                                placeholder="Next milestone"
                            />
                            <button
                                type="submit"
                                className="w-full px-4 py-3 rounded-xl bg-saffron text-white font-semibold hover:bg-saffron/90 transition-colors"
                            >
                                Save Partner Status
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
