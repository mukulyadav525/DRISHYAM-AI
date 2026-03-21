"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Loader2, Shield, ShieldAlert, Smartphone, UserCheck } from "lucide-react";
import { toast } from "react-hot-toast";

import { API_BASE } from "@/config/api";
import { useAuth } from "@/context/AuthContext";

interface PolicyRow {
    policy_id: string;
    name: string;
    role_scope: string;
    resource_scope: string;
    action_scope: string;
}

interface SessionRow {
    session_id: string;
    username: string | null;
    role: string | null;
    device_label: string;
    device_type: string;
    network_zone: string | null;
    auth_stage: string;
    risk_level: string;
    status: string;
    is_current: boolean;
    last_seen_at: string | null;
}

interface ApprovalRow {
    approval_id: string;
    action_type: string;
    resource: string;
    risk_level: string;
    justification: string;
    status: string;
    requested_by: string | null;
    approver: string | null;
    expires_at: string | null;
}

interface AnomalyRow {
    id: string;
    severity: string;
    title: string;
    description: string;
    evidence_count: number;
    status: string;
}

interface ControlCenterData {
    access: {
        summary: { policies: number; roles_covered: string[]; resources_covered: string[] };
        policies: PolicyRow[];
    };
    sessions: {
        summary: { total: number; active: number; high_risk: number; mfa_verified: number };
        current_session_id: string | null;
        sessions: SessionRow[];
    };
    approvals: {
        summary: { total: number; pending: number; approved: number; rejected: number };
        approvals: ApprovalRow[];
    };
    anomalies: {
        summary: { open: number; critical: number; high: number };
        anomalies: AnomalyRow[];
    };
}

interface AccessDecision {
    allowed: boolean;
    reason: string;
    request: {
        action: string;
        resource: string;
        segment: string;
        region: string;
        sensitivity: string;
    };
    policy: PolicyRow | null;
}

