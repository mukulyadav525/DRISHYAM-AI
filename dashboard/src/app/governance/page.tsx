"use client";

import { FormEvent, useEffect, useState } from "react";
import { FileText, Loader2, Scale, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "react-hot-toast";

import { API_BASE } from "@/config/api";
import { useAuth } from "@/context/AuthContext";

interface DocArtifact {
    id?: string;
    title: string;
    category: string;
    audience: string;
    path: string;
    absolute_path: string;
    published: boolean;
}

interface DocumentationData {
    summary: {
        published: number;
        total: number;
        coverage_percent: number;
        extended_library_count: number;
    };
    phase_38_artifacts: DocArtifact[];
    extended_library: DocArtifact[];
}

interface GovernanceReview {
    review_id: string;
    board_type: string;
    title: string;
    cadence: string;
    status: string;
    next_review_at: string | null;
    outcome_summary: string | null;
    recommendations: string[];
}

interface GovernanceData {
    methodologies: Array<{ task: string; title: string; definition: string }>;
    dashboard_outputs: Array<{ task: string; title: string; status: string }>;
    boards: Array<{ task: string; name: string; cadence: string }>;
    reviews: GovernanceReview[];
    district_scorecard: {
        district: string;
        fraud_reduction_score: number;
        sentinel_score: number;
        inoculation_effectiveness: number;
        agency_accountability: number;
    };
    transparency_snapshot: {
        rupees_saved_monthly: number;
        citizens_protected: number;
        honeypot_hours: number;
        firs_generated: number;
        recovery_rate_percent: number;
    };
}

interface ContinuousImprovementData {
    summary: { active: number; average_progress_percent: number };
    tasks: Array<{ id: string; title: string; cadence: string; owner: string; progress_percent: number; status: string }>;
}

export default function GovernancePage() {
    const { user } = useAuth();
    const [docs, setDocs] = useState<DocumentationData | null>(null);
    const [governance, setGovernance] = useState<GovernanceData | null>(null);
    const [continuousImprovement, setContinuousImprovement] = useState<ContinuousImprovementData | null>(null);
    const [loading, setLoading] = useState(true);
    const [reviewForm, setReviewForm] = useState({
        board_type: "Governance Review Board",
        title: "Monthly public-interest review",
        cadence: "MONTHLY",
        status: "SCHEDULED",
        outcome_summary: "Schedule transparency, ethics, and release governance review.",
        recommendations: "Refresh public report and partner audit pack",
    });

    const headers = user?.token
        ? {
              Authorization: `Bearer ${user.token}`,
              "Content-Type": "application/json",
          }
        : undefined;

    const loadData = async () => {
        if (!headers) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const [docsRes, govRes, ciRes] = await Promise.all([
                fetch(`${API_BASE}/program-office/documentation`, { headers: { Authorization: headers.Authorization } }),
                fetch(`${API_BASE}/program-office/governance`, { headers: { Authorization: headers.Authorization } }),
                fetch(`${API_BASE}/program-office/continuous-improvement`, { headers: { Authorization: headers.Authorization } }),
            ]);

            if (!docsRes.ok || !govRes.ok || !ciRes.ok) {
                throw new Error("Failed to load governance workspace.");
            }

            setDocs((await docsRes.json()) as DocumentationData);
            setGovernance((await govRes.json()) as GovernanceData);
            setContinuousImprovement((await ciRes.json()) as ContinuousImprovementData);
        } catch (error) {
            console.error(error);
            toast.error("Unable to load governance workspace.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.token]);

    const createReview = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!headers) return;

        const res = await fetch(`${API_BASE}/program-office/governance/reviews`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                ...reviewForm,
                recommendations: reviewForm.recommendations
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
            }),
        });

        if (!res.ok) {
            toast.error("Review scheduling failed.");
            return;
        }

        toast.success("Governance review scheduled.");
        await loadData();
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-indblue" size={32} />
            </div>
        );
    }

    if (!docs || !governance || !continuousImprovement) {
        return <div className="text-silver">Governance workspace is unavailable right now.</div>;
    }

    return (
        <div className="space-y-6 max-w-7xl">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-indblue tracking-tight underline decoration-indblue decoration-4 underline-offset-8">
                        Governance, Impact, and Documentation
                    </h2>
                    <p className="text-silver mt-4 italic font-medium">
                        Phase 38, 39, and 41 workspace for documentation coverage, KPI methods, governance reviews, and continuous improvement.
                    </p>
                </div>
                <div className="bg-indblue text-white p-4 rounded-2xl shadow-xl min-w-[260px]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Documentation Coverage</p>
                    <p className="text-2xl font-black mt-2">{docs.summary.coverage_percent}%</p>
                    <p className="text-xs text-white/70 mt-2">{docs.summary.published}/{docs.summary.total} phase-38 artifacts published.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <Scale size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Governance Reviews</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">{governance.reviews.length}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <ShieldCheck size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Sentinel Score</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">{governance.district_scorecard.sentinel_score}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <Sparkles size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Improvement Progress</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">{continuousImprovement.summary.average_progress_percent}%</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <FileText className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Documentation Library</h3>
                        </div>
                        <div className="space-y-3">
                            {docs.phase_38_artifacts.map((artifact) => (
                                <div key={artifact.id} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-bold text-indblue">{artifact.id} · {artifact.title}</p>
                                            <p className="text-xs text-silver mt-1">{artifact.path}</p>
                                        </div>
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${artifact.published ? "bg-indgreen/10 text-indgreen" : "bg-redalert/10 text-redalert"}`}>
                                            {artifact.published ? "PUBLISHED" : "MISSING"}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <Scale className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">KPI Methodologies and Reviews</h3>
                        </div>
                        <div className="space-y-3 mb-8">
                            {governance.methodologies.map((method) => (
                                <div key={method.task} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <p className="text-sm font-bold text-indblue">{method.task} · {method.title}</p>
                                    <p className="text-xs text-silver mt-2">{method.definition}</p>
                                </div>
                            ))}
                        </div>

                        <form onSubmit={createReview} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input value={reviewForm.board_type} onChange={(e) => setReviewForm((prev) => ({ ...prev, board_type: e.target.value }))} className="px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Board type" />
                            <input value={reviewForm.title} onChange={(e) => setReviewForm((prev) => ({ ...prev, title: e.target.value }))} className="px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Review title" />
                            <input value={reviewForm.cadence} onChange={(e) => setReviewForm((prev) => ({ ...prev, cadence: e.target.value }))} className="px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Cadence" />
                            <input value={reviewForm.status} onChange={(e) => setReviewForm((prev) => ({ ...prev, status: e.target.value }))} className="px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Status" />
                            <input value={reviewForm.outcome_summary} onChange={(e) => setReviewForm((prev) => ({ ...prev, outcome_summary: e.target.value }))} className="md:col-span-2 px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Outcome summary" />
                            <input value={reviewForm.recommendations} onChange={(e) => setReviewForm((prev) => ({ ...prev, recommendations: e.target.value }))} className="md:col-span-2 px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Comma-separated recommendations" />
                            <button type="submit" className="md:col-span-2 px-5 py-3 rounded-2xl bg-indblue text-white font-bold text-sm hover:bg-indblue/90 transition-colors">
                                Schedule Governance Review
                            </button>
                        </form>
                    </div>
                </div>

                <div className="xl:col-span-5 space-y-6">
                    <div className="bg-charcoal text-white p-8 rounded-3xl shadow-2xl">
                        <h3 className="text-xl font-bold mb-5">District Scorecard</h3>
                        <div className="space-y-4 text-sm">
                            <p className="text-white/70">{governance.district_scorecard.district}</p>
                            <p>Fraud reduction: {governance.district_scorecard.fraud_reduction_score}</p>
                            <p>Sentinel Score: {governance.district_scorecard.sentinel_score}</p>
                            <p>Inoculation effectiveness: {governance.district_scorecard.inoculation_effectiveness}</p>
                            <p>Agency accountability: {governance.district_scorecard.agency_accountability}</p>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <h3 className="text-xl font-bold text-indblue mb-5">Governance Calendar</h3>
                        <div className="space-y-3">
                            {governance.reviews.map((review) => (
                                <div key={review.review_id} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <p className="text-sm font-bold text-indblue">{review.board_type}</p>
                                    <p className="text-xs text-silver mt-1">{review.title}</p>
                                    <p className="text-[10px] text-saffron mt-2">{review.status} · {review.cadence}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <h3 className="text-xl font-bold text-indblue mb-5">Continuous Improvement</h3>
                        <div className="space-y-3 max-h-[480px] overflow-auto pr-2">
                            {continuousImprovement.tasks.map((task) => (
                                <div key={task.id} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-bold text-indblue">{task.id}</p>
                                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-saffron/10 text-saffron">{task.progress_percent}%</span>
                                    </div>
                                    <p className="text-sm text-charcoal mt-2">{task.title}</p>
                                    <p className="text-xs text-silver mt-1">{task.owner} · {task.cadence}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
