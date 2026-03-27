"use client";

import { useEffect, useState } from "react";
import {
    BarChart3,
    CheckCircle2,
    Cpu,
    Download,
    Globe,
    Loader2,
    Map,
    MessageSquare,
    Rocket,
    Save,
    ShieldCheck,
    Target,
    Users,
} from "lucide-react";
import { toast } from "react-hot-toast";

import { API_BASE } from "@/config/api";
import { useActions } from "@/hooks/useActions";
import { useAuth } from "@/context/AuthContext";

interface IntegrationStatus {
    provider: string;
    mode: string;
    configured: boolean;
    capabilities: string[];
}

interface PilotProgramData {
    pilot_id: string;
    name: string;
    geography: string;
    telecom_partner: string;
    bank_partners: string[];
    agencies: string[];
    languages: string[];
    scam_categories: string[];
    training_status: Record<string, { target: number; completed: number }>;
    communications: {
        status?: string;
        channels?: string[];
        message?: string;
        launched_at?: string | null;
    };
    launch_status: string;
    updated_at?: string | null;
}

interface ReadinessItem {
    label: string;
    complete: boolean;
    detail: string;
}

interface PilotReadiness {
    completed: number;
    total: number;
    progress_percent: number;
    checklist: ReadinessItem[];
}

interface FeedbackEntry {
    id: number;
    stakeholder_type: string;
    source_agency?: string | null;
    sentiment: string;
    message: string;
    status: string;
    created_at?: string | null;
}

interface OutcomeReport {
    pilot_id: string;
    name: string;
    geography: string;
    launch_status: string;
    metrics?: Record<string, number | string>;
    feedback_summary?: {
        total: number;
        positive: number;
        neutral: number;
        negative: number;
        open_issues: number;
    };
    recommended_partnerships: string[];
    published_at?: string | null;
}

const initialPilotForm = {
    name: "",
    geography: "",
    telecom_partner: "",
    bank_partners: "",
    agencies: "",
    languages: "",
    scam_categories: "",
};

type PilotFormField = keyof typeof initialPilotForm;

const ROADMAP = [
    { id: 1, title: "Wave 1: Northern Hubs", states: ["Delhi", "NCR", "Haryana"], status: "OPERATIONAL", color: "bg-indgreen" },
    { id: 2, title: "Wave 2: Financial Corridors", states: ["Mumbai", "Bengaluru", "Hyderabad"], status: "ACTIVE", color: "bg-indblue" },
    { id: 3, title: "Wave 3: Border Regions", states: ["Punjab", "Rajasthan", "West Bengal"], status: "PENDING", color: "bg-saffron" },
];

function listToText(values: string[] | undefined) {
    return (values || []).join(", ");
}

