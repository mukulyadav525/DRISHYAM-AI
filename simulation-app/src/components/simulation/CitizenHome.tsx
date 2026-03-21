"use client";

import { useEffect, useState, useTransition } from "react";
import {
  BellRing,
  ChevronRight,
  Gauge,
  HeartHandshake,
  Languages,
  Loader2,
  MapPinned,
  PhoneCall,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
  Users,
  Waves,
  Zap,
} from "lucide-react";
import { toast } from "react-hot-toast";

import { API_BASE } from "@/config/api";
import { getAuthHeaders } from "@/lib/auth";

type SimulationFeature =
  | "home"
  | "chat"
  | "deepfake"
  | "upi"
  | "bharat"
  | "recovery"
  | "drills"
  | null;

interface AppHomeData {
  profile: {
    citizen_id: string;
    display_name: string;
    phone_masked: string;
    district: string;
    language: string;
    senior_mode: boolean;
    low_bandwidth: boolean;
    segment: string;
    completed_steps: string[];
    last_score: number;
  };
  onboarding: {
    steps: Array<{ id: string; title: string; complete: boolean }>;
    completed: number;
    total: number;
  };
  trust_circle: Array<{
    id: number;
    guardian_name: string;
    guardian_phone: string;
    guardian_email?: string | null;
    relation_type: string;
    created_at?: string | null;
  }>;
  alerts: Array<{
    id: string;
    severity: string;
    title: string;
    message: string;
    region: string;
    channels: string[];
    languages: string[];
    acknowledged: boolean;
    sent_at?: string | null;
  }>;
  score: {
    score: number;
    decile_band: number;
    computed_locally: boolean;
    central_storage: boolean;
    badge: string;
    factors: Array<{ label: string; value: number }>;
  };
  habit_breaker: {
    enrolled: boolean;
    streak_days: number;
    reward_points: number;
    challenge: string;
    next_nudge_at?: string | null;
    last_completed_at?: string | null;
  };
  neighborhood_density: {
    district: string;
    risk_band: string;
    incidents_last_7d: number;
    trend: string;
    top_scam_types: string[];
  };
  drills: {
    recent: Array<{
      scenario: string;
      readiness_score: number;
      channel: string;
      completed_at?: string | null;
    }>;
    recommended: Array<{
      id: string;
      title: string;
      channel: string;
      risk_band: string;
    }>;
  };
  recovery: {
    active_cases: number;
    latest_case_id?: string | null;
    latest_status: string;
  };
  notification_templates: Array<{
    id: string;
    language: string;
    sample: string;
  }>;
  analytics: {
    sessions_opened: number;
    alerts_acknowledged: number;
    drills_started: number;
    trust_circle_updates: number;
    recovery_actions: number;
    last_opened_at?: string | null;
  };
}

interface CitizenHomeProps {
  customerId: string;
  setActiveFeature: (feature: SimulationFeature) => void;
  endSession: () => void;
}

const DISTRICTS = ["Delhi NCR", "Mumbai", "Bengaluru", "Chennai", "Hyderabad", "Kolkata"];
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
];
const SEGMENTS = [
  { value: "general", label: "General" },
  { value: "senior", label: "Senior / caregiver" },
  { value: "student", label: "Student" },
  { value: "merchant", label: "Merchant" },
];

