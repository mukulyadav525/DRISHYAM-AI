"use client";

import { FormEvent, useEffect, useState } from "react";
import { Briefcase, Calculator, FileText, Loader2, Receipt, TrendingUp } from "lucide-react";
import { toast } from "react-hot-toast";

import { API_BASE } from "@/config/api";
import { useAuth } from "@/context/AuthContext";

interface PricingPlan {
    segment: string;
    plan: string;
    price_inr: number;
    billing_cycle: string;
    task: string;
}

interface PipelineOpportunity {
    account_name: string;
    segment: string;
    stage: string;
    owner: string;
    annual_value_inr: number;
    status: string;
    next_step: string;
}

interface BillingEntry {
    partner_name: string;
    plan_name: string;
    invoice_number: string;
    amount_inr: number;
    tax_inr: number;
    billing_status: string;
    subscription_status: string;
    billing_cycle: string;
    due_date: string | null;
}

interface RoiEstimate {
    segment: string;
    prevented_loss_inr: number;
    platform_cost_inr: number;
    monthly_alerts: number;
    covered_entities: number;
    net_savings_inr: number;
    roi_percent: number;
    payback_months: number | null;
    recommended_plan: string;
}

interface BusinessData {
    arr_target_inr: number;
    year_one_streams: string[];
    pricing_catalog: PricingPlan[];
    pipeline: {
        open_value_inr: number;
        arr_committed_inr: number;
        opportunities: PipelineOpportunity[];
        stage_mix: Array<{ label: string; count: number }>;
    };
    billing: {
        mrr_inr: number;
        collections_pct: number;
        records: BillingEntry[];
    };
    template_library: Array<{ task: string; name: string; path: string; absolute_path: string }>;
    roi_examples: RoiEstimate[];
    account_management: { task: string; cadence: string[]; owners: string[] };
}

