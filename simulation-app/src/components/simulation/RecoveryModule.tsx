"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  FileText,
  HeartHandshake,
  LifeBuoy,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Wallet,
} from "lucide-react";
import { toast } from "react-hot-toast";

import { API_BASE } from "@/config/api";
import { getAuthHeaders } from "@/lib/auth";

interface RecoveryModuleProps {
  customerId: string;
}

interface RecoverySummary {
  latest_case_id?: string | null;
  latest_status: string;
  next_actions: string[];
  golden_hour_tip: string;
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default function RecoveryModule({ customerId }: RecoveryModuleProps) {
  const [summary, setSummary] = useState<RecoverySummary | null>(null);
  const [caseStatus, setCaseStatus] = useState<Record<string, unknown> | null>(null);
  const [responses, setResponses] = useState<Record<string, Record<string, unknown>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const fetchSummary = async (showSpinner = true) => {
    if (showSpinner) {
      setIsLoading(true);
    }
    try {
      const response = await fetch(`${API_BASE}/citizen/recovery-companion`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || "Failed to load recovery companion.");
      }
      setSummary(data);
    } catch (error: any) {
      console.error("Recovery summary fetch failed:", error);
      toast.error(error.message || "Could not load recovery companion.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchSummary();
  }, []);

  const runAction = async (key: string, path: string, body?: Record<string, unknown>) => {
    setBusyAction(key);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body || {}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || "Action failed.");
      }
      setResponses((current) => ({ ...current, [key]: data }));
      toast.success(`${key.replaceAll("_", " ")} ready.`);
      await fetchSummary(false);
      return data;
    } catch (error: any) {
      toast.error(error.message || "Recovery action failed.");
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  const refreshCaseStatus = async () => {
    if (!summary?.latest_case_id) {
      toast.error("No active recovery case is available yet.");
      return;
    }
    setBusyAction("case_status");
    try {
      const response = await fetch(
        `${API_BASE}/recovery/case/status?incident_id=${encodeURIComponent(summary.latest_case_id)}`,
        { headers: getAuthHeaders() }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || "Could not load case status.");
      }
      setCaseStatus(data);
      toast.success("Recovery status refreshed.");
    } catch (error: any) {
      toast.error(error.message || "Could not refresh case status.");
    } finally {
      setBusyAction(null);
    }
  };

  if (isLoading || !summary) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <div className="rounded-[2rem] border border-indblue/10 bg-white px-8 py-10 text-center shadow-xl">
          <Loader2 size={26} className="mx-auto mb-4 animate-spin text-indblue" />
          <p className="text-sm font-bold text-indblue">Preparing the recovery companion...</p>
        </div>
      </div>
    );
  }

  const actionCards = [
    {
      id: "bundle",
      title: "Generate recovery bundle",
      description: "Create the bank-ready incident packet and begin persistent tracking.",
      icon: FileText,
      action: () => runAction("bundle", "/actions/perform", { action_type: "GENERATE_RECOVERY_BUNDLE" }),
    },
    {
      id: "bank_dispute",
      title: "Prepare bank dispute letter",
      description: "Generate a ready-to-file dispute letter with evidence references.",
      icon: Wallet,
      action: () =>
        runAction("bank_dispute", "/recovery/bank-dispute/generate", {
          incident_id: summary.latest_case_id,
          language: "en",
          phone_number: customerId,
        }),
    },
    {
      id: "rbi_ombudsman",
      title: "Prepare RBI ombudsman complaint",
      description: "Generate the escalation packet if your bank stalls or rejects support.",
      icon: ArrowRight,
      action: () =>
        runAction("rbi_ombudsman", "/recovery/rbi-ombudsman/generate", {
          incident_id: summary.latest_case_id,
        }),
    },
    {
      id: "legal_aid",
      title: "Request legal aid",
      description: "Check eligibility and produce a local NALSA referral path.",
      icon: LifeBuoy,
      action: () =>
        runAction("legal_aid", "/recovery/nalsa/check-eligibility", {
          phone_number: customerId,
          income_band: "low",
        }),
    },
    {
      id: "mental_health",
      title: "Get emotional support",
      description: "Route to post-incident counseling if the citizen wants it.",
      icon: Stethoscope,
      action: () =>
        runAction("mental_health", "/recovery/mental-health/refer", {
          phone_number: customerId,
        }),
    },
    {
      id: "insurance",
      title: "Prepare insurer claim",
      description: "Generate the claim packet if a cyber insurance product is in play.",
      icon: ShieldCheck,
      action: () =>
        runAction("insurance", "/recovery/insurance/auto-claim", {
          incident_id: summary.latest_case_id,
        }),
    },
  ];

  return (
    <div className="w-full max-w-6xl space-y-6 px-4 py-2">
      <section className="rounded-[2.2rem] border border-indblue/10 bg-[linear-gradient(145deg,rgba(255,107,34,0.12),rgba(0,33,106,0.08))] px-6 py-6 shadow-[0_20px_60px_-35px_rgba(0,33,106,0.45)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-saffron/15 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-saffron">
              <HeartHandshake size={12} />
              Recovery Companion
            </div>
            <h2 className="mt-3 text-3xl font-black text-indblue">Move from panic to a guided next step.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-silver">{summary.golden_hour_tip}</p>
          </div>
          <button
            onClick={() => void refreshCaseStatus()}
            disabled={!summary.latest_case_id || busyAction === "case_status"}
            data-testid="recovery-refresh-button"
            className="inline-flex items-center gap-2 rounded-full bg-indblue px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-white hover:bg-indblue/90 disabled:cursor-not-allowed disabled:bg-silver"
          >
            {busyAction === "case_status" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh Case
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-[1.4rem] border border-white/60 bg-white/80 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-saffron">Latest Case</p>
            <p className="mt-2 text-xl font-black text-indblue">{summary.latest_case_id || "Not started"}</p>
          </div>
          <div className="rounded-[1.4rem] border border-white/60 bg-white/80 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-saffron">Status</p>
            <p className="mt-2 text-xl font-black text-indblue">{summary.latest_status}</p>
          </div>
          <div className="rounded-[1.4rem] border border-white/60 bg-white/80 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-saffron">Next Action</p>
            <p className="mt-2 text-sm font-bold text-indblue">{summary.next_actions[0]}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {actionCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className="rounded-[1.8rem] border border-indblue/10 bg-white p-5 shadow-[0_18px_55px_-35px_rgba(0,33,106,0.4)]"
            >
              <Icon size={18} className="text-indblue" />
              <h3 className="mt-4 text-lg font-black text-indblue">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-silver">{card.description}</p>
              <button
                onClick={() => void card.action()}
                disabled={busyAction === card.id}
                data-testid={`recovery-action-${card.id}`}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-saffron px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-white hover:bg-saffron/90 disabled:bg-silver"
              >
                {busyAction === card.id ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                Run
              </button>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[1.8rem] border border-indblue/10 bg-white p-5 shadow-[0_18px_55px_-35px_rgba(0,33,106,0.4)]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-saffron">Checklist</p>
          <div className="mt-4 space-y-3">
            {summary.next_actions.map((step) => (
              <div key={step} className="rounded-[1.2rem] border border-silver/10 bg-boxbg px-4 py-3">
                <p className="text-sm font-bold text-charcoal">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-indblue/10 bg-white p-5 shadow-[0_18px_55px_-35px_rgba(0,33,106,0.4)]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-saffron">Live Output</p>
          <div className="mt-4 space-y-4">
            {caseStatus ? (
              <pre className="overflow-x-auto rounded-[1.2rem] bg-boxbg p-4 text-xs text-charcoal">
                {prettyJson(caseStatus)}
              </pre>
            ) : null}
            {Object.entries(responses).map(([key, value]) => (
              <div key={key}>
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-indblue">
                  {key.replaceAll("_", " ")}
                </p>
                <pre className="overflow-x-auto rounded-[1.2rem] bg-boxbg p-4 text-xs text-charcoal">
                  {prettyJson(value)}
                </pre>
              </div>
            ))}
            {!caseStatus && Object.keys(responses).length === 0 ? (
              <div className="rounded-[1.2rem] border border-dashed border-silver/20 bg-boxbg px-4 py-6 text-center">
                <p className="text-sm font-bold text-indblue">Run a recovery step to see live outputs here.</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
