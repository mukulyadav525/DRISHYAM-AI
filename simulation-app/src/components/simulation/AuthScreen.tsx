"use client";

import { useEffect, useState } from "react";
import { Phone, ArrowRight, User, Loader2 } from "lucide-react";
import Image from "next/image";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";

interface AuthScreenProps {
  authStatus: "login" | "pending" | "approved";
  setAuthStatus: (status: "login" | "pending" | "approved") => void;
  customerId: string;
  setCustomerId: (id: string) => void;
}

interface ConsentScope {
  id: string;
  label: string;
  description: string;
  required: boolean;
}

const FALLBACK_SCOPES: ConsentScope[] = [
  {
    id: "ai_handoff",
    label: "AI scam handoff",
    description: "Allow DRISHYAM to take over suspicious calls or chats to protect you.",
    required: true,
  },
  {
    id: "transcript_analysis",
    label: "Transcript and scam analysis",
    description: "Analyze suspicious messages to detect risk indicators and extract scam entities.",
    required: true,
  },
  {
    id: "evidence_packaging",
    label: "Evidence packaging",
    description: "Prepare verified evidence for FIR, graph linkage, and recovery workflows.",
    required: true,
  },
  {
    id: "alerting_recovery",
    label: "Alerts and recovery support",
    description: "Receive safety alerts and optional recovery support if you need help later.",
    required: false,
  },
];

function buildDefaultConsent(scopes: ConsentScope[]) {
  return scopes.reduce<Record<string, boolean>>((acc, scope) => {
    acc[scope.id] = false;
    return acc;
  }, {});
}

