"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Headphones, Loader2, MessageSquare, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "react-hot-toast";

import { API_BASE } from "@/config/api";
import { useAuth } from "@/context/AuthContext";

interface SupportChannel {
    name: string;
    channel: string;
    availability: string;
    owner: string;
}

interface SupportQueue {
    task?: string;
    name: string;
    sla_min: number;
}

interface IncidentClass {
    id: string;
    title: string;
    sla_min: number;
    queue: string;
}

interface SupportManual {
    task: string;
    title: string;
    path: string;
    absolute_path: string;
    published: boolean;
}

interface SupportTicket {
    ticket_id: string;
    channel: string;
    stakeholder_type: string;
    severity: string;
    incident_classification: string;
    queue_name: string;
    status: string;
    owner: string | null;
    resolution_eta_min: number;
    summary: string;
}

interface SupportData {
    channels: SupportChannel[];
    sops: Array<{ task: string; stakeholder: string; path: string; absolute_path: string }>;
    escalation_queues: SupportQueue[];
    incident_classification: IncidentClass[];
    manuals: SupportManual[];
    feedback_capture: { task: string; stages: string[] };
    bug_triage: { task: string; stages: string[] };
    review_cadence: Array<{ task: string; name: string; cadence: string }>;
    coverage: {
        open_tickets: number;
        resolved_tickets: number;
        queue_mix: Array<{ label: string; count: number }>;
        severity_mix: Array<{ label: string; count: number }>;
    };
    tickets: SupportTicket[];
}

