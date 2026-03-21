"use client";

import { useEffect, useState } from "react";
import { Activity, BarChart3, Bug, Loader2, Network, Radar, Timer, Workflow } from "lucide-react";
import { toast } from "react-hot-toast";

import { API_BASE } from "@/config/api";
import { useAuth } from "@/context/AuthContext";

interface OverviewData {
    summary: {
        healthy_services: number;
        logging_live: boolean;
        metrics_live: boolean;
        traces_live: boolean;
        error_tracking_live: boolean;
        ml_dashboards_live: boolean;
        inference_latency_live: boolean;
        partner_dashboards_live: boolean;
    };
    service_health: Array<{
        service: string;
        status: string;
        uptime_pct: number;
        latency_ms: number;
        signal: string;
    }>;
    dashboard_matrix: Array<{ task: string; title: string; status: string; detail: string }>;
    partner_health: {
        tracked: number;
        live: number;
        at_risk: number;
        mou_signed: number;
        api_ready: number;
    };
    district_performance: Array<{
        district: string;
        prevention_score: number;
        response_score: number;
        review_status: string;
    }>;
    product_analytics: {
        citizen_onboarding_funnel: Array<{ stage: string; count: number }>;
        retention_snapshot: {
            weekly_active_operators: number;
            repeat_partner_reviews: number;
            alert_response_feedback: number;
        };
    };
}

interface TraceData {
    summary: { count: number; healthy: number };
    traces: Array<{
        trace_id: string;
        workflow: string;
        status: string;
        duration_ms: number;
        root_service: string;
        created_at: string | null;
        spans: Array<{ service: string; name: string; duration_ms: number; status: string }>;
    }>;
}

interface ErrorData {
    summary: { open: number; critical: number };
    issues: Array<{
        issue_id: string;
        source: string;
        severity: string;
        title: string;
        status: string;
        owner: string;
        resolution_eta_min: number;
    }>;
}

interface ModelData {
    summary: { models: number; watch: number; p95_within_budget: number };
    models: Array<{
        model_key: string;
        task: string;
        version: string;
        drift_score: number;
        latency_ms_p95: number;
        latency_budget_ms: number;
        false_positive_rate: number;
        retraining_queued: boolean;
        status: string;
    }>;
}

