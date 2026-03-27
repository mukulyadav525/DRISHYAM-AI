"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  LifeBuoy,
  Loader2,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";

interface CaseStatus {
  police_fir_status: string;
  bank_dispute_status: string;
  rbi_ombudsman_status: string;
  consumer_court_status: string;
  last_updated_utc: string;
  total_recovered?: number;
  next_action_required: string;
}

interface GeneratedDocument {
  id: string;
  status: string;
}

interface RecoveryCaseSummary {
  id: string;
  amount: string;
  type: string;
  platform: string;
  status: string;
  priority: string;
}

export default function RecoveryPage() {
  const { performAction, downloadSimulatedFile } = useActions();
  const [step, setStep] = useState(1);
  const [scamType, setScamType] = useState("");
  const [txnId, setTxnId] = useState("");
  const [txnDate, setTxnDate] = useState("");
  const [bankName, setBankName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [activeCases, setActiveCases] = useState<RecoveryCaseSummary[]>([]);
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const [caseStatus, setCaseStatus] = useState<CaseStatus | null>(null);
  const [generatedDocs, setGeneratedDocs] = useState<Record<string, GeneratedDocument>>({});
  const [referralSummary, setReferralSummary] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const res = await fetch(`${API_BASE}/system/stats/agency`);
        if (res.ok) {
          const data = await res.json();
          setActiveCases(data.police.cases.slice(0, 3));
        }
      } catch (e) {
        console.error("Failed to fetch cases:", e);
      }
    };
    void fetchCases();
  }, []);

  const fetchCaseStatus = async (incidentId: string) => {
    try {
      const res = await fetch(`${API_BASE}/recovery/case/status?incident_id=${encodeURIComponent(incidentId)}`);
      if (res.ok) {
        setCaseStatus(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch case status:", error);
    }
  };

  const handleNext = () => setStep((current) => current + 1);

  const generateLetters = async () => {
    setIsGenerating(true);
    setGeneratedDocs({});
    setReferralSummary({});

    try {
      const result = await performAction("GENERATE_RECOVERY_BUNDLE", scamType, {
        txn_id: txnId,
        txn_date: txnDate,
        bank_name: bankName,
        scam_type: scamType,
      });

      const incidentId = result?.detail?.bundle_id;
      if (incidentId) {
        setActiveIncidentId(incidentId);
        await fetchCaseStatus(incidentId);
      }

      setShowResults(true);
      toast.success("Recovery bundle generated successfully");
    } catch (error) {
      console.error("Recovery bundle generation failed:", error);
      toast.error("Unable to generate the recovery bundle.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRecoveryDocument = async (docKey: string, fileKey: string, endpoint: string, body: Record<string, unknown>) => {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error("Document generation failed");
      }

      const payload = await res.json();
      const id = payload.letter_id || payload.complaint_id || payload.claim_id || payload.referral_id || payload.subscription_id || payload.series_id || "READY";
      setGeneratedDocs((current) => ({
        ...current,
        [docKey]: {
          id,
          status: payload.submission_status || payload.status || "READY",
        },
      }));

      await downloadSimulatedFile(fileKey, "pdf", {
        targetId: activeIncidentId || txnId || undefined,
        context: {
          incident_id: activeIncidentId,
          txn_id: txnId,
          txn_date: txnDate,
          bank_name: bankName,
          scam_type: scamType,
          generated_document: docKey,
          reference_id: id,
        },
      });
      toast.success(`${docKey} prepared (${id}).`);
    } catch (error) {
      console.error(`${docKey} generation failed:`, error);
      toast.error(`Unable to prepare ${docKey}.`);
    }
  };

  const handleLegalAid = async () => {
    try {
      const res = await fetch(`${API_BASE}/recovery/nalsa/check-eligibility`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ incident_id: activeIncidentId, scam_type: scamType }),
      });
      if (!res.ok) {
        throw new Error("Legal aid referral failed");
      }
      const payload = await res.json();
      setReferralSummary((current) => ({
        ...current,
        legal: `${payload.nearest_nalsa_centre} • ${payload.eligible_for_free_aid ? "Eligible" : "Review needed"}`,
      }));
      toast.success("Legal aid eligibility checked.");
    } catch (error) {
      console.error("Legal aid error:", error);
      toast.error("Unable to complete legal aid referral.");
    }
  };

  const handleMentalHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/recovery/mental-health/refer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ incident_id: activeIncidentId }),
      });
      if (!res.ok) {
        throw new Error("Mental health referral failed");
      }
      const payload = await res.json();
      setReferralSummary((current) => ({
        ...current,
        mental_health: `${payload.partner_org} • Session scheduled`,
      }));
      toast.success("Mental health referral prepared.");
    } catch (error) {
      console.error("Mental health error:", error);
      toast.error("Unable to prepare mental health referral.");
    }
  };

  const handleInsuranceClaim = async () => {
    try {
      const res = await fetch(`${API_BASE}/recovery/insurance/auto-claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ incident_id: activeIncidentId }),
      });
      if (!res.ok) {
        throw new Error("Insurance claim generation failed");
      }
      const payload = await res.json();
      setGeneratedDocs((current) => ({
        ...current,
        Insurance: {
          id: payload.claim_id,
          status: payload.status_tracking_active ? "TRACKING ACTIVE" : "READY",
        },
      }));
      toast.success(`Insurance claim ${payload.claim_id} prepared.`);
    } catch (error) {
      console.error("Insurance claim error:", error);
      toast.error("Unable to prepare insurance claim.");
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-indblue tracking-tight">Post-Scam Recovery Companion</h2>
        <p className="text-silver mt-1 italic font-medium">Citizen roadmap for financial, legal, and emotional restoration.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {!showResults ? (
            <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm min-h-[500px] flex flex-col">
              <div className="flex gap-2 mb-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${step >= i ? "bg-saffron" : "bg-boxbg"}`} />
                ))}
              </div>

              <div className="flex-1 space-y-8 animate-in fade-in duration-500">
                {step === 1 && (
                  <div className="space-y-6">
                    <h3 className="text-2xl font-bold text-indblue">Step 1: Incident Classification</h3>
                    <p className="text-silver text-sm">Select the fraud type so DRISHYAM can prepare the correct restitution workflow.</p>
                    <div className="grid grid-cols-2 gap-4">
                      {["UPI Collect Trap", "Investment Scam", "Job Fraud", "Deepfake Identity"].map((type) => (
                        <button
                          key={type}
                          onClick={() => setScamType(type)}
                          className={`p-6 rounded-2xl border text-left transition-all ${scamType === type ? "border-saffron bg-saffron/5 shadow-sm" : "border-silver/10 hover:border-silver/30"}`}
                        >
                          <p className={`font-bold text-sm ${scamType === type ? "text-saffron" : "text-indblue"}`}>{type}</p>
                          <p className="text-[10px] text-silver mt-1 font-medium italic">Standard procedure available</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <h3 className="text-2xl font-bold text-indblue">Step 2: Core Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-silver uppercase tracking-wider">Transaction ID</label>
                        <input
                          type="text"
                          placeholder="e.g. 3094xxxx"
                          value={txnId}
                          onChange={(e) => setTxnId(e.target.value)}
                          className="w-full p-3 bg-boxbg rounded-xl border border-silver/10 font-mono text-xs outline-none focus:border-saffron"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-silver uppercase tracking-wider">Date & Time</label>
                        <input
                          type="datetime-local"
                          value={txnDate}
                          onChange={(e) => setTxnDate(e.target.value)}
                          className="w-full p-3 bg-boxbg rounded-xl border border-silver/10 text-xs outline-none focus:border-saffron"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-bold text-silver uppercase tracking-wider">Beneficiary Bank Name</label>
                        <input
                          type="text"
                          placeholder="e.g. State Bank of India"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full p-3 bg-boxbg rounded-xl border border-silver/10 text-xs outline-none focus:border-saffron"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6 text-center py-8">
                    <div className="w-20 h-20 bg-boxbg rounded-full flex items-center justify-center mx-auto mb-4 border border-silver/10">
                      <FileText className="text-saffron" size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-indblue">Step 3: Generate Restitution Bundle</h3>
                    <p className="text-silver text-sm max-w-sm mx-auto">
                      DRISHYAM will prepare bank dispute, RBI, and recovery tracking artifacts with case follow-up status.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-auto pt-8 flex justify-between">
                {step > 1 && (
                  <button onClick={() => setStep((current) => current - 1)} className="px-6 py-3 text-xs font-bold text-silver hover:text-charcoal uppercase tracking-widest transition-colors">
                    Back
                  </button>
                )}
                <button
                  onClick={step === 3 ? () => void generateLetters() : handleNext}
                  disabled={(step === 1 && !scamType) || isGenerating}
                  className={`ml-auto bg-indblue text-white px-8 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-saffron transition-all flex items-center gap-2 ${isGenerating ? "opacity-50" : ""}`}
                >
                  {isGenerating ? "Processing AI templates..." : step === 3 ? "Generate Bundle" : "Continue to Details"}
                  {!isGenerating && <ArrowRight size={14} />}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in zoom-in-95 duration-500">
              <div className="bg-indgreen p-8 rounded-3xl text-white flex gap-6 items-center shadow-xl">
                <div className="p-4 bg-white/20 rounded-2xl">
                  <ShieldCheck size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Bundle Ready for Download</h3>
                  <p className="text-white/80 text-sm mt-1">
                    Incident {activeIncidentId || "pending"} is now linked to recovery case tracking and document generation.
                  </p>
                </div>
                <button
                  onClick={() => downloadSimulatedFile("RESTITUTION_BUNDLE", "zip", {
                    targetId: activeIncidentId || txnId || undefined,
                    context: {
                      incident_id: activeIncidentId,
                      txn_id: txnId,
                      txn_date: txnDate,
                      bank_name: bankName,
                      scam_type: scamType,
                    },
                  })}
                  className="ml-auto bg-white text-indgreen px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-boxbg transition-all"
                >
                  Download All (.zip)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "RBI Ombudsman", desc: "Official appeal for transaction reversal", icon: Scale, file: "RBI_APPEAL", endpoint: "/recovery/rbi-ombudsman/generate" },
                  { label: "Home Bank (Branch Mgr)", desc: "Immediate freeze and chargeback request", icon: Building2, file: "BANK_FREEZE_REQ", endpoint: "/recovery/bank-dispute/generate" },
                  { label: "NPCI Grievance", desc: "VPA reputation block and UPI flagging", icon: AlertCircle, file: "NPCI_GRIEVANCE", endpoint: "/recovery/bank-dispute/generate" },
                ].map((doc) => (
                  <div key={doc.label} className="bg-white p-6 rounded-2xl border border-silver/10 shadow-sm hover:border-saffron/30 transition-all flex flex-col justify-between">
                    <div>
                      <doc.icon className="text-saffron mb-3" size={20} />
                      <h4 className="font-bold text-indblue text-sm">{doc.label}</h4>
                      <p className="text-[11px] text-silver mt-1">{doc.desc}</p>
                      {generatedDocs[doc.label] ? (
                        <p className="text-[10px] text-indgreen font-bold mt-3">{generatedDocs[doc.label].id} • {generatedDocs[doc.label].status}</p>
                      ) : null}
                    </div>
                    <button
                      onClick={() =>
                        void handleRecoveryDocument(doc.label, doc.file, doc.endpoint, {
                          incident_id: activeIncidentId,
                          language: "en",
                          bank_name: bankName,
                          txn_id: txnId,
                        })
                      }
                      className="flex items-center gap-2 text-[10px] font-bold text-indblue uppercase mt-4 hover:text-saffron"
                    >
                      <Download size={14} /> Generate & Download
                    </button>
                  </div>
                ))}
              </div>

              <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-indblue text-sm">Recovery Status</h4>
                  <button
                    onClick={() => activeIncidentId && void fetchCaseStatus(activeIncidentId)}
                    className="text-[10px] font-bold uppercase tracking-widest text-saffron"
                  >
                    Refresh
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-boxbg rounded-2xl border border-silver/10">
                    <p className="text-silver uppercase tracking-widest text-[10px] font-bold">Bank Dispute</p>
                    <p className="font-bold text-indblue mt-2">{caseStatus?.bank_dispute_status || "Pending"}</p>
                  </div>
                  <div className="p-4 bg-boxbg rounded-2xl border border-silver/10">
                    <p className="text-silver uppercase tracking-widest text-[10px] font-bold">RBI Ombudsman</p>
                    <p className="font-bold text-indblue mt-2">{caseStatus?.rbi_ombudsman_status || "Pending"}</p>
                  </div>
                  <div className="p-4 bg-boxbg rounded-2xl border border-silver/10">
                    <p className="text-silver uppercase tracking-widest text-[10px] font-bold">Consumer / Legal</p>
                    <p className="font-bold text-indblue mt-2">{caseStatus?.consumer_court_status || "Pending"}</p>
                  </div>
                  <div className="p-4 bg-boxbg rounded-2xl border border-silver/10">
                    <p className="text-silver uppercase tracking-widest text-[10px] font-bold">Next Action</p>
                    <p className="font-bold text-saffron mt-2">{caseStatus?.next_action_required || "Generate bundle first"}</p>
                  </div>
                </div>
                <button
                  onClick={() => void handleInsuranceClaim()}
                  className="mt-4 px-4 py-3 rounded-xl bg-indblue text-white text-xs font-bold uppercase tracking-widest hover:bg-charcoal transition-colors"
                >
                  Prepare Insurance Claim
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="text-saffron" size={20} />
              <h4 className="font-bold text-indblue text-sm">Active Case Tracking</h4>
            </div>
            <div className="space-y-4">
              {activeCases.length > 0 ? (
                activeCases.map((c, i) => (
                  <div key={i} className="p-3 bg-boxbg rounded-xl border border-silver/5 flex flex-col gap-1">
                    <p className="text-[10px] font-black text-indblue uppercase tracking-tighter">{c.id}</p>
                    <p className="text-[9px] text-silver font-bold">{c.type} - {c.amount}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${c.status === "PENDING" ? "bg-saffron" : "bg-indgreen"}`} />
                      <span className="text-[8px] font-black text-silver/60 uppercase">{c.status}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-silver italic">No active cases tracked.</p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <LifeBuoy className="text-saffron" size={20} />
              <h4 className="font-bold text-indblue text-sm">Support Ecosystem</h4>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => void handleLegalAid()}
                className="w-full p-4 bg-boxbg rounded-2xl border border-silver/5 text-left hover:border-saffron transition-all"
              >
                <p className="text-xs font-bold text-indblue flex items-center justify-between">
                  Legal Aid Referral
                  <ExternalLink size={14} className="opacity-40" />
                </p>
                <p className="text-[10px] text-silver mt-1">{referralSummary.legal || "Check NALSA eligibility and nearest assistance centre."}</p>
              </button>
              <button
                onClick={() => void handleMentalHealth()}
                className="w-full p-4 bg-boxbg rounded-2xl border border-silver/5 text-left hover:border-saffron transition-all"
              >
                <p className="text-xs font-bold text-indblue flex items-center justify-between">
                  Mental Health Referral
                  <ExternalLink size={14} className="opacity-40" />
                </p>
                <p className="text-[10px] text-silver mt-1">{referralSummary.mental_health || "Prepare survivor-support referral with appointment scheduling."}</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