export default function OpsPage() {
    const { user } = useAuth();
    const [data, setData] = useState<SupportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [ticketForm, setTicketForm] = useState({
        channel: "DASHBOARD",
        stakeholder_type: "government",
        severity: "HIGH",
        incident_classification: "SEV-2",
        summary: "Partner needs onboarding support for new district launch.",
    });

    const headers = user?.token
        ? {
              Authorization: `Bearer ${user.token}`,
              "Content-Type": "application/json",
          }
        : undefined;

    const loadSupport = async () => {
        if (!headers) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/program-office/support`, { headers: { Authorization: headers.Authorization } });
            if (!res.ok) {
                throw new Error("Failed to load support summary.");
            }
            setData((await res.json()) as SupportData);
        } catch (error) {
            console.error(error);
            toast.error("Unable to load support operations.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadSupport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.token]);

    const createTicket = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!headers) return;

        const res = await fetch(`${API_BASE}/program-office/support/tickets`, {
            method: "POST",
            headers,
            body: JSON.stringify(ticketForm),
        });

        if (!res.ok) {
            toast.error("Support ticket creation failed.");
            return;
        }

        toast.success("Support ticket created.");
        await loadSupport();
    };

    const updateTicket = async (ticketId: string, status: string) => {
        if (!headers) return;

        const res = await fetch(`${API_BASE}/program-office/support/tickets/${ticketId}/status`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                status,
                note: `Updated from operations console to ${status}.`,
            }),
        });

        if (!res.ok) {
            toast.error("Ticket update failed.");
            return;
        }

        toast.success(`Ticket ${ticketId} updated.`);
        await loadSupport();
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-indblue" size={32} />
            </div>
        );
    }

    if (!data) {
        return <div className="text-silver">Support operations data is unavailable right now.</div>;
    }

    return (
        <div className="space-y-6 max-w-7xl">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-indblue tracking-tight underline decoration-indblue decoration-4 underline-offset-8">
                        Operations and Support
                    </h2>
                    <p className="text-silver mt-4 italic font-medium">
                        Phase 37 readiness layer covering support channels, SOPs, queues, manuals, and incident workflows.
                    </p>
                </div>
                <div className="bg-charcoal text-white p-4 rounded-2xl shadow-xl min-w-[240px]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Open Tickets</p>
                    <p className="text-2xl font-black mt-2">{data.coverage.open_tickets}</p>
                    <p className="text-xs text-white/60 mt-2">Resolved {data.coverage.resolved_tickets} cases in the current support window.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <Headphones size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Channels</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">{data.channels.length}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <AlertTriangle size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Incident Classes</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">{data.incident_classification.length}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <ShieldCheck size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Published Manuals</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">{data.manuals.filter((manual) => manual.published).length}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <Headphones className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Support Channels and Queues</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {data.channels.map((channel) => (
                                <div key={channel.name} className="p-5 rounded-2xl bg-boxbg border border-silver/10">
                                    <p className="text-sm font-bold text-indblue">{channel.name}</p>
                                    <p className="text-xs text-silver mt-1">{channel.channel} · {channel.availability}</p>
                                    <p className="text-xs text-charcoal mt-3">{channel.owner}</p>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-3">
                            {data.escalation_queues.map((queue) => (
                                <div key={queue.name} className="p-4 rounded-2xl border border-silver/10 bg-boxbg flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-bold text-indblue">{queue.name}</p>
                                        <p className="text-xs text-silver mt-1">SLA {queue.sla_min} minutes</p>
                                    </div>
                                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-indblue/10 text-indblue">ACTIVE</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <MessageSquare className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Live Support Tickets</h3>
                        </div>
                        <div className="space-y-4 mb-8">
                            {data.tickets.map((ticket) => (
                                <div key={ticket.ticket_id} className="p-5 rounded-2xl bg-boxbg border border-silver/10">
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-bold text-indblue">{ticket.ticket_id}</p>
                                            <p className="text-xs text-silver mt-1">{ticket.stakeholder_type} · {ticket.channel} · {ticket.queue_name}</p>
                                            <p className="text-sm text-charcoal mt-3">{ticket.summary}</p>
                                        </div>
                                        <div className="flex flex-col items-start md:items-end gap-2">
                                            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-saffron/10 text-saffron">{ticket.status}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => void updateTicket(ticket.ticket_id, "IN_PROGRESS")} className="px-3 py-2 rounded-xl text-[10px] font-bold border border-silver/10 bg-white hover:bg-boxbg">
                                                    In Progress
                                                </button>
                                                <button onClick={() => void updateTicket(ticket.ticket_id, "RESOLVED")} className="px-3 py-2 rounded-xl text-[10px] font-bold bg-indblue text-white hover:bg-indblue/90">
                                                    Resolve
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <form onSubmit={createTicket} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input value={ticketForm.channel} onChange={(e) => setTicketForm((prev) => ({ ...prev, channel: e.target.value }))} className="px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Channel" />
                            <input value={ticketForm.stakeholder_type} onChange={(e) => setTicketForm((prev) => ({ ...prev, stakeholder_type: e.target.value }))} className="px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Stakeholder" />
                            <input value={ticketForm.severity} onChange={(e) => setTicketForm((prev) => ({ ...prev, severity: e.target.value }))} className="px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Severity" />
                            <input value={ticketForm.incident_classification} onChange={(e) => setTicketForm((prev) => ({ ...prev, incident_classification: e.target.value }))} className="px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Incident class" />
                            <input value={ticketForm.summary} onChange={(e) => setTicketForm((prev) => ({ ...prev, summary: e.target.value }))} className="md:col-span-2 px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Summary" />
                            <button type="submit" className="md:col-span-2 px-5 py-3 rounded-2xl bg-indblue text-white font-bold text-sm hover:bg-indblue/90 transition-colors">
                                Open Support Ticket
                            </button>
                        </form>
                    </div>
                </div>

                <div className="xl:col-span-5 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-5">
                            <Wrench className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Incident Classification</h3>
                        </div>
                        <div className="space-y-3">
                            {data.incident_classification.map((item) => (
                                <div key={item.id} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <p className="text-sm font-bold text-indblue">{item.id} · {item.title}</p>
                                    <p className="text-xs text-silver mt-1">SLA {item.sla_min} min · {item.queue}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <h3 className="text-xl font-bold text-indblue mb-5">Manuals and SOPs</h3>
                        <div className="space-y-3">
                            {data.manuals.map((manual) => (
                                <div key={manual.task} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-indblue">{manual.title}</p>
                                            <p className="text-xs text-silver mt-1">{manual.path}</p>
                                        </div>
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${manual.published ? "bg-indgreen/10 text-indgreen" : "bg-redalert/10 text-redalert"}`}>
                                            {manual.published ? "READY" : "MISSING"}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-charcoal text-white p-8 rounded-3xl shadow-2xl">
                        <h3 className="text-xl font-bold mb-5">Feedback and Review Loop</h3>
                        <div className="space-y-4 text-sm">
                            <div>
                                <p className="text-white/50 uppercase text-[10px] font-bold">Feedback capture</p>
                                <p className="mt-2">{data.feedback_capture.stages.join(" -> ")}</p>
                            </div>
                            <div>
                                <p className="text-white/50 uppercase text-[10px] font-bold">Bug triage</p>
                                <p className="mt-2">{data.bug_triage.stages.join(" -> ")}</p>
                            </div>
                            <div>
                                <p className="text-white/50 uppercase text-[10px] font-bold">Review cadence</p>
                                <div className="mt-2 space-y-2">
                                    {data.review_cadence.map((review) => (
                                        <p key={review.name}>{review.name}: {review.cadence}</p>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