export default function ObservabilityPage() {
    const { user } = useAuth();
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [traces, setTraces] = useState<TraceData | null>(null);
    const [errors, setErrors] = useState<ErrorData | null>(null);
    const [models, setModels] = useState<ModelData | null>(null);
    const [loading, setLoading] = useState(true);

    const headers = user?.token
        ? {
              Authorization: `Bearer ${user.token}`,
          }
        : undefined;

    useEffect(() => {
        const load = async () => {
            if (!headers) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const [overviewRes, traceRes, errorRes, modelRes] = await Promise.all([
                    fetch(`${API_BASE}/observability/overview`, { headers }),
                    fetch(`${API_BASE}/observability/traces`, { headers }),
                    fetch(`${API_BASE}/observability/errors`, { headers }),
                    fetch(`${API_BASE}/observability/models`, { headers }),
                ]);

                if (!overviewRes.ok || !traceRes.ok || !errorRes.ok || !modelRes.ok) {
                    throw new Error("Failed to load observability workspace.");
                }

                const [overviewData, traceData, errorData, modelData] = await Promise.all([
                    overviewRes.json(),
                    traceRes.json(),
                    errorRes.json(),
                    modelRes.json(),
                ]);

                setOverview(overviewData as OverviewData);
                setTraces(traceData as TraceData);
                setErrors(errorData as ErrorData);
                setModels(modelData as ModelData);
            } catch (error) {
                console.error(error);
                toast.error("Unable to load observability workspace.");
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [user?.token]);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-indblue" size={32} />
            </div>
        );
    }

    if (!overview || !traces || !errors || !models) {
        return <div className="text-silver">Observability data is unavailable right now.</div>;
    }

    return (
        <div className="space-y-6 max-w-7xl">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-indblue tracking-tight underline decoration-indblue decoration-4 underline-offset-8">
                        Observability and Monitoring
                    </h2>
                    <p className="text-silver mt-4 italic font-medium">
                        Live service health, traces, issue tracking, partner health, and ML latency oversight.
                    </p>
                </div>
                <div className="bg-indblue text-white p-4 rounded-2xl shadow-xl min-w-[280px]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Healthy Services</p>
                    <p className="text-2xl font-black mt-2">{overview.summary.healthy_services}</p>
                    <p className="text-xs text-white/70 mt-2">{traces.summary.count} traces and {models.summary.models} model scorecards are live.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <Activity size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Service Dashboards</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">{overview.service_health.length}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <Workflow size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Traces</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">{traces.summary.count}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <Bug size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Open Issues</p>
                    </div>
                    <p className="text-3xl font-black text-redalert mt-3">{errors.summary.open}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <Radar size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Models in Watch</p>
                    </div>
                    <p className="text-3xl font-black text-saffron mt-3">{models.summary.watch}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <Activity className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Service Health</h3>
                        </div>
                        <div className="space-y-3">
                            {overview.service_health.map((service) => (
                                <div key={service.service} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-indblue">{service.service}</p>
                                            <p className="text-xs text-silver mt-1">{service.signal}</p>
                                        </div>
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${service.status === "OPERATIONAL" ? "bg-indgreen/10 text-indgreen" : "bg-redalert/10 text-redalert"}`}>
                                            {service.status}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-4 text-xs text-charcoal">
                                        <p><span className="font-bold text-indblue">Uptime:</span> {service.uptime_pct}%</p>
                                        <p><span className="font-bold text-indblue">Latency:</span> {service.latency_ms} ms</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <Workflow className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Recent Distributed Traces</h3>
                        </div>
                        <div className="space-y-4">
                            {traces.traces.map((trace) => (
                                <div key={trace.trace_id} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div>
                                            <p className="text-sm font-bold text-indblue">{trace.workflow}</p>
                                            <p className="text-xs text-silver mt-1">{trace.trace_id} · {trace.root_service}</p>
                                        </div>
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${trace.status === "OK" ? "bg-indgreen/10 text-indgreen" : "bg-redalert/10 text-redalert"}`}>
                                            {trace.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-charcoal mt-3">Total duration {trace.duration_ms} ms</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">
                                        {trace.spans.map((span) => (
                                            <div key={`${trace.trace_id}-${span.service}-${span.name}`} className="p-3 rounded-xl bg-white border border-silver/10">
                                                <p className="text-[11px] font-bold text-indblue">{span.service}</p>
                                                <p className="text-[11px] text-silver mt-1">{span.name}</p>
                                                <p className="text-[10px] uppercase tracking-widest text-charcoal mt-2">{span.duration_ms} ms</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <BarChart3 className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Monitoring Coverage Matrix</h3>
                        </div>
                        <div className="space-y-3">
                            {overview.dashboard_matrix.map((item) => (
                                <div key={item.task} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-bold text-indblue">{item.task} · {item.title}</p>
                                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-indgreen/10 text-indgreen">{item.status}</span>
                                    </div>
                                    <p className="text-xs text-silver mt-2">{item.detail}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-5 space-y-6">
                    <div className="bg-charcoal text-white p-8 rounded-3xl shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <Radar size={22} className="text-saffron" />
                            <h3 className="text-xl font-bold">Model Health and Latency</h3>
                        </div>
                        <div className="space-y-3">
                            {models.models.map((model) => (
                                <div key={model.model_key} className="p-4 rounded-2xl bg-white/10 border border-white/10">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-bold">{model.model_key}</p>
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${model.status === "HEALTHY" ? "bg-indgreen/10 text-indgreen" : "bg-saffron/10 text-saffron"}`}>
                                            {model.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-white/70 mt-1">{model.version}</p>
                                    <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                                        <p><span className="font-bold text-saffron">Drift:</span> {model.drift_score}</p>
                                        <p><span className="font-bold text-saffron">FP Rate:</span> {model.false_positive_rate}</p>
                                        <p><span className="font-bold text-saffron">P95:</span> {model.latency_ms_p95} ms</p>
                                        <p><span className="font-bold text-saffron">Budget:</span> {model.latency_budget_ms} ms</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <Bug className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Issue Tracker</h3>
                        </div>
                        <div className="space-y-3">
                            {errors.issues.map((issue) => (
                                <div key={issue.issue_id} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-bold text-indblue">{issue.issue_id}</p>
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${issue.severity === "CRITICAL" ? "bg-redalert/10 text-redalert" : issue.severity === "HIGH" ? "bg-saffron/10 text-saffron" : "bg-indgreen/10 text-indgreen"}`}>
                                            {issue.severity}
                                        </span>
                                    </div>
                                    <p className="text-xs text-charcoal mt-2">{issue.title}</p>
                                    <p className="text-[11px] text-silver mt-3">{issue.source} · Owner {issue.owner} · ETA {issue.resolution_eta_min}m</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <Network className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Partner and District Analytics</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Partner APIs Ready</p>
                                <p className="text-2xl font-black text-indblue mt-2">{overview.partner_health.api_ready}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Partners At Risk</p>
                                <p className="text-2xl font-black text-redalert mt-2">{overview.partner_health.at_risk}</p>
                            </div>
                        </div>
                        <div className="space-y-3 mb-6">
                            {overview.district_performance.map((district) => (
                                <div key={district.district} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-bold text-indblue">{district.district}</p>
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${district.review_status === "ON_TRACK" ? "bg-indgreen/10 text-indgreen" : "bg-saffron/10 text-saffron"}`}>
                                            {district.review_status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-charcoal mt-3">Prevention {district.prevention_score} · Response {district.response_score}</p>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                            <div className="flex items-center gap-2 text-indblue">
                                <Timer size={16} />
                                <p className="text-sm font-bold">Operator Retention Snapshot</p>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                                <div>
                                    <p className="text-xl font-black text-indblue">{overview.product_analytics.retention_snapshot.weekly_active_operators}</p>
                                    <p className="text-[10px] uppercase tracking-widest text-silver mt-1">Weekly Active</p>
                                </div>
                                <div>
                                    <p className="text-xl font-black text-indblue">{overview.product_analytics.retention_snapshot.repeat_partner_reviews}</p>
                                    <p className="text-[10px] uppercase tracking-widest text-silver mt-1">Partner Reviews</p>
                                </div>
                                <div>
                                    <p className="text-xl font-black text-indblue">{overview.product_analytics.retention_snapshot.alert_response_feedback}</p>
                                    <p className="text-[10px] uppercase tracking-widest text-silver mt-1">Feedback Loops</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