export default function AuthScreen({
  authStatus,
  setAuthStatus,
  customerId,
  setCustomerId,
}: AuthScreenProps) {
  const [policyVersion, setPolicyVersion] = useState("MVP-2026.03");
  const [consentScopes, setConsentScopes] = useState<ConsentScope[]>(FALLBACK_SCOPES);
  const [consentSelections, setConsentSelections] = useState<Record<string, boolean>>(() => buildDefaultConsent(FALLBACK_SCOPES));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const fetchConsentCatalog = async () => {
      try {
        const res = await fetch(`${API_BASE}/privacy/consent/catalog`, { signal: controller.signal });
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        const scopes = Array.isArray(data?.scopes) && data.scopes.length > 0 ? data.scopes : FALLBACK_SCOPES;
        setConsentScopes(scopes);
        setPolicyVersion(data?.policy_version || "MVP-2026.03");
        setConsentSelections((current) => ({
          ...buildDefaultConsent(scopes),
          ...current,
        }));
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Consent catalog fetch failed:", error);
        }
      }
    };

    void fetchConsentCatalog();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (customerId.length < 10) {
      return;
    }

    const controller = new AbortController();

    const fetchExistingConsent = async () => {
      try {
        const res = await fetch(`${API_BASE}/privacy/consent/lookup?phone_number=${encodeURIComponent(customerId)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        if (data?.scopes) {
          setConsentSelections((current) => ({
            ...current,
            ...data.scopes,
          }));
        }
        if (data?.policy_version) {
          setPolicyVersion(data.policy_version);
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Consent lookup failed:", error);
        }
      }
    };

    void fetchExistingConsent();
    return () => controller.abort();
  }, [customerId]);

  const requiredScopeIds = consentScopes.filter((scope) => scope.required).map((scope) => scope.id);
  const missingRequiredConsent = requiredScopeIds.some((scopeId) => !consentSelections[scopeId]);

  const handleRequestAccess = async () => {
    if (customerId.length >= 10) {
      if (missingRequiredConsent) {
        toast.error("Please accept the required protection consent items first.");
        return;
      }

      setIsSubmitting(true);
      try {
        const consentRes = await fetch(`${API_BASE}/privacy/consent/record`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone_number: customerId,
            scopes: consentSelections,
            channel: "SIMULATION_PORTAL",
            locale: typeof navigator !== "undefined" ? navigator.language : "en-IN",
            policy_version: policyVersion,
          })
        });

        if (!consentRes.ok) {
          const errorData = await consentRes.json().catch(() => ({}));
          throw new Error(errorData.detail || `Consent recording failed: ${consentRes.status}`);
        }

        const res = await fetch(`${API_BASE}/auth/simulation/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone_number: customerId })
        });
        if (res.ok) {
          setAuthStatus("pending");
          toast.success(`Request Sent to HQ: ${customerId}`);
        } else {
          toast.error(`HQ Rejected Request: ${res.status}`);
        }
      } catch (e: any) {
        toast.error("HQ Connection Failed: " + e.message);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      toast.error("Please enter a valid Phone Number");
    }
  };

  if (authStatus === "login") {
    return (
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl border border-silver/10 fade-in">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative w-20 h-20 overflow-hidden rounded-3xl border border-saffron/30 shadow-xl shadow-indblue/20 mb-6">
            <Image 
                src="/logo.png" 
                alt="DRISHYAM AI" 
                fill
                className="object-cover"
            />
          </div>
          <h2 className="text-3xl font-black text-indblue tracking-tight mb-2">Citizen Login</h2>
          <p className="text-sm text-silver font-medium">Verify your phone to enter the protective grid.</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indblue uppercase tracking-widest ml-1">Phone Number</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Enter 10-digit Phone Number"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                data-testid="citizen-phone-input"
                className="w-full bg-boxbg border border-silver/20 rounded-2xl px-5 py-4 text-sm font-bold text-indblue focus:outline-none focus:border-indblue transition-all"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-silver">
                <Phone size={20} />
              </div>
            </div>
          </div>

          <div className="p-5 bg-boxbg rounded-2xl border border-silver/20 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black text-indblue uppercase tracking-widest">Citizen Protection Consent</p>
                <p className="text-xs text-silver mt-2 leading-relaxed">
                  We record only the protection actions needed to run the DRISHYAM MVP safely. Required items must be accepted before access is granted.
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] font-black text-indgreen uppercase tracking-widest">DPDP Ready</p>
                <p className="text-[10px] text-silver mt-1">{policyVersion}</p>
              </div>
            </div>

            <div className="space-y-3">
              {consentScopes.map((scope) => (
                <label key={scope.id} className="flex items-start gap-3 rounded-2xl border border-silver/10 bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(consentSelections[scope.id])}
                    onChange={(event) => setConsentSelections((current) => ({
                      ...current,
                      [scope.id]: event.target.checked,
                    }))}
                    data-testid={`consent-checkbox-${scope.id}`}
                    className="mt-1 h-4 w-4 rounded border-silver/30 text-indblue focus:ring-indblue"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-charcoal">{scope.label}</p>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${scope.required ? "text-redalert" : "text-indgreen"}`}>
                        {scope.required ? "Required" : "Optional"}
                      </span>
                    </div>
                    <p className="text-[11px] text-silver mt-1 leading-relaxed">{scope.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleRequestAccess}
            disabled={isSubmitting}
            data-testid="request-access-button"
            className={`w-full py-5 rounded-2xl font-black text-sm transition-all shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] ${
              isSubmitting ? "bg-silver text-white cursor-not-allowed" : "bg-indblue text-white hover:bg-indblue/90"
            }`}
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            {isSubmitting ? "SECURING CONSENT..." : "REQUEST ACCESS"}
          </button>

          <div className="pt-4 flex items-center gap-3">
            <div className="h-[1px] flex-1 bg-silver/10" />
            <span className="text-[10px] font-black text-silver/40 uppercase tracking-[0.2em]">Secured by BASIG</span>
            <div className="h-[1px] flex-1 bg-silver/10" />
          </div>
        </div>
      </div>
    );
  }

  if (authStatus === "pending") {
    return (
      <div className="w-full max-w-md bg-white rounded-[3rem] p-12 shadow-2xl border border-silver/10 text-center fade-in">
        <div className="w-24 h-24 bg-saffron/10 text-saffron rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
          <Loader2 size={48} className="animate-spin" />
        </div>
        <h2 className="text-3xl font-black text-indblue mb-4 tracking-tight">Access Pending</h2>
        <p className="text-silver text-sm font-medium mb-10 px-4">
          Security clearance is being verified by the National Command Dashboard. Please wait for official approval.
        </p>
        
        <div className="w-full h-2 bg-boxbg rounded-full overflow-hidden mt-8">
          <div className="h-full bg-saffron animate-[pulse_2s_infinite]" style={{width: '60%'}} />
        </div>
        <p className="text-[10px] text-silver font-bold uppercase tracking-widest mt-6">
          Connecting to <span className="text-indblue">DRISHYAM HQ...</span>
        </p>
      </div>
    );
  }

  return null;
}