function formatTime(value?: string | null) {
  if (!value) {
    return "Just now";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Just now";
  }
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function severityTone(severity: string) {
  if (severity === "HIGH") {
    return "border-redalert/20 bg-redalert/5 text-redalert";
  }
  if (severity === "LOW") {
    return "border-indgreen/20 bg-indgreen/5 text-indgreen";
  }
  return "border-saffron/20 bg-saffron/5 text-saffron";
}

export default function CitizenHome({ customerId, setActiveFeature, endSession }: CitizenHomeProps) {
  const [isNavigating, startTransition] = useTransition();
  const [homeData, setHomeData] = useState<AppHomeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyState, setBusyState] = useState<string | null>(null);
  const [district, setDistrict] = useState("Delhi NCR");
  const [language, setLanguage] = useState("en");
  const [segment, setSegment] = useState("general");
  const [seniorMode, setSeniorMode] = useState(false);
  const [lowBandwidth, setLowBandwidth] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [relationType, setRelationType] = useState("Caregiver");

  const request = async (path: string, init?: RequestInit) => {
    const headers: HeadersInit = {
      ...getAuthHeaders(init?.headers),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    };

    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.detail || `Request failed with ${response.status}`);
    }
    return data;
  };

  const loadHome = async (showSpinner = true) => {
    if (showSpinner) {
      setIsLoading(true);
    }
    try {
      const data = (await request("/citizen/app-home")) as AppHomeData;
      setHomeData(data);
      setDistrict(data.profile.district);
      setLanguage(data.profile.language);
      setSegment(data.profile.segment);
      setSeniorMode(data.profile.senior_mode);
      setLowBandwidth(data.profile.low_bandwidth);
    } catch (error: any) {
      console.error("Citizen home fetch failed:", error);
      toast.error(error.message || "Could not load citizen protection center.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadHome();
  }, []);

  const handleSavePreferences = async () => {
    setBusyState("preferences");
    try {
      const updated = await request("/citizen/preferences", {
        method: "POST",
        body: JSON.stringify({
          district,
          language,
          segment,
          senior_mode: seniorMode,
          low_bandwidth: lowBandwidth,
          onboarding_step: "profile_ready",
        }),
      });
      setHomeData((current) => (current ? { ...current, profile: updated } : current));
      toast.success("Citizen preferences updated.");
      await loadHome(false);
    } catch (error: any) {
      toast.error(error.message || "Could not save preferences.");
    } finally {
      setBusyState(null);
    }
  };

  const handleAddGuardian = async () => {
    if (!guardianName || !guardianPhone || !relationType) {
      toast.error("Add guardian name, phone number, and relation.");
      return;
    }

    setBusyState("trust-circle");
    try {
      await request("/citizen/trust-circle", {
        method: "POST",
        body: JSON.stringify({
          guardian_name: guardianName,
          guardian_phone: guardianPhone,
          relation_type: relationType,
        }),
      });
      setGuardianName("");
      setGuardianPhone("");
      setRelationType("Caregiver");
      toast.success("Trust-circle contact added.");
      await loadHome(false);
    } catch (error: any) {
      toast.error(error.message || "Could not add trust-circle contact.");
    } finally {
      setBusyState(null);
    }
  };

  const handleNotifyTrustCircle = async () => {
    setBusyState("notify");
    try {
      await request("/citizen/trust-circle/notify", {
        method: "POST",
        body: JSON.stringify({
          message: "DRISHYAM advisory: please check in with your family member and help verify any suspicious request.",
        }),
      });
      toast.success("Caregiver alert sent.");
      await loadHome(false);
    } catch (error: any) {
      toast.error(error.message || "Could not notify the trust circle.");
    } finally {
      setBusyState(null);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    setBusyState(alertId);
    try {
      await request(`/citizen/alerts/${alertId}/acknowledge`, { method: "POST" });
      toast.success("Alert acknowledged.");
      await loadHome(false);
    } catch (error: any) {
      toast.error(error.message || "Could not acknowledge the alert.");
    } finally {
      setBusyState(null);
    }
  };

  const handleHabitBreaker = async () => {
    setBusyState("habit");
    try {
      await request("/citizen/habit-breaker/enrol", {
        method: "POST",
        body: JSON.stringify({ channel: "simulation" }),
      });
      toast.success("Habit breaker challenge activated.");
      await loadHome(false);
    } catch (error: any) {
      toast.error(error.message || "Could not activate habit breaker.");
    } finally {
      setBusyState(null);
    }
  };

  const handleRefreshScore = async () => {
    if (!homeData) {
      return;
    }
    setBusyState("score");
    try {
      const acknowledgedCount = homeData.alerts.filter((alert) => alert.acknowledged).length;
      await request("/citizen/drishyam-score/compute", {
        method: "POST",
        body: JSON.stringify({
          suspicious_links_avoided: 4,
          drills_completed: homeData.drills.recent.length,
          alerts_acknowledged: acknowledgedCount,
          trust_circle_contacts: homeData.trust_circle.length,
          recovery_preparedness: homeData.recovery.active_cases > 0 ? 80 : 45,
        }),
      });
      toast.success("Sentinel score refreshed locally.");
      await loadHome(false);
    } catch (error: any) {
      toast.error(error.message || "Could not refresh the score.");
    } finally {
      setBusyState(null);
    }
  };

  const openFeature = (feature: Exclude<SimulationFeature, null>) => {
    startTransition(() => setActiveFeature(feature));
  };

  if (isLoading || !homeData) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center px-6 py-12">
        <div className="rounded-[2rem] border border-indblue/10 bg-white px-8 py-10 text-center shadow-2xl">
          <Loader2 size={28} className="mx-auto mb-4 animate-spin text-indblue" />
          <p className="text-sm font-bold text-indblue">Loading your citizen protection center...</p>
        </div>
      </div>
    );
  }

  const { profile, onboarding, alerts, trust_circle: trustCircle, score, habit_breaker: habit, neighborhood_density: density, drills, recovery, analytics } = homeData;

  return (
    <div className="w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-[2.5rem] border border-indblue/10 bg-[linear-gradient(140deg,rgba(0,33,106,0.96),rgba(0,122,61,0.86))] px-6 py-6 text-white shadow-[0_30px_80px_-30px_rgba(0,33,106,0.55)] sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em]">
              <ShieldCheck size={12} />
              Citizen Safety Center
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              {profile.display_name}, your protective grid is live.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80">
              Local score computation, neighborhood scam density, trust-circle defense, and rapid recovery are all ready for {customerId || profile.phone_masked}.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.6rem] border border-white/10 bg-white/10 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">Sentinel Score</p>
              <p className="mt-2 text-3xl font-black">{score.score}</p>
              <p className="mt-1 text-xs text-white/70">{score.badge.replaceAll("_", " ")}</p>
            </div>
            <div className="rounded-[1.6rem] border border-white/10 bg-white/10 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">District Risk</p>
              <p className="mt-2 text-2xl font-black">{density.risk_band}</p>
              <p className="mt-1 text-xs text-white/70">{density.incidents_last_7d} incidents in 7 days</p>
            </div>
            <div className="rounded-[1.6rem] border border-white/10 bg-white/10 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">Trust Circle</p>
              <p className="mt-2 text-2xl font-black">{trustCircle.length}</p>
              <p className="mt-1 text-xs text-white/70">
                {trustCircle.length > 0 ? "Caregiver route is ready" : "Add a caregiver contact"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <button
            onClick={() => openFeature("chat")}
            disabled={isNavigating}
            className="rounded-[1.5rem] border border-white/15 bg-white/10 px-4 py-4 text-left transition hover:bg-white/15"
          >
            <PhoneCall size={18} className="mb-3" />
            <p className="text-sm font-black">Let AI Handle</p>
            <p className="mt-1 text-xs text-white/70">Take over a suspicious call or chat instantly.</p>
          </button>
          <button
            onClick={() => openFeature("upi")}
            disabled={isNavigating}
            className="rounded-[1.5rem] border border-white/15 bg-white/10 px-4 py-4 text-left transition hover:bg-white/15"
          >
            <Zap size={18} className="mb-3" />
            <p className="text-sm font-black">UPI Armor</p>
            <p className="mt-1 text-xs text-white/70">Verify handles before approving any collect request.</p>
          </button>
          <button
            onClick={() => openFeature("bharat")}
            disabled={isNavigating}
            className="rounded-[1.5rem] border border-white/15 bg-white/10 px-4 py-4 text-left transition hover:bg-white/15"
          >
            <Waves size={18} className="mb-3" />
            <p className="text-sm font-black">Low-Bandwidth Bharat</p>
            <p className="mt-1 text-xs text-white/70">Feature-phone reporting and 1930 access flow.</p>
          </button>
          <button
            onClick={() => openFeature("drills")}
            disabled={isNavigating}
            className="rounded-[1.5rem] border border-white/15 bg-white/10 px-4 py-4 text-left transition hover:bg-white/15"
          >
            <Sparkles size={18} className="mb-3" />
            <p className="text-sm font-black">Drill Center</p>
            <p className="mt-1 text-xs text-white/70">Practice scam response with guided safe simulations.</p>
          </button>
          <button
            onClick={() => openFeature("recovery")}
            disabled={isNavigating}
            className="rounded-[1.5rem] border border-white/15 bg-white/10 px-4 py-4 text-left transition hover:bg-white/15"
          >
            <HeartHandshake size={18} className="mb-3" />
            <p className="text-sm font-black">Recovery Companion</p>
            <p className="mt-1 text-xs text-white/70">Bundle recovery evidence and track the next move.</p>
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => void loadHome(false)}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-white/80 transition hover:bg-white/10"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          <button
            onClick={endSession}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-white/80 transition hover:bg-white/10"
          >
            End Session
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-indblue/10 bg-white p-6 shadow-[0_18px_55px_-35px_rgba(0,33,106,0.4)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-saffron">Onboarding</p>
                <h2 className="mt-1 text-2xl font-black text-indblue">Citizen readiness</h2>
              </div>
              <p className="text-sm font-bold text-silver">
                {onboarding.completed} / {onboarding.total} safety steps complete
              </p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {onboarding.steps.map((step) => (
                <div
                  key={step.id}
                  className={`rounded-[1.5rem] border px-4 py-4 ${
                    step.complete ? "border-indgreen/20 bg-indgreen/5" : "border-silver/15 bg-boxbg"
                  }`}
                >
                  <p className="text-sm font-black text-indblue">{step.title}</p>
                  <p className={`mt-2 text-[11px] font-black uppercase tracking-[0.22em] ${step.complete ? "text-indgreen" : "text-silver"}`}>
                    {step.complete ? "Complete" : "Pending"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-indblue/10 bg-white p-6 shadow-[0_18px_55px_-35px_rgba(0,33,106,0.4)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-saffron">Alerts</p>
                <h2 className="mt-1 text-2xl font-black text-indblue">Public and local warnings</h2>
                <p className="mt-2 max-w-2xl text-sm text-silver">
                  Alerts are localized for {density.district}. Acknowledge them to strengthen your local-only safety score.
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-saffron/15 bg-saffron/5 px-4 py-3 text-sm text-charcoal">
                <p className="font-black text-saffron">{density.trend}</p>
                <p className="mt-1 text-xs text-silver">{density.top_scam_types.join(" | ")}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="rounded-[1.5rem] border border-silver/10 bg-boxbg px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${severityTone(alert.severity)}`}>
                          {alert.severity}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-indblue">
                          {alert.region}
                        </span>
                      </div>
                      <p className="mt-3 text-lg font-black text-indblue">{alert.title}</p>
                      <p className="mt-2 text-sm leading-relaxed text-silver">{alert.message}</p>
                      <p className="mt-3 text-[11px] font-bold text-silver">
                        {alert.channels.join(", ")} | {formatTime(alert.sent_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => void handleAcknowledgeAlert(alert.id)}
                      disabled={alert.acknowledged || busyState === alert.id}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] ${
                        alert.acknowledged
                          ? "bg-indgreen/10 text-indgreen"
                          : "bg-indblue text-white hover:bg-indblue/90"
                      }`}
                    >
                      {busyState === alert.id ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
                      {alert.acknowledged ? "Acknowledged" : "Mark Safe"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-indblue/10 bg-white p-6 shadow-[0_18px_55px_-35px_rgba(0,33,106,0.4)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-saffron">Trust Circle</p>
                <h2 className="mt-1 text-2xl font-black text-indblue">Family and caregiver backup</h2>
                <p className="mt-2 text-sm text-silver">
                  Add the person who should be notified if a suspicious scam interaction needs a second set of eyes.
                </p>
              </div>
              <button
                onClick={() => void handleNotifyTrustCircle()}
                disabled={trustCircle.length === 0 || busyState === "notify"}
                className="inline-flex items-center gap-2 rounded-full bg-saffron px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-white disabled:cursor-not-allowed disabled:bg-silver"
              >
                {busyState === "notify" ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                Notify Caregiver
              </button>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <div className="space-y-3">
                {trustCircle.length > 0 ? (
                  trustCircle.map((member) => (
                    <div key={member.id} className="rounded-[1.4rem] border border-indgreen/15 bg-indgreen/5 px-4 py-4">
                      <p className="text-lg font-black text-indblue">{member.guardian_name}</p>
                      <p className="mt-1 text-sm font-medium text-silver">
                        {member.relation_type} | {member.guardian_phone}
                      </p>
                      <p className="mt-3 text-[11px] font-black uppercase tracking-[0.22em] text-indgreen">
                        Care route active
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.4rem] border border-dashed border-silver/25 bg-boxbg px-4 py-6 text-center">
                    <Users size={20} className="mx-auto text-silver" />
                    <p className="mt-3 text-sm font-bold text-indblue">No caregiver added yet</p>
                    <p className="mt-1 text-xs text-silver">Add a family member, mentor, or local volunteer contact.</p>
                  </div>
                )}
              </div>

              <div className="rounded-[1.5rem] border border-silver/15 bg-boxbg px-4 py-4">
                <p className="text-sm font-black uppercase tracking-[0.22em] text-indblue">Add Trusted Contact</p>
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    value={guardianName}
                    onChange={(event) => setGuardianName(event.target.value)}
                    placeholder="Guardian or caregiver name"
                    className="w-full rounded-2xl border border-silver/15 bg-white px-4 py-3 text-sm font-medium text-charcoal outline-none transition focus:border-indblue"
                  />
                  <input
                    type="text"
                    value={guardianPhone}
                    onChange={(event) => setGuardianPhone(event.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full rounded-2xl border border-silver/15 bg-white px-4 py-3 text-sm font-medium text-charcoal outline-none transition focus:border-indblue"
                  />
                  <input
                    type="text"
                    value={relationType}
                    onChange={(event) => setRelationType(event.target.value)}
                    placeholder="Relation"
                    className="w-full rounded-2xl border border-silver/15 bg-white px-4 py-3 text-sm font-medium text-charcoal outline-none transition focus:border-indblue"
                  />
                  <button
                    onClick={() => void handleAddGuardian()}
                    disabled={busyState === "trust-circle"}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indblue px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white hover:bg-indblue/90 disabled:bg-silver"
                  >
                    {busyState === "trust-circle" ? <Loader2 size={16} className="animate-spin" /> : <UserRoundPlus size={16} />}
                    Add Contact
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[2rem] border border-indblue/10 bg-white p-6 shadow-[0_18px_55px_-35px_rgba(0,33,106,0.4)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-saffron">Local Score</p>
                <h2 className="mt-1 text-2xl font-black text-indblue">Sentinel shield</h2>
              </div>
              <button
                onClick={() => void handleRefreshScore()}
                disabled={busyState === "score"}
                className="inline-flex items-center gap-2 rounded-full bg-indblue px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-white hover:bg-indblue/90 disabled:bg-silver"
              >
                {busyState === "score" ? <Loader2 size={14} className="animate-spin" /> : <Gauge size={14} />}
                Refresh
              </button>
            </div>
            <div className="mt-5 rounded-[1.6rem] border border-indblue/10 bg-[linear-gradient(135deg,rgba(0,33,106,0.06),rgba(255,107,34,0.08))] px-5 py-5">
              <p className="text-5xl font-black text-indblue">{score.score}</p>
              <p className="mt-2 text-sm font-black uppercase tracking-[0.22em] text-saffron">{score.badge.replaceAll("_", " ")}</p>
              <p className="mt-3 text-sm text-silver">
                Computed locally: {score.computed_locally ? "Yes" : "No"} | Central storage: {score.central_storage ? "Enabled" : "Off"}
              </p>
            </div>
            <div className="mt-4 space-y-3">
              {score.factors.map((factor) => (
                <div key={factor.label} className="rounded-[1.2rem] border border-silver/10 bg-boxbg px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-charcoal">{factor.label}</p>
                    <p className="text-sm font-black text-indblue">{factor.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-indblue/10 bg-white p-6 shadow-[0_18px_55px_-35px_rgba(0,33,106,0.4)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-saffron">Preferences</p>
                <h2 className="mt-1 text-2xl font-black text-indblue">Senior and low-bandwidth mode</h2>
              </div>
              <ShieldAlert size={18} className="text-saffron" />
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-indblue">District</label>
                <select
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                  className="w-full rounded-2xl border border-silver/15 bg-boxbg px-4 py-3 text-sm font-medium text-charcoal outline-none"
                >
                  {DISTRICTS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-indblue">Language</label>
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className="w-full rounded-2xl border border-silver/15 bg-boxbg px-4 py-3 text-sm font-medium text-charcoal outline-none"
                  >
                    {LANGUAGES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-indblue">Segment</label>
                  <select
                    value={segment}
                    onChange={(event) => setSegment(event.target.value)}
                    className="w-full rounded-2xl border border-silver/15 bg-boxbg px-4 py-3 text-sm font-medium text-charcoal outline-none"
                  >
                    {SEGMENTS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-3">
                <button
                  onClick={() => setSeniorMode((current) => !current)}
                  className={`rounded-[1.4rem] border px-4 py-4 text-left ${
                    seniorMode ? "border-indgreen/20 bg-indgreen/5" : "border-silver/15 bg-boxbg"
                  }`}
                >
                  <p className="text-sm font-black text-indblue">Senior mode</p>
                  <p className="mt-1 text-xs text-silver">
                    Bigger touch targets, clearer prompts, and caregiver-first safety actions.
                  </p>
                </button>
                <button
                  onClick={() => setLowBandwidth((current) => !current)}
                  className={`rounded-[1.4rem] border px-4 py-4 text-left ${
                    lowBandwidth ? "border-indgreen/20 bg-indgreen/5" : "border-silver/15 bg-boxbg"
                  }`}
                >
                  <p className="text-sm font-black text-indblue">Low-bandwidth mode</p>
                  <p className="mt-1 text-xs text-silver">
                    Prioritize light layouts, shorter copy, and Bharat-safe fallbacks.
                  </p>
                </button>
              </div>
              <button
                onClick={() => void handleSavePreferences()}
                disabled={busyState === "preferences"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indblue px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white hover:bg-indblue/90 disabled:bg-silver"
              >
                {busyState === "preferences" ? <Loader2 size={16} className="animate-spin" /> : <Languages size={16} />}
                Save Safety Preferences
              </button>
            </div>
          </section>

          <section className="rounded-[2rem] border border-indblue/10 bg-white p-6 shadow-[0_18px_55px_-35px_rgba(0,33,106,0.4)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-saffron">Behavioral Defense</p>
                <h2 className="mt-1 text-2xl font-black text-indblue">Habit breaker challenge</h2>
                <p className="mt-2 text-sm text-silver">{habit.challenge}</p>
              </div>
              <button
                onClick={() => void handleHabitBreaker()}
                disabled={busyState === "habit"}
                className="inline-flex items-center gap-2 rounded-full bg-saffron px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-white hover:bg-saffron/90 disabled:bg-silver"
              >
                {busyState === "habit" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {habit.enrolled ? "Boost Streak" : "Enroll"}
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.4rem] border border-saffron/15 bg-saffron/5 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-saffron">Streak</p>
                <p className="mt-2 text-3xl font-black text-indblue">{habit.streak_days} days</p>
              </div>
              <div className="rounded-[1.4rem] border border-indgreen/15 bg-indgreen/5 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indgreen">Reward Points</p>
                <p className="mt-2 text-3xl font-black text-indblue">{habit.reward_points}</p>
              </div>
            </div>
            <p className="mt-4 text-xs font-medium text-silver">
              Next nudge: {formatTime(habit.next_nudge_at)}
            </p>
          </section>

          <section className="rounded-[2rem] border border-indblue/10 bg-white p-6 shadow-[0_18px_55px_-35px_rgba(0,33,106,0.4)]">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-saffron">Readiness Snapshot</p>
            <div className="mt-4 space-y-3">
              <button
                onClick={() => openFeature("drills")}
                className="flex w-full items-center justify-between rounded-[1.4rem] border border-silver/15 bg-boxbg px-4 py-4 text-left transition hover:border-indblue/20"
              >
                <div>
                  <p className="text-sm font-black text-indblue">Drill center</p>
                  <p className="mt-1 text-xs text-silver">
                    {drills.recent.length} recent drills | {drills.recommended.length} recommended next steps
                  </p>
                </div>
                <ChevronRight size={18} className="text-silver" />
              </button>
              <button
                onClick={() => openFeature("recovery")}
                className="flex w-full items-center justify-between rounded-[1.4rem] border border-silver/15 bg-boxbg px-4 py-4 text-left transition hover:border-indblue/20"
              >
                <div>
                  <p className="text-sm font-black text-indblue">Recovery companion</p>
                  <p className="mt-1 text-xs text-silver">
                    {recovery.active_cases} active cases | Status: {recovery.latest_status}
                  </p>
                </div>
                <ChevronRight size={18} className="text-silver" />
              </button>
              <div className="rounded-[1.4rem] border border-silver/15 bg-boxbg px-4 py-4">
                <p className="text-sm font-black text-indblue">App analytics</p>
                <p className="mt-2 text-xs text-silver">
                  Opened {analytics.sessions_opened} times | Alerts acknowledged {analytics.alerts_acknowledged} | Trust updates {analytics.trust_circle_updates}
                </p>
                <p className="mt-1 text-xs text-silver">Last active: {formatTime(analytics.last_opened_at)}</p>
              </div>
              <div className="rounded-[1.4rem] border border-silver/15 bg-boxbg px-4 py-4">
                <div className="flex items-center gap-2">
                  <MapPinned size={15} className="text-saffron" />
                  <p className="text-sm font-black text-indblue">Notification templates</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {homeData.notification_templates.map((template) => (
                    <div key={template.id} className="rounded-full bg-white px-3 py-2 text-[11px] font-bold text-silver">
                      {template.language.toUpperCase()} | {template.sample}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
