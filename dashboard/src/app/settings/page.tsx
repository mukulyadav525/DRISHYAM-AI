"use client";

import { useEffect, useState } from "react";
import {
    AlertTriangle,
    Clock3,
    Database,
    FileCheck,
    FileText,
    Globe,
    Loader2,
    Lock,
    Scale,
    Shield,
    User,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/config/api";

interface SessionStatus {
    username: string;
    role: string;
    full_name: string | null;
    mfa_required: boolean;
    mfa_verified: boolean;
    expires_at: string | null;
}

interface OperatorProfile {
    username: string;
    phone_number?: string | null;
    email?: string | null;
    full_name: string | null;
    role: string;
    is_active: boolean;
}

interface AuditLogEntry {
    id: number;
    action: string;
    resource?: string | null;
    ip_address?: string | null;
    timestamp: string;
    user_id?: number | null;
    username?: string | null;
    role?: string | null;
    metadata?: Record<string, unknown> | null;
}

interface ConsentSummaryEntry {
    id?: number | null;
    phone_number: string;
    status: string;
    channel?: string | null;
    policy_version: string;
    required_complete: boolean;
    scopes: Record<string, boolean>;
    given_at?: string | null;
    revoked_at?: string | null;
}

interface ConsentSummaryResponse {
    policy_version: string;
    totals: {
        active: number;
        revoked: number;
        required_complete: number;
        simulation_portal: number;
    };
    scope_catalog: {
        id: string;
        label: string;
        required: boolean;
    }[];
    recent: ConsentSummaryEntry[];
}

export default function SettingsPage() {
    const { user } = useAuth();
    const [session, setSession] = useState<SessionStatus | null>(null);
    const [profile, setProfile] = useState<OperatorProfile | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [consentSummary, setConsentSummary] = useState<ConsentSummaryResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user?.token) {
            setIsLoading(false);
            return;
        }

        const controller = new AbortController();

        const fetchSecurityData = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const headers = {
                    "Authorization": `Bearer ${user.token}`,
                };

                const [sessionRes, meRes, logsRes, consentRes] = await Promise.all([
                    fetch(`${API_BASE}/auth/session`, { headers, signal: controller.signal }),
                    fetch(`${API_BASE}/auth/me`, { headers, signal: controller.signal }),
                    fetch(`${API_BASE}/security/audit/logs?limit=10`, { headers, signal: controller.signal }),
                    fetch(`${API_BASE}/privacy/consent/summary?limit=8`, { headers, signal: controller.signal }),
                ]);

                if (!sessionRes.ok) {
                    throw new Error("Failed to load session security status");
                }
                if (!meRes.ok) {
                    throw new Error("Failed to load operator profile");
                }
                if (!logsRes.ok) {
                    throw new Error("Failed to load audit trail");
                }
                if (!consentRes.ok) {
                    throw new Error("Failed to load consent ledger");
                }

                const [sessionData, profileData, logsData, consentData] = await Promise.all([
                    sessionRes.json(),
                    meRes.json(),
                    logsRes.json(),
                    consentRes.json(),
                ]);

                setSession(sessionData);
                setProfile(profileData);
                setAuditLogs(logsData);
                setConsentSummary(consentData);
            } catch (fetchError: any) {
                if (fetchError.name === "AbortError") {
                    return;
                }
                console.error(fetchError);
                setError(fetchError.message || "Unable to load security console");
            } finally {
                setIsLoading(false);
            }
        };

        fetchSecurityData();
        return () => controller.abort();
    }, [user?.token]);

    const totalTrackedActions = auditLogs.length;
    const lastAuditAt = auditLogs[0]?.timestamp;
    const activeConsentCount = consentSummary?.totals.active || 0;
    const completeConsentCount = consentSummary?.totals.required_complete || 0;
    const simulationConsentCount = consentSummary?.totals.simulation_portal || 0;

    return (
        <div className="space-y-8 max-w-5xl">
            <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-indblue tracking-tight">System Settings</h2>
                <p className="text-silver mt-1">Manage operator security, audit visibility, and compliance foundations.</p>
            </div>

            {error && (
                <div className="p-4 bg-redalert/10 border border-redalert/20 rounded-2xl flex items-center gap-3">
                    <AlertTriangle className="text-redalert" size={18} />
                    <p className="text-sm font-semibold text-redalert">{error}</p>
                </div>
            )}

            {isLoading ? (
                <div className="min-h-[280px] bg-white rounded-3xl border border-silver/10 flex items-center justify-center">
                    <div className="flex items-center gap-3 text-indblue font-semibold">
                        <Loader2 className="animate-spin" size={22} />
                        Loading security console...
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-white rounded-2xl border border-silver/10 overflow-hidden shadow-sm lg:col-span-2">
                            <div className="p-6 border-b border-boxbg flex items-center gap-3">
                                <User className="text-saffron" size={20} />
                                <h3 className="font-bold text-indblue">Operator Profile</h3>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Full Name</p>
                                    <p className="text-sm font-bold text-charcoal mt-1">{profile?.full_name || session?.full_name || "System Administrator"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Username</p>
                                    <p className="text-sm font-bold text-charcoal mt-1 font-mono">{profile?.username || session?.username || user?.username}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Role</p>
                                    <p className="text-sm font-bold text-charcoal mt-1 uppercase">{profile?.role || session?.role || user?.role}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Account Status</p>
                                    <p className="text-sm font-bold mt-1 text-indgreen">{profile?.is_active ? "ACTIVE" : "DISABLED"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Phone</p>
                                    <p className="text-sm font-bold text-charcoal mt-1">{profile?.phone_number || "Protected / Not shared"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Email</p>
                                    <p className="text-sm font-bold text-charcoal mt-1">{profile?.email || "Protected / Not shared"}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-indblue p-6 rounded-2xl border border-saffron/20 text-white shadow-xl">
                            <div className="flex items-center gap-3 mb-4">
                                <Shield className="text-saffron" size={20} />
                                <h4 className="font-bold text-sm">Session Security</h4>
                            </div>
                            <div className="space-y-3 text-[11px]">
                                <div className="flex justify-between gap-4">
                                    <span className="text-white/60 uppercase font-bold tracking-widest">MFA Required</span>
                                    <span className="font-bold">{session?.mfa_required ? "YES" : "NO"}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-white/60 uppercase font-bold tracking-widest">MFA Verified</span>
                                    <span className={session?.mfa_verified ? "font-bold text-indgreen" : "font-bold text-saffron"}>
                                        {session?.mfa_verified ? "VERIFIED" : "PENDING"}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-white/60 uppercase font-bold tracking-widest">Token Expires</span>
                                    <span className="font-bold text-right">{session?.expires_at ? new Date(session.expires_at).toLocaleString() : "Unknown"}</span>
                                </div>
                            </div>
                            <div className="mt-6 p-4 rounded-xl bg-white/10 border border-white/10">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-saffron">Security Posture</p>
                                <p className="text-xs text-white/80 leading-relaxed mt-2">
                                    Privileged sessions now require second-factor confirmation before operational actions can execute.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white rounded-2xl border border-silver/10 p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <Database className="text-saffron" size={20} />
                                <h4 className="font-bold text-indblue text-sm">Audit Coverage</h4>
                            </div>
                            <p className="text-3xl font-black text-indblue">{totalTrackedActions}</p>
                            <p className="text-[11px] text-silver mt-2">Recent signed audit events loaded into the operator console.</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-silver/10 p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <Clock3 className="text-saffron" size={20} />
                                <h4 className="font-bold text-indblue text-sm">Latest Audit Event</h4>
                            </div>
                            <p className="text-sm font-bold text-charcoal">{lastAuditAt ? new Date(lastAuditAt).toLocaleString() : "No events yet"}</p>
                            <p className="text-[11px] text-silver mt-2">Tracks operational access, MFA completion, downloads, and enforcement actions.</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-silver/10 p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <Globe className="text-saffron" size={20} />
                                <h4 className="font-bold text-indblue text-sm">Node Policy</h4>
                            </div>
                            <p className="text-sm font-bold text-charcoal">India Data Residency</p>
                            <p className="text-[11px] text-silver mt-2">Zero-egress privacy posture and role-aware privileged session control are active.</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-silver/10 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-boxbg flex items-center gap-3">
                            <Shield className="text-saffron" size={20} />
                            <div>
                                <h3 className="font-bold text-indblue">Citizen Consent Ledger</h3>
                                <p className="text-[11px] text-silver mt-1">Live DPDP consent coverage for the simulation and protection workflows.</p>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-boxbg">
                            <div className="bg-boxbg rounded-2xl p-5 border border-silver/5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Active Consents</p>
                                <p className="text-3xl font-black text-indblue mt-3">{activeConsentCount}</p>
                                <p className="text-[11px] text-silver mt-2">Citizens currently covered by an active protection consent ledger.</p>
                            </div>
                            <div className="bg-boxbg rounded-2xl p-5 border border-silver/5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Required Coverage</p>
                                <p className="text-3xl font-black text-indgreen mt-3">{completeConsentCount}</p>
                                <p className="text-[11px] text-silver mt-2">Records that include every required MVP scope for safe handoff and evidence handling.</p>
                            </div>
                            <div className="bg-boxbg rounded-2xl p-5 border border-silver/5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Simulation Portal</p>
                                <p className="text-3xl font-black text-saffron mt-3">{simulationConsentCount}</p>
                                <p className="text-[11px] text-silver mt-2">Current citizen opt-ins sourced through the protected simulation login flow.</p>
                            </div>
                        </div>

                        <div className="p-6 flex flex-wrap gap-2 border-b border-boxbg">
                            {(consentSummary?.scope_catalog || []).map((scope) => (
                                <span
                                    key={scope.id}
                                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                        scope.required
                                            ? "bg-redalert/10 text-redalert"
                                            : "bg-indgreen/10 text-indgreen"
                                    }`}
                                >
                                    {scope.label}
                                </span>
                            ))}
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-indblue/10 text-indblue">
                                Policy {consentSummary?.policy_version || "MVP-2026.03"}
                            </span>
                        </div>

                        <div className="divide-y divide-boxbg">
                            {(consentSummary?.recent || []).length === 0 ? (
                                <div className="p-6 text-sm text-silver">No citizen consent records have been captured yet.</div>
                            ) : (consentSummary?.recent || []).map((entry, index) => (
                                <div key={`${entry.phone_number}-${index}`} className="p-5 grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-4">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Citizen</p>
                                        <p className="text-sm font-bold text-charcoal mt-1">{entry.phone_number}</p>
                                        <p className="text-[11px] text-silver mt-2">{entry.channel || "Unknown channel"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Consent State</p>
                                        <p className={`text-sm font-bold mt-1 ${entry.required_complete ? "text-indgreen" : "text-saffron"}`}>
                                            {entry.status} {entry.required_complete ? " / COMPLETE" : " / PARTIAL"}
                                        </p>
                                        <p className="text-[11px] text-silver mt-2">Policy {entry.policy_version}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Updated</p>
                                        <p className="text-sm font-bold text-charcoal mt-1">
                                            {new Date(entry.revoked_at || entry.given_at || Date.now()).toLocaleString()}
                                        </p>
                                        <p className="text-[11px] text-silver mt-2">
                                            {entry.revoked_at ? "Revoked record" : "Protection consent active"}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-silver/10 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-boxbg flex items-center gap-3">
                            <Lock className="text-saffron" size={20} />
                            <div>
                                <h3 className="font-bold text-indblue">Recent Audit Trail</h3>
                                <p className="text-[11px] text-silver mt-1">Latest privileged actions captured from the live backend.</p>
                            </div>
                        </div>

                        <div className="divide-y divide-boxbg">
                            {auditLogs.length === 0 ? (
                                <div className="p-6 text-sm text-silver">No audit events available for this operator yet.</div>
                            ) : auditLogs.map((log) => (
                                <div key={log.id} className="p-5 grid grid-cols-1 md:grid-cols-[1.1fr_1fr_1fr] gap-4">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Action</p>
                                        <p className="text-sm font-bold text-indblue mt-1">{log.action.replaceAll("_", " ")}</p>
                                        <p className="text-[11px] text-silver mt-2">{log.resource || "System resource"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Actor</p>
                                        <p className="text-sm font-bold text-charcoal mt-1">{log.username || "System"}</p>
                                        <p className="text-[11px] text-silver mt-2 uppercase">{log.role || "SERVICE"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Timestamp</p>
                                        <p className="text-sm font-bold text-charcoal mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                                        <p className="text-[11px] text-silver mt-2">{log.ip_address || "Local / internal"}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-3 bg-redalert/10 rounded-2xl text-redalert">
                                <Scale size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-indblue">Legal & Compliance Foundations</h3>
                                <p className="text-xs text-silver mt-1">Operational legal posture for evidence, privacy, and court-readiness.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="p-6 bg-boxbg rounded-2xl border border-silver/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-indblue text-sm flex items-center gap-2">
                                        <FileCheck size={16} className="text-indgreen" />
                                        Section 65B Certification
                                    </h4>
                                    <span className="text-[10px] font-bold text-indgreen bg-indgreen/10 px-2 py-0.5 rounded">ACTIVE</span>
                                </div>
                                <p className="text-[11px] text-charcoal leading-relaxed">
                                    Generated evidence packets retain cryptographic provenance and court-facing metadata for downstream FIR and restitution workflows.
                                </p>
                            </div>

                            <div className="p-6 bg-boxbg rounded-2xl border border-silver/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-indblue text-sm flex items-center gap-2">
                                        <Lock size={16} className="text-saffron" />
                                        DPDP Act Compliance
                                    </h4>
                                    <span className="text-[10px] font-bold text-indblue bg-indblue/10 px-2 py-0.5 rounded">ENFORCED</span>
                                </div>
                                <p className="text-[11px] text-charcoal leading-relaxed">
                                    Operator access remains role-scoped, privileged actions are auditable, and session controls now enforce second-factor verification.
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 flex flex-col md:flex-row gap-4">
                            <button className="flex-1 p-4 bg-indblue text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indblue/90 transition-colors">
                                <Scale size={18} />
                                View Control Posture
                            </button>
                            <button className="flex-1 p-4 bg-white border border-indblue text-indblue rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indblue/5 transition-colors">
                                <FileText size={18} />
                                Review Evidence Policy
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