function textToList(value: string) {
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

export default function LaunchPage() {
    const { performAction, downloadSimulatedFile } = useActions();
    const { user } = useAuth();
    const [selectedWave, setSelectedWave] = useState(2);
    const [isDeploying, setIsDeploying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [integrationReadiness, setIntegrationReadiness] = useState<{ telecom?: IntegrationStatus; bank?: IntegrationStatus }>({});
    const [pilot, setPilot] = useState<PilotProgramData | null>(null);
    const [readiness, setReadiness] = useState<PilotReadiness | null>(null);
    const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
    const [outcome, setOutcome] = useState<OutcomeReport | null>(null);
    const [pilotForm, setPilotForm] = useState(initialPilotForm);
    const [communicationsMessage, setCommunicationsMessage] = useState(
        "DRISHYAM pilot launch advisory: the protected anti-scam grid is now active for selected agencies and citizens."
    );
    const [feedbackDraft, setFeedbackDraft] = useState({
        stakeholder_type: "analyst",
        source_agency: "Pilot Ops Cell",
        sentiment: "POSITIVE",
        message: "",
    });

    const authHeaders = user?.token
        ? {
              "Content-Type": "application/json",
              Authorization: `Bearer ${user.token}`,
          }
        : undefined;

    const fetchPilotData = async () => {
        if (!authHeaders) {
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            const [telecomRes, bankRes, pilotRes, readinessRes, feedbackRes, outcomeRes] = await Promise.all([
                fetch(`${API_BASE}/telecom/sandbox/status`, { headers: authHeaders }),
                fetch(`${API_BASE}/upi/integration/status`, { headers: authHeaders }),
                fetch(`${API_BASE}/pilot/program/active`, { headers: authHeaders }),
                fetch(`${API_BASE}/pilot/readiness`, { headers: authHeaders }),
                fetch(`${API_BASE}/pilot/feedback?limit=6`, { headers: authHeaders }),
                fetch(`${API_BASE}/pilot/outcome-report`, { headers: authHeaders }),
            ]);

            const telecom = telecomRes.ok ? await telecomRes.json() : undefined;
            const bank = bankRes.ok ? await bankRes.json() : undefined;
            const pilotData = pilotRes.ok ? await pilotRes.json() : null;
            const readinessData = readinessRes.ok ? await readinessRes.json() : null;
            const feedbackData = feedbackRes.ok ? await feedbackRes.json() : { feedback: [] };
            const outcomeData = outcomeRes.ok ? await outcomeRes.json() : null;

            setIntegrationReadiness({ telecom, bank });
            setPilot(pilotData);
            setReadiness(readinessData?.readiness || null);
            setFeedback(Array.isArray(feedbackData?.feedback) ? feedbackData.feedback : []);
            setOutcome(outcomeData);

            if (pilotData) {
                setPilotForm({
                    name: pilotData.name || "",
                    geography: pilotData.geography || "",
                    telecom_partner: pilotData.telecom_partner || "",
                    bank_partners: listToText(pilotData.bank_partners),
                    agencies: listToText(pilotData.agencies),
                    languages: listToText(pilotData.languages),
                    scam_categories: listToText(pilotData.scam_categories),
                });
                setCommunicationsMessage(
                    pilotData.communications?.message ||
                        `DRISHYAM pilot launch advisory for ${pilotData.geography}: stay alert for KYC, UPI, and impersonation scams.`
                );
            }
        } catch (error) {
            console.error("Launch control fetch failed:", error);
            toast.error("Unable to load pilot control data.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void fetchPilotData();
    }, [user?.token]);

    const savePilotConfig = async () => {
        if (!authHeaders) {
            toast.error("Login is required to update the pilot.");
            return;
        }

        const res = await fetch(`${API_BASE}/pilot/program/active`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
                name: pilotForm.name,
                geography: pilotForm.geography,
                telecom_partner: pilotForm.telecom_partner,
                bank_partners: textToList(pilotForm.bank_partners),
                agencies: textToList(pilotForm.agencies),
                languages: textToList(pilotForm.languages),
                scam_categories: textToList(pilotForm.scam_categories),
                dashboard_scope: { pilot_only: true },
                success_metrics: {},
            }),
        });

        if (!res.ok) {
            toast.error("Pilot configuration update failed.");
            return;
        }

        toast.success("Pilot configuration saved.");
        await fetchPilotData();
    };

    const markTrainingReady = async (stakeholderType: string) => {
        if (!authHeaders || !pilot?.training_status?.[stakeholderType]) {
            return;
        }

        const current = pilot.training_status[stakeholderType];
        const res = await fetch(`${API_BASE}/pilot/training/update`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
                stakeholder_type: stakeholderType,
                completed: current.target,
                target: current.target,
            }),
        });

        if (!res.ok) {
            toast.error("Training update failed.");
            return;
        }

        toast.success(`${stakeholderType.replace("_", " ")} marked ready.`);
        await fetchPilotData();
    };

    const launchCommunications = async () => {
        if (!authHeaders) {
            return;
        }

        const res = await fetch(`${API_BASE}/pilot/communications/launch`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
                channels: ["SMS", "IVR", "DASHBOARD", "PRESS_NOTE"],
                message: communicationsMessage,
            }),
        });

        if (!res.ok) {
            toast.error("Pilot communications launch failed.");
            return;
        }

        toast.success("Pilot communications launched.");
        await fetchPilotData();
    };

    const captureMetricsSnapshot = async () => {
        if (!authHeaders) {
            return;
        }

        const res = await fetch(`${API_BASE}/pilot/metrics/snapshot`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
                prevented_loss_inr: 3800000,
                avg_response_min: 2.8,
                alert_delivery_pct: 96.4,
                citizen_coverage_pct: 54.0,
                satisfaction_score: 4.4,
            }),
        });

        if (!res.ok) {
            toast.error("Pilot metrics capture failed.");
            return;
        }

        toast.success("Pilot metrics snapshot recorded.");
        await fetchPilotData();
    };

    const publishOutcomeReport = async () => {
        if (!authHeaders) {
            return;
        }

        const res = await fetch(`${API_BASE}/pilot/outcome-report/publish`, {
            method: "POST",
            headers: authHeaders,
        });

        if (!res.ok) {
            toast.error("Outcome report publish failed.");
            return;
        }

        toast.success("Pilot outcome report published.");
        await fetchPilotData();
    };

    const submitFeedback = async () => {
        if (!authHeaders || !feedbackDraft.message.trim()) {
            toast.error("Feedback message is required.");
            return;
        }

        const res = await fetch(`${API_BASE}/pilot/feedback`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(feedbackDraft),
        });

        if (!res.ok) {
            toast.error("Feedback submission failed.");
            return;
        }

        toast.success("Pilot feedback recorded.");
        setFeedbackDraft((current) => ({ ...current, message: "" }));
        await fetchPilotData();
    };

    const handleDeploy = async () => {
        setIsDeploying(true);
        const toastId = toast.loading("Initializing secure handshake with pilot nodes...");
        await performAction("INITIATE_PILOT");
        setTimeout(() => toast.loading("Authorizing pilot agencies and support channels...", { id: toastId }), 1000);
        setTimeout(() => toast.success("Pilot launch control activated.", { id: toastId }), 2200);
        setIsDeploying(false);
    };

    if (isLoading) {
        return (
            <div className="min-h-[380px] flex items-center justify-center">
                <div className="flex items-center gap-3 text-indblue font-semibold">
                    <Loader2 className="animate-spin" size={24} />
                    Loading pilot control center...
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-indblue tracking-tight underline decoration-indgreen decoration-4 underline-offset-8">
                        Launch Control Center
                    </h2>
                    <p className="text-silver mt-4 italic font-medium">
                        Phase 34 pilot launch operations are now driven by live pilot configuration, readiness, and outcome reporting.
                    </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-silver/10 shadow-sm flex items-center gap-3">
                    <Rocket className="text-indgreen animate-bounce" size={20} />
                    <div>
                        <p className="text-[10px] font-bold text-indblue uppercase leading-none">Pilot Progress</p>
                        <p className="text-sm font-black text-indgreen">{readiness?.progress_percent || 0}% Ready</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex justify-between items-center mb-10">
                            <div className="flex items-center gap-3">
                                <Map className="text-indblue" size={24} />
                                <h3 className="text-xl font-bold text-indblue">National Rollout Roadmap</h3>
                            </div>
                            <div className="flex gap-1 bg-boxbg p-1 rounded-xl border border-silver/10">
                                {[1, 2, 3].map((wave) => (
                                    <button
                                        key={wave}
                                        onClick={() => setSelectedWave(wave)}
                                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                                            selectedWave === wave ? "bg-indblue text-white shadow-md" : "text-silver"
                                        }`}
                                    >
                                        WAVE {wave}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="relative space-y-10">
                            <div className="absolute top-0 left-6 w-0.5 h-full bg-silver/10 -z-0" />
                            {ROADMAP.map((wave) => (
                                <div key={wave.id} className="relative z-10 flex gap-8">
                                    <div className={`w-12 h-12 rounded-2xl ${wave.color} flex items-center justify-center border-4 border-white shadow-xl shrink-0`}>
                                        <Target size={20} className={wave.id <= selectedWave ? "text-white" : "text-charcoal/40"} />
                                    </div>
                                    <div className={`flex-1 p-6 rounded-3xl border transition-all ${selectedWave === wave.id ? "bg-indblue/5 border-indblue" : "bg-boxbg border-silver/5"}`}>
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="font-bold text-indblue">{wave.title}</h4>
                                            <span className={`text-[8px] font-black px-2 py-1 rounded-full border ${selectedWave === wave.id ? "bg-indblue text-white" : "bg-white text-silver"}`}>
                                                {wave.status}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {wave.states.map((state) => (
                                                <span key={state} className="text-[10px] font-bold px-3 py-1 bg-white rounded-lg border border-silver/10 text-charcoal">
                                                    {state}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-8">
                            <Users className="text-indblue" size={24} />
                            <div>
                                <h3 className="text-xl font-bold text-indblue">Pilot Configuration</h3>
                                <p className="text-xs text-silver mt-1">Select geography, agencies, partners, languages, and scam focus for the live pilot.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {[
                                { key: "name", label: "Pilot Name" },
                                { key: "geography", label: "Pilot Geography" },
                                { key: "telecom_partner", label: "Telecom Partner" },
                                { key: "bank_partners", label: "Bank Partners" },
                                { key: "agencies", label: "Agencies" },
                                { key: "languages", label: "Languages" },
                                { key: "scam_categories", label: "Scam Categories" },
                            ].map((field: { key: PilotFormField; label: string }) => (
                                <div key={field.key} className={field.key === "scam_categories" ? "md:col-span-2" : ""}>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-silver">{field.label}</label>
                                    <input
                                        value={pilotForm[field.key]}
                                        onChange={(event) =>
                                            setPilotForm((current) => ({
                                                ...current,
                                                [field.key]: event.target.value,
                                            }))
                                        }
                                        className="mt-2 w-full p-3 bg-boxbg border border-silver/10 rounded-2xl text-sm font-semibold text-charcoal outline-none focus:border-indblue/40"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 flex flex-col md:flex-row gap-4">
                            <button
                                onClick={savePilotConfig}
                                className="flex-1 p-4 bg-indblue text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indblue/90 transition-colors"
                            >
                                <Save size={18} />
                                Save Pilot Config
                            </button>
                            <button
                                onClick={handleDeploy}
                                disabled={isDeploying}
                                className={`flex-1 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors ${
                                    isDeploying ? "bg-silver text-white" : "bg-indgreen text-white hover:bg-indblue"
                                }`}
                            >
                                {isDeploying ? <Loader2 className="animate-spin" size={18} /> : <Rocket size={18} />}
                                {isDeploying ? "Activating Pilot..." : "Initiate Pilot"}
                            </button>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-8">
                            <MessageSquare className="text-indblue" size={24} />
                            <div>
                                <h3 className="text-xl font-bold text-indblue">Pilot Communications & Feedback</h3>
                                <p className="text-xs text-silver mt-1">Launch pilot communications, then capture operator and partner feedback from the field.</p>
                            </div>
                        </div>

                        <label className="text-[10px] font-bold uppercase tracking-widest text-silver">Launch Message</label>
                        <textarea
                            value={communicationsMessage}
                            onChange={(event) => setCommunicationsMessage(event.target.value)}
                            rows={4}
                            className="mt-2 w-full p-4 bg-boxbg border border-silver/10 rounded-2xl text-sm text-charcoal outline-none focus:border-indblue/40"
                        />
                        <button
                            onClick={launchCommunications}
                            className="mt-4 px-5 py-3 bg-charcoal text-white rounded-2xl font-bold hover:bg-indblue transition-colors"
                        >
                            Launch Pilot Communications
                        </button>

                        <div className="mt-8 grid grid-cols-1 md:grid-cols-[0.9fr_1.1fr] gap-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-silver">Feedback Stakeholder</label>
                                <select
                                    value={feedbackDraft.stakeholder_type}
                                    onChange={(event) => setFeedbackDraft((current) => ({ ...current, stakeholder_type: event.target.value }))}
                                    className="w-full p-3 bg-boxbg border border-silver/10 rounded-2xl text-sm font-semibold text-charcoal outline-none"
                                >
                                    <option value="analyst">Analyst</option>
                                    <option value="police">Police</option>
                                    <option value="bank">Bank</option>
                                    <option value="field_support">Field Support</option>
                                </select>
                                <input
                                    value={feedbackDraft.source_agency}
                                    onChange={(event) => setFeedbackDraft((current) => ({ ...current, source_agency: event.target.value }))}
                                    placeholder="Source agency"
                                    className="w-full p-3 bg-boxbg border border-silver/10 rounded-2xl text-sm font-semibold text-charcoal outline-none"
                                />
                                <select
                                    value={feedbackDraft.sentiment}
                                    onChange={(event) => setFeedbackDraft((current) => ({ ...current, sentiment: event.target.value }))}
                                    className="w-full p-3 bg-boxbg border border-silver/10 rounded-2xl text-sm font-semibold text-charcoal outline-none"
                                >
                                    <option value="POSITIVE">Positive</option>
                                    <option value="NEUTRAL">Neutral</option>
                                    <option value="NEGATIVE">Negative</option>
                                </select>
                                <textarea
                                    value={feedbackDraft.message}
                                    onChange={(event) => setFeedbackDraft((current) => ({ ...current, message: event.target.value }))}
                                    rows={4}
                                    placeholder="Capture what the pilot team learned today..."
                                    className="w-full p-4 bg-boxbg border border-silver/10 rounded-2xl text-sm text-charcoal outline-none"
                                />
                                <button
                                    onClick={submitFeedback}
                                    className="w-full py-3 bg-saffron text-white rounded-2xl font-bold hover:bg-deeporange transition-colors"
                                >
                                    Submit Feedback
                                </button>
                            </div>

                            <div className="space-y-3">
                                {(feedback || []).length === 0 ? (
                                    <div className="p-5 bg-boxbg rounded-2xl border border-silver/5 text-sm text-silver">
                                        No pilot feedback logged yet.
                                    </div>
                                ) : (
                                    feedback.map((item) => (
                                        <div key={item.id} className="p-4 bg-boxbg rounded-2xl border border-silver/5">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-sm font-bold text-charcoal">
                                                    {(item.source_agency || item.stakeholder_type).toUpperCase()}
                                                </p>
                                                <span className={`text-[9px] font-black px-2 py-1 rounded-full ${
                                                    item.sentiment === "POSITIVE" ? "bg-indgreen/10 text-indgreen" :
                                                    item.sentiment === "NEGATIVE" ? "bg-redalert/10 text-redalert" :
                                                    "bg-saffron/10 text-saffron"
                                                }`}>
                                                    {item.sentiment}
                                                </span>
                                            </div>
                                            <p className="text-xs text-silver mt-2 leading-relaxed">{item.message}</p>
                                            <p className="text-[10px] text-silver mt-3">
                                                {item.created_at ? new Date(item.created_at).toLocaleString() : "Just now"}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                        <h4 className="font-bold text-indblue text-sm flex items-center gap-2 mb-6">
                            <ShieldCheck className="text-indgreen" size={18} />
                            Pilot Readiness Checklist
                        </h4>
                        <div className="space-y-3">
                            {(readiness?.checklist || []).map((item) => (
                                <div key={item.label} className="p-3 bg-boxbg rounded-2xl border border-silver/5">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle2 className={item.complete ? "text-indgreen" : "text-saffron"} size={16} />
                                        <div>
                                            <p className="text-sm font-bold text-charcoal">{item.label}</p>
                                            <p className="text-[11px] text-silver mt-1">{item.detail}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                        <h4 className="font-bold text-indblue text-sm flex items-center gap-2 mb-6">
                            <Users className="text-indblue" size={18} />
                            Training Status
                        </h4>
                        <div className="space-y-4">
                            {Object.entries(pilot?.training_status || {}).map(([stakeholder, status]) => (
                                <div key={stakeholder} className="p-4 bg-boxbg rounded-2xl border border-silver/5">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-bold text-charcoal capitalize">{stakeholder.replace("_", " ")}</p>
                                            <p className="text-[11px] text-silver mt-1">
                                                {status.completed}/{status.target} completed
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => markTrainingReady(stakeholder)}
                                            className="px-3 py-2 bg-indblue text-white rounded-xl text-[10px] font-bold hover:bg-indblue/90 transition-colors"
                                        >
                                            Mark Ready
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                        <h4 className="font-bold text-indblue text-sm flex items-center gap-2 mb-6">
                            <Globe className="text-indblue" size={18} />
                            Integration Readiness
                        </h4>
                        <div className="space-y-4">
                            {[
                                { label: "Telecom Sandbox", data: integrationReadiness.telecom },
                                { label: "Bank / NPCI Demo", data: integrationReadiness.bank },
                            ].map((item) => (
                                <div key={item.label} className="p-4 bg-boxbg rounded-2xl border border-silver/5">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-bold text-charcoal">{item.label}</p>
                                        <span className={`text-[9px] font-black px-2 py-1 rounded-full ${
                                            item.data?.configured ? "bg-indgreen/10 text-indgreen" : "bg-saffron/10 text-saffron"
                                        }`}>
                                            {item.data?.mode || "pending"}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-silver mt-2">{item.data?.provider || "Unavailable"}</p>
                                    <p className="text-[11px] text-silver mt-2 leading-relaxed">
                                        {(item.data?.capabilities || []).join(" • ")}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-indblue p-6 rounded-3xl border border-saffron/20 shadow-xl text-white">
                        <div className="flex items-center justify-between mb-6">
                            <h4 className="font-bold text-sm flex items-center gap-2">
                                <BarChart3 className="text-saffron" size={18} />
                                Outcome Report
                            </h4>
                            <span className="text-[10px] font-black text-saffron uppercase">
                                {outcome?.published_at ? "Published" : "Draft"}
                            </span>
                        </div>
                        <div className="space-y-3 text-xs">
                            <p><span className="text-white/60">Pilot:</span> {outcome?.name || pilot?.name}</p>
                            <p><span className="text-white/60">Geography:</span> {outcome?.geography || pilot?.geography}</p>
                            <p><span className="text-white/60">Launch status:</span> {outcome?.launch_status || pilot?.launch_status}</p>
                            <p><span className="text-white/60">Feedback items:</span> {outcome?.feedback_summary?.total || 0}</p>
                            <p><span className="text-white/60">Open issues:</span> {outcome?.feedback_summary?.open_issues || 0}</p>
                        </div>
                        <div className="mt-6 flex flex-col gap-3">
                            <button
                                onClick={captureMetricsSnapshot}
                                className="w-full py-3 bg-white/10 border border-white/10 rounded-2xl font-bold hover:bg-white/15 transition-colors flex items-center justify-center gap-2"
                            >
                                <Cpu size={16} />
                                Capture Metrics Snapshot
                            </button>
                            <button
                                onClick={publishOutcomeReport}
                                className="w-full py-3 bg-saffron text-white rounded-2xl font-bold hover:bg-deeporange transition-colors"
                            >
                                Publish Outcome Report
                            </button>
                        </div>
                        <div className="mt-5 space-y-2">
                            {(outcome?.recommended_partnerships || []).map((item) => (
                                <div key={item} className="text-[11px] text-white/80 leading-relaxed">
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                        <h4 className="font-bold text-indblue text-[10px] uppercase mb-6 tracking-widest">Operational Playbooks</h4>
                        <div className="space-y-3">
                            {[
                                "OPERATION MANUAL",
                                "ESCALATION PROTOCOL",
                                "AGENCY INTEGRATION GUIDE",
                            ].map((name) => (
                                <button
                                    key={name}
                                    onClick={() => downloadSimulatedFile(name, "pdf", {
                                        targetId: name,
                                        context: {
                                            document_name: name,
                                            pilot_name: pilot?.name,
                                            geography: pilot?.geography,
                                        },
                                    })}
                                    className="w-full flex items-center justify-between p-3 bg-boxbg hover:bg-indblue/5 rounded-xl border border-silver/5 transition-all group"
                                >
                                    <span className="text-[10px] font-bold text-charcoal">{name}</span>
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