export default function SecurityPage() {
    const { user } = useAuth();
    const [data, setData] = useState<ControlCenterData | null>(null);
    const [loading, setLoading] = useState(true);
    const [decision, setDecision] = useState<AccessDecision | null>(null);
    const [approvalForm, setApprovalForm] = useState({
        action_type: "BLOCK_IMEI",
        resource: "National IMEI block request",
        resource_domain: "security",
        justification: "Need privileged sign-off to execute a simulated national block action.",
        risk_level: "HIGH",
    });
    const [abacForm, setAbacForm] = useState({
        action: "WRITE",
        resource: "partner_registry",
        segment: user?.role === "bank" ? "BANK" : user?.role === "telecom" ? "TELECOM" : "B2G",
        region: "INDIA",
        sensitivity: "HIGH",
    });

    const headers = user?.token
        ? {
              Authorization: `Bearer ${user.token}`,
              "Content-Type": "application/json",
          }
        : undefined;

    const loadControlCenter = async () => {
        if (!headers) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/security/control-center`, {
                headers: { Authorization: headers.Authorization },
            });
            if (!res.ok) {
                throw new Error("Failed to load security control center.");
            }
            setData((await res.json()) as ControlCenterData);
        } catch (error) {
            console.error(error);
            toast.error("Unable to load security controls.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadControlCenter();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.token]);

    const evaluatePolicy = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!headers) return;

        const res = await fetch(`${API_BASE}/security/agency-access/evaluate`, {
            method: "POST",
            headers,
            body: JSON.stringify(abacForm),
        });

        if (!res.ok) {
            toast.error("Policy evaluation failed.");
            return;
        }

        setDecision((await res.json()) as AccessDecision);
        toast.success("Policy evaluation completed.");
    };

    const requestApproval = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!headers) return;

        const res = await fetch(`${API_BASE}/security/approvals`, {
            method: "POST",
            headers,
            body: JSON.stringify(approvalForm),
        });

        if (!res.ok) {
            const payload = await res.json().catch(() => null);
            toast.error(payload?.detail || "Approval request failed.");
            return;
        }

        toast.success("Approval request submitted.");
        await loadControlCenter();
    };

    const decideApproval = async (approvalId: string, status: "APPROVED" | "REJECTED") => {
        if (!headers) return;

        const res = await fetch(`${API_BASE}/security/approvals/${approvalId}/decision`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                status,
                note: `Decision captured from security control center as ${status}.`,
            }),
        });

        if (!res.ok) {
            const payload = await res.json().catch(() => null);
            toast.error(payload?.detail || "Approval decision failed.");
            return;
        }

        toast.success(`Approval ${status.toLowerCase()}.`);
        await loadControlCenter();
    };

    const revokeSession = async (sessionId: string) => {
        if (!headers) return;

        const res = await fetch(`${API_BASE}/security/sessions/${sessionId}/revoke`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                reason: "Revoked from security control center.",
            }),
        });

        if (!res.ok) {
            const payload = await res.json().catch(() => null);
            toast.error(payload?.detail || "Session revoke failed.");
            return;
        }

        toast.success("Session revoked.");
        await loadControlCenter();
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-indblue" size={32} />
            </div>
        );
    }

    if (!data) {
        return <div className="text-silver">Security control center is unavailable right now.</div>;
    }

    return (
        <div className="space-y-6 max-w-7xl">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-indblue tracking-tight underline decoration-indblue decoration-4 underline-offset-8">
                        Security Control Center
                    </h2>
                    <p className="text-silver mt-4 italic font-medium">
                        Agency ABAC, privileged session inventory, approval workflows, and anomaly review in one place.
                    </p>
                </div>
                <div className="bg-charcoal text-white p-4 rounded-2xl shadow-xl min-w-[260px]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Open Anomalies</p>
                    <p className="text-2xl font-black mt-2">{data.anomalies.summary.open}</p>
                    <p className="text-xs text-white/60 mt-2">{data.sessions.summary.active} active sessions across the current security scope.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <Shield size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Policies</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">{data.access.summary.policies}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <Smartphone size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Sessions</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">{data.sessions.summary.active}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <KeyRound size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Pending Approvals</p>
                    </div>
                    <p className="text-3xl font-black text-saffron mt-3">{data.approvals.summary.pending}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <ShieldAlert size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">High Risk Sessions</p>
                    </div>
                    <p className="text-3xl font-black text-redalert mt-3">{data.sessions.summary.high_risk}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <Smartphone className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Privileged Sessions</h3>
                        </div>
                        <div className="space-y-3">
                            {data.sessions.sessions.map((session) => (
                                <div key={session.session_id} className="p-4 rounded-2xl bg-boxbg border border-silver/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-bold text-indblue">{session.username || "Unknown Operator"}</p>
                                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${session.status === "ACTIVE" ? "bg-indgreen/10 text-indgreen" : "bg-redalert/10 text-redalert"}`}>
                                                {session.status}
                                            </span>
                                            {session.is_current ? (
                                                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-saffron/10 text-saffron">CURRENT</span>
                                            ) : null}
                                        </div>
                                        <p className="text-xs text-silver mt-1">{session.role} · {session.device_label} · {session.auth_stage}</p>
                                        <p className="text-xs text-charcoal mt-2">Risk {session.risk_level} · Zone {session.network_zone || "Unknown"} · Last seen {session.last_seen_at ? new Date(session.last_seen_at).toLocaleString() : "N/A"}</p>
                                    </div>
                                    <button
                                        onClick={() => void revokeSession(session.session_id)}
                                        disabled={session.status !== "ACTIVE"}
                                        className="px-4 py-2 rounded-xl bg-redalert/10 text-redalert text-sm font-semibold disabled:opacity-50"
                                    >
                                        Revoke Session
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <KeyRound className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Approval Queue</h3>
                        </div>
                        <div className="space-y-3">
                            {data.approvals.approvals.map((approval) => (
                                <div key={approval.approval_id} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-bold text-indblue">{approval.approval_id} · {approval.action_type}</p>
                                            <p className="text-xs text-silver mt-1">{approval.resource}</p>
                                            <p className="text-xs text-charcoal mt-2">{approval.justification}</p>
                                            <p className="text-xs text-silver mt-2">Requested by {approval.requested_by || "Unknown"} · Risk {approval.risk_level}</p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${approval.status === "PENDING" ? "bg-saffron/10 text-saffron" : approval.status === "REJECTED" ? "bg-redalert/10 text-redalert" : "bg-indgreen/10 text-indgreen"}`}>
                                                {approval.status}
                                            </span>
                                            {user?.role === "admin" && approval.status === "PENDING" ? (
                                                <>
                                                    <button
                                                        onClick={() => void decideApproval(approval.approval_id, "APPROVED")}
                                                        className="px-3 py-1.5 rounded-lg bg-indgreen/10 text-indgreen text-xs font-semibold"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => void decideApproval(approval.approval_id, "REJECTED")}
                                                        className="px-3 py-1.5 rounded-lg bg-redalert/10 text-redalert text-xs font-semibold"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-5 space-y-6">
                    <div className="bg-charcoal text-white p-8 rounded-3xl shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <UserCheck size={22} className="text-saffron" />
                            <h3 className="text-xl font-bold">Evaluate Agency Access</h3>
                        </div>
                        <form onSubmit={evaluatePolicy} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    value={abacForm.action}
                                    onChange={(event) => setAbacForm((current) => ({ ...current, action: event.target.value.toUpperCase() }))}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white"
                                    placeholder="Action"
                                />
                                <input
                                    value={abacForm.resource}
                                    onChange={(event) => setAbacForm((current) => ({ ...current, resource: event.target.value }))}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white"
                                    placeholder="Resource"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <input
                                    value={abacForm.segment}
                                    onChange={(event) => setAbacForm((current) => ({ ...current, segment: event.target.value.toUpperCase() }))}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white"
                                    placeholder="Segment"
                                />
                                <input
                                    value={abacForm.region}
                                    onChange={(event) => setAbacForm((current) => ({ ...current, region: event.target.value.toUpperCase() }))}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white"
                                    placeholder="Region"
                                />
                                <input
                                    value={abacForm.sensitivity}
                                    onChange={(event) => setAbacForm((current) => ({ ...current, sensitivity: event.target.value.toUpperCase() }))}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white"
                                    placeholder="Sensitivity"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full px-4 py-3 rounded-xl bg-saffron text-white font-semibold hover:bg-saffron/90 transition-colors"
                            >
                                Evaluate Access
                            </button>
                        </form>
                        {decision ? (
                            <div className={`mt-5 p-4 rounded-2xl border ${decision.allowed ? "border-indgreen/30 bg-indgreen/10" : "border-redalert/30 bg-redalert/10"}`}>
                                <p className={`text-sm font-bold ${decision.allowed ? "text-indgreen" : "text-redalert"}`}>
                                    {decision.allowed ? "Allowed" : "Denied"}
                                </p>
                                <p className="text-xs text-white/80 mt-2">{decision.reason}</p>
                                <p className="text-[10px] uppercase tracking-widest text-white/60 mt-3">
                                    {decision.request.action} · {decision.request.resource} · {decision.request.segment}
                                </p>
                            </div>
                        ) : null}
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <KeyRound className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Request Approval</h3>
                        </div>
                        <form onSubmit={requestApproval} className="space-y-4">
                            <input
                                value={approvalForm.action_type}
                                onChange={(event) => setApprovalForm((current) => ({ ...current, action_type: event.target.value.toUpperCase() }))}
                                className="w-full px-4 py-3 rounded-xl border border-silver/20"
                                placeholder="Action type"
                            />
                            <input
                                value={approvalForm.resource}
                                onChange={(event) => setApprovalForm((current) => ({ ...current, resource: event.target.value }))}
                                className="w-full px-4 py-3 rounded-xl border border-silver/20"
                                placeholder="Resource"
                            />
                            <textarea
                                value={approvalForm.justification}
                                onChange={(event) => setApprovalForm((current) => ({ ...current, justification: event.target.value }))}
                                className="w-full min-h-[110px] px-4 py-3 rounded-xl border border-silver/20"
                                placeholder="Justification"
                            />
                            <button
                                type="submit"
                                className="w-full px-4 py-3 rounded-xl bg-indblue text-white font-semibold hover:bg-indblue/90 transition-colors"
                            >
                                Submit Approval Request
                            </button>
                        </form>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <ShieldAlert className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Active Anomalies</h3>
                        </div>
                        <div className="space-y-3">
                            {data.anomalies.anomalies.map((anomaly) => (
                                <div key={anomaly.id} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-bold text-indblue">{anomaly.title}</p>
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${anomaly.severity === "HIGH" ? "bg-redalert/10 text-redalert" : "bg-saffron/10 text-saffron"}`}>
                                            {anomaly.severity}
                                        </span>
                                    </div>
                                    <p className="text-xs text-silver mt-2">{anomaly.description}</p>
                                    <p className="text-[10px] uppercase tracking-widest text-charcoal mt-3">{anomaly.status} · Evidence {anomaly.evidence_count}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