const currency = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export default function BusinessPage() {
    const { user } = useAuth();
    const [data, setData] = useState<BusinessData | null>(null);
    const [loading, setLoading] = useState(true);
    const [roiEstimate, setRoiEstimate] = useState<RoiEstimate | null>(null);
    const [pipelineForm, setPipelineForm] = useState({
        account_name: "National Bank Demo",
        segment: "BANK",
        stage: "DISCOVERY",
        owner: "Revenue Ops",
        annual_value_inr: "3200000",
        next_step: "Schedule ROI validation workshop",
    });
    const [invoiceForm, setInvoiceForm] = useState({
        partner_name: "National Bank Demo",
        plan_name: "Bank Alert Fabric",
        amount_inr: "1800000",
        billing_cycle: "QUARTERLY",
        subscription_status: "ACTIVE",
    });
    const [roiForm, setRoiForm] = useState({
        segment: "BANK",
        prevented_loss_inr: "12000000",
        platform_cost_inr: "4400000",
        monthly_alerts: "180000",
        covered_entities: "2400000",
    });

    const headers = user?.token
        ? {
              Authorization: `Bearer ${user.token}`,
              "Content-Type": "application/json",
          }
        : undefined;

    const loadBusiness = async () => {
        if (!headers) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/program-office/business`, { headers: { Authorization: headers.Authorization } });
            if (!res.ok) {
                throw new Error("Failed to fetch business summary.");
            }
            const payload = (await res.json()) as BusinessData;
            setData(payload);
            if (!roiEstimate && payload.roi_examples.length > 0) {
                setRoiEstimate(payload.roi_examples[0]);
            }
        } catch (error) {
            console.error(error);
            toast.error("Unable to load business operations.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadBusiness();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.token]);

    const submitPipeline = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!headers) return;

        const res = await fetch(`${API_BASE}/program-office/business/pipeline`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                ...pipelineForm,
                annual_value_inr: Number(pipelineForm.annual_value_inr),
            }),
        });

        if (!res.ok) {
            toast.error("Opportunity creation failed.");
            return;
        }

        toast.success("Pipeline opportunity added.");
        await loadBusiness();
    };

    const submitInvoice = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!headers) return;

        const res = await fetch(`${API_BASE}/program-office/business/invoices`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                ...invoiceForm,
                amount_inr: Number(invoiceForm.amount_inr),
            }),
        });

        if (!res.ok) {
            toast.error("Invoice creation failed.");
            return;
        }

        toast.success("Invoice issued.");
        await loadBusiness();
    };

    const runRoiEstimate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!headers) return;

        const res = await fetch(`${API_BASE}/program-office/business/roi/estimate`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                segment: roiForm.segment,
                prevented_loss_inr: Number(roiForm.prevented_loss_inr),
                platform_cost_inr: Number(roiForm.platform_cost_inr),
                monthly_alerts: Number(roiForm.monthly_alerts),
                covered_entities: Number(roiForm.covered_entities),
            }),
        });

        if (!res.ok) {
            toast.error("ROI estimate failed.");
            return;
        }

        const payload = (await res.json()) as RoiEstimate;
        setRoiEstimate(payload);
        toast.success("ROI estimate updated.");
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-indblue" size={32} />
            </div>
        );
    }

    if (!data) {
        return <div className="text-silver">Business operations data is unavailable right now.</div>;
    }

    return (
        <div className="space-y-6 max-w-7xl">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-indblue tracking-tight underline decoration-indblue decoration-4 underline-offset-8">
                        Business Model and Revenue Ops
                    </h2>
                    <p className="text-silver mt-4 italic font-medium">
                        Phase 36 surface for pricing, subscriptions, billing, proposals, ROI, and partner pipeline control.
                    </p>
                </div>
                <div className="bg-indblue text-white p-4 rounded-2xl shadow-xl min-w-[260px]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">ARR Target</p>
                    <p className="text-2xl font-black mt-2">₹{currency.format(data.arr_target_inr)}</p>
                    <p className="text-xs text-white/70 mt-2">Year-one focus: {data.year_one_streams.join(", ")}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <TrendingUp size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Pipeline Open Value</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">₹{currency.format(data.pipeline.open_value_inr)}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <Receipt size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Monthly Recurring Revenue</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">₹{currency.format(data.billing.mrr_inr)}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                    <div className="flex items-center gap-3 text-indblue">
                        <Calculator size={20} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Collections Health</p>
                    </div>
                    <p className="text-3xl font-black text-indblue mt-3">{data.billing.collections_pct}%</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <Briefcase className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Pricing Catalog</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {data.pricing_catalog.map((plan) => (
                                <div key={`${plan.segment}-${plan.plan}`} className="p-5 rounded-2xl bg-boxbg border border-silver/10">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-saffron">{plan.segment}</p>
                                    <p className="text-sm font-bold text-indblue mt-2">{plan.plan}</p>
                                    <p className="text-lg font-black text-charcoal mt-3">₹{currency.format(plan.price_inr)}</p>
                                    <p className="text-xs text-silver mt-1">{plan.billing_cycle}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <h3 className="text-xl font-bold text-indblue mb-6">Pipeline Tracking</h3>
                        <div className="space-y-4 mb-8">
                            {data.pipeline.opportunities.map((opportunity) => (
                                <div key={`${opportunity.account_name}-${opportunity.stage}`} className="p-5 rounded-2xl bg-boxbg border border-silver/10">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-bold text-indblue">{opportunity.account_name}</p>
                                            <p className="text-xs text-silver mt-1">{opportunity.segment} · {opportunity.owner}</p>
                                            <p className="text-xs text-charcoal mt-3">{opportunity.next_step}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-saffron">{opportunity.stage}</p>
                                            <p className="text-sm font-black text-charcoal mt-2">₹{currency.format(opportunity.annual_value_inr)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <form onSubmit={submitPipeline} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input value={pipelineForm.account_name} onChange={(e) => setPipelineForm((prev) => ({ ...prev, account_name: e.target.value }))} className="px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Account name" />
                            <input value={pipelineForm.segment} onChange={(e) => setPipelineForm((prev) => ({ ...prev, segment: e.target.value }))} className="px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Segment" />
                            <input value={pipelineForm.stage} onChange={(e) => setPipelineForm((prev) => ({ ...prev, stage: e.target.value }))} className="px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Stage" />
                            <input value={pipelineForm.owner} onChange={(e) => setPipelineForm((prev) => ({ ...prev, owner: e.target.value }))} className="px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Owner" />
                            <input value={pipelineForm.annual_value_inr} onChange={(e) => setPipelineForm((prev) => ({ ...prev, annual_value_inr: e.target.value }))} className="px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Annual value" />
                            <input value={pipelineForm.next_step} onChange={(e) => setPipelineForm((prev) => ({ ...prev, next_step: e.target.value }))} className="px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Next step" />
                            <button type="submit" className="md:col-span-2 px-5 py-3 rounded-2xl bg-indblue text-white font-bold text-sm hover:bg-indblue/90 transition-colors">
                                Add Opportunity
                            </button>
                        </form>
                    </div>
                </div>

                <div className="xl:col-span-5 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-5">
                            <Calculator className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">ROI Calculator</h3>
                        </div>
                        <form onSubmit={runRoiEstimate} className="space-y-3">
                            <input value={roiForm.segment} onChange={(e) => setRoiForm((prev) => ({ ...prev, segment: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Segment" />
                            <input value={roiForm.prevented_loss_inr} onChange={(e) => setRoiForm((prev) => ({ ...prev, prevented_loss_inr: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Prevented loss" />
                            <input value={roiForm.platform_cost_inr} onChange={(e) => setRoiForm((prev) => ({ ...prev, platform_cost_inr: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Platform cost" />
                            <input value={roiForm.monthly_alerts} onChange={(e) => setRoiForm((prev) => ({ ...prev, monthly_alerts: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Monthly alerts" />
                            <input value={roiForm.covered_entities} onChange={(e) => setRoiForm((prev) => ({ ...prev, covered_entities: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Covered entities" />
                            <button type="submit" className="w-full px-5 py-3 rounded-2xl bg-saffron text-white font-bold text-sm hover:bg-saffron/90 transition-colors">
                                Estimate ROI
                            </button>
                        </form>

                        {roiEstimate && (
                            <div className="mt-5 p-5 rounded-2xl bg-boxbg border border-silver/10">
                                <p className="text-sm font-bold text-indblue">{roiEstimate.recommended_plan}</p>
                                <p className="text-xs text-silver mt-1">ROI {roiEstimate.roi_percent}% · Payback {roiEstimate.payback_months ?? "n/a"} months</p>
                                <p className="text-lg font-black text-charcoal mt-3">₹{currency.format(roiEstimate.net_savings_inr)} net savings</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-5">
                            <Receipt className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Billing and Subscription</h3>
                        </div>
                        <form onSubmit={submitInvoice} className="space-y-3 mb-6">
                            <input value={invoiceForm.partner_name} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, partner_name: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Partner" />
                            <input value={invoiceForm.plan_name} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, plan_name: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Plan" />
                            <input value={invoiceForm.amount_inr} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, amount_inr: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-silver/10 bg-boxbg text-sm" placeholder="Amount" />
                            <button type="submit" className="w-full px-5 py-3 rounded-2xl bg-indblue text-white font-bold text-sm hover:bg-indblue/90 transition-colors">
                                Issue Invoice
                            </button>
                        </form>
                        <div className="space-y-3">
                            {data.billing.records.map((entry) => (
                                <div key={entry.invoice_number} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-indblue">{entry.partner_name}</p>
                                            <p className="text-xs text-silver mt-1">{entry.plan_name}</p>
                                        </div>
                                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-indblue/10 text-indblue">
                                            {entry.billing_status}
                                        </span>
                                    </div>
                                    <p className="text-sm font-black text-charcoal mt-3">₹{currency.format(entry.amount_inr)}</p>
                                    <p className="text-[10px] text-silver mt-1">{entry.invoice_number} · {entry.subscription_status}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-5">
                            <FileText className="text-indblue" size={22} />
                            <h3 className="text-xl font-bold text-indblue">Templates and Commercial Pack</h3>
                        </div>
                        <div className="space-y-3">
                            {data.template_library.map((template) => (
                                <div key={template.name} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <p className="text-sm font-bold text-indblue">{template.name}</p>
                                    <p className="text-xs text-silver mt-1">{template.path}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
