"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2, ShieldCheck, Sparkles, Target } from "lucide-react";
import { toast } from "react-hot-toast";

import { API_BASE } from "@/config/api";
import { getAuthHeaders } from "@/lib/auth";

interface DrillModuleProps {
  customerId: string;
}

interface DrillCenterData {
  recent: Array<{
    scenario: string;
    readiness_score: number;
    channel: string;
    completed_at?: string | null;
  }>;
  scenarios: Array<{
    id: string;
    title: string;
    risk_band: string;
    channel: string;
    recommended_follow_up: string;
  }>;
}

function formatTime(value?: string | null) {
  if (!value) {
    return "Not run yet";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not run yet";
  }
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DrillModule({ customerId }: DrillModuleProps) {
  const [data, setData] = useState<DrillCenterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [latestRun, setLatestRun] = useState<Record<string, unknown> | null>(null);

  const loadDrillCenter = async (showSpinner = true) => {
    if (showSpinner) {
      setIsLoading(true);
    }
    try {
      const response = await fetch(`${API_BASE}/citizen/drill-center`, {
        headers: getAuthHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.detail || "Could not load drill center.");
      }
      setData(payload);
    } catch (error: any) {
      console.error("Drill center fetch failed:", error);
      toast.error(error.message || "Could not load drill center.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDrillCenter();
  }, []);

  const runScenario = async (scenarioId: string) => {
    setRunningScenario(scenarioId);
    try {
      const response = await fetch(`${API_BASE}/inoculation/drill/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: customerId,
          scenario: scenarioId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.detail || "Could not launch the drill.");
      }
      setLatestRun(payload);
      toast.success("Safe drill launched.");
      await loadDrillCenter(false);
    } catch (error: any) {
      toast.error(error.message || "Could not launch the drill.");
    } finally {
      setRunningScenario(null);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <div className="rounded-[2rem] border border-indblue/10 bg-white px-8 py-10 text-center shadow-xl">
          <Loader2 size={26} className="mx-auto mb-4 animate-spin text-indblue" />
          <p className="text-sm font-bold text-indblue">Loading drill center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl space-y-6 px-4 py-2">
      <section className="rounded-[2.2rem] border border-indblue/10 bg-[linear-gradient(145deg,rgba(0,122,61,0.10),rgba(0,33,106,0.08))] px-6 py-6 shadow-[0_20px_60px_-35px_rgba(0,33,106,0.45)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indgreen/15 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-indgreen">
              <Sparkles size={12} />
              Drill Center
            </div>
            <h2 className="mt-3 text-3xl font-black text-indblue">Practice safely before a real scam reaches you.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-silver">
              These drills are clearly labeled simulations designed to build recognition, slower reactions, and safer follow-up behavior.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.4rem] border border-white/60 bg-white/80 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indgreen">Recent Drills</p>
              <p className="mt-2 text-2xl font-black text-indblue">{data.recent.length}</p>
            </div>
            <div className="rounded-[1.4rem] border border-white/60 bg-white/80 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indgreen">Available Scenarios</p>
              <p className="mt-2 text-2xl font-black text-indblue">{data.scenarios.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {data.scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className="rounded-[1.8rem] border border-indblue/10 bg-white p-5 shadow-[0_18px_55px_-35px_rgba(0,33,106,0.4)]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-indgreen/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-indgreen">
                      {scenario.channel}
                    </span>
                    <span className="rounded-full bg-saffron/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-saffron">
                      {scenario.risk_band}
                    </span>
                  </div>
                  <h3 className="mt-3 text-xl font-black text-indblue">{scenario.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-silver">{scenario.recommended_follow_up}</p>
                </div>
                <button
                  onClick={() => void runScenario(scenario.id)}
                  disabled={runningScenario === scenario.id}
                  className="inline-flex items-center gap-2 rounded-full bg-indblue px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-white hover:bg-indblue/90 disabled:bg-silver"
                >
                  {runningScenario === scenario.id ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                  Start Drill
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <section className="rounded-[1.8rem] border border-indblue/10 bg-white p-5 shadow-[0_18px_55px_-35px_rgba(0,33,106,0.4)]">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-indgreen" />
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indgreen">Recent Runs</p>
            </div>
            <div className="mt-4 space-y-3">
              {data.recent.length > 0 ? (
                data.recent.map((run, index) => (
                  <div key={`${run.scenario}-${index}`} className="rounded-[1.2rem] border border-silver/10 bg-boxbg px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-indblue">{run.scenario}</p>
                      <p className="text-sm font-black text-saffron">{run.readiness_score}</p>
                    </div>
                    <p className="mt-1 text-xs text-silver">
                      {run.channel} | {formatTime(run.completed_at)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-silver/20 bg-boxbg px-4 py-6 text-center">
                  <p className="text-sm font-bold text-indblue">No drill runs yet for this citizen.</p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[1.8rem] border border-indblue/10 bg-white p-5 shadow-[0_18px_55px_-35px_rgba(0,33,106,0.4)]">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-saffron" />
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-saffron">Latest Output</p>
            </div>
            <div className="mt-4">
              {latestRun ? (
                <pre className="overflow-x-auto rounded-[1.2rem] bg-boxbg p-4 text-xs text-charcoal">
                  {JSON.stringify(latestRun, null, 2)}
                </pre>
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-silver/20 bg-boxbg px-4 py-6 text-center">
                  <p className="text-sm font-bold text-indblue">Launch a drill to inspect the latest scorecard and steps.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
