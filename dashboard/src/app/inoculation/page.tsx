"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  History,
  Loader2,
  Play,
  Terminal,
  Zap,
} from "lucide-react";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";

interface Scenario {
  name: string;
  desc: string;
  steps: string[];
}

interface InoculationStats {
  citizen_resilience_index: number;
  drills_conducted_today: number;
  top_vulnerable_sector: string;
  awareness_reach: string;
  scenarios: Record<string, Scenario>;
  impact: { prevented: string; velocity: string };
}

interface DrillScorecard {
  readiness_score: number;
  completion_label: string;
  recommended_follow_up: string;
  regional_track: string;
  channel: string;
}

interface DrillHistoryItem {
  action_id: number;
  target_id?: string | null;
  action_type: string;
  status: string;
  scenario?: string | null;
  created_at?: string | null;
  scorecard?: DrillScorecard | null;
}

export default function InoculationPage() {
  const { performAction } = useActions();
  const [phone, setPhone] = useState("");
  const [scenario, setScenario] = useState("bank_kyc");
  const [isDrillRunning, setIsDrillRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [data, setData] = useState<InoculationStats | null>(null);
  const [scorecard, setScorecard] = useState<DrillScorecard | null>(null);
  const [activeDrillId, setActiveDrillId] = useState<string | null>(null);
  const [drillHistory, setDrillHistory] = useState<DrillHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/system/stats/inoculation`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error("Error fetching inoculation stats:", error);
      }
    };
    void fetchStats();
  }, []);

  const scenarioEntries = data?.scenarios ? Object.entries(data.scenarios) : [];
  const currentScenario = scenarioEntries.find(([id]) => id === scenario)?.[1];
  const displayedReadiness = scorecard?.readiness_score || data?.citizen_resilience_index || 0;

  useEffect(() => {
    if (!data?.scenarios?.[scenario] && scenarioEntries.length > 0) {
      setScenario(scenarioEntries[0][0]);
    }
  }, [data, scenario, scenarioEntries]);

  const startDrill = async () => {
    if (!phone || !data) return;

    setIsDrillRunning(true);
    setLogs([]);
    setScorecard(null);
    setActiveDrillId(null);

    void performAction("START_DRILL", phone, { scenario });

    try {
      const res = await fetch(`${API_BASE}/inoculation/drill/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          scenario,
        }),
      });

      const payload = res.ok ? await res.json() : null;
      const rawSteps = payload?.steps || data?.scenarios?.[scenario]?.steps || [];
      const steps = Array.isArray(rawSteps) ? rawSteps.filter((step): step is string => typeof step === "string" && step.trim().length > 0) : [];
      setActiveDrillId(payload?.drill_id || null);

      let step = 0;
      const interval = setInterval(() => {
        if (step < steps.length) {
          setLogs((prev) => [...prev, steps[step]]);
          step += 1;
          return;
        }

        clearInterval(interval);
        setIsDrillRunning(false);
        setScorecard(payload?.scorecard || null);
      }, 1500);
    } catch (error) {
      console.error("Drill launch failed:", error);
      setIsDrillRunning(false);
      setLogs(["[ERROR] Unable to launch drill right now."]);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchHistory = async () => {
    const res = await fetch(`${API_BASE}/inoculation/history`);
    if (res.ok) {
      const payload = await res.json();
      setDrillHistory(Array.isArray(payload?.items) ? payload.items : []);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-indblue tracking-tight">Inoculation Engine</h2>
          <p className="text-silver mt-1">Controlled scam simulations to build citizen resilience.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={async () => {
              await performAction("VIEW_HISTORY", "INOCULATION");
              await fetchHistory();
              setShowHistory((current) => !current);
            }}
            className="px-4 py-2 bg-white border border-silver/10 rounded-lg text-sm font-semibold text-charcoal hover:bg-boxbg flex items-center gap-2 transition-colors"
          >
            <History size={16} className="text-silver" />
            {showHistory ? "Hide History" : "Simulation History"}
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="bg-white rounded-2xl border border-silver/10 p-6 shadow-sm">
          <h3 className="font-bold text-indblue mb-4">Recent Drill Runs</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {drillHistory.length === 0 ? (
              <p className="text-sm text-silver">No drill history captured yet.</p>
            ) : drillHistory.map((item) => (
              <div key={item.action_id} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indblue">{item.scenario || item.action_type}</p>
                <p className="text-sm font-bold text-charcoal mt-1">{item.target_id || "Sandbox citizen"}</p>
                <p className="text-[11px] text-silver mt-2">
                  {item.created_at ? new Date(item.created_at).toLocaleString() : "Unknown time"} · {item.status}
                </p>
                {item.scorecard?.readiness_score ? (
                  <p className="text-[11px] text-indgreen mt-2 font-bold">Readiness {item.scorecard.readiness_score}%</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-silver/10 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Drills Today</p>
          <p className="text-2xl font-black text-indblue mt-2">{data?.drills_conducted_today || 0}</p>
          <p className="text-xs text-silver mt-2">Current inoculation scheduler volume across the safe sandbox.</p>
        </div>
        <div className="bg-white rounded-2xl border border-silver/10 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Resilience Index</p>
          <p className="text-2xl font-black text-indgreen mt-2">{displayedReadiness}%</p>
          <p className="text-xs text-silver mt-2">Live scorecard signal from the most recent drill outcome.</p>
        </div>
        <div className="bg-white rounded-2xl border border-silver/10 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Awareness Reach</p>
          <p className="text-2xl font-black text-saffron mt-2">{data?.awareness_reach || "0"}</p>
          <p className="text-xs text-silver mt-2">{data?.top_vulnerable_sector || "Citizen segment"} remains the highest-risk cohort.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-silver/10 p-8 shadow-sm">
            <h3 className="font-bold text-indblue mb-6 flex items-center gap-2">
              <Zap size={18} className="text-saffron" />
              Launch Training Drill
            </h3>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-silver uppercase tracking-widest">Target Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full p-4 bg-boxbg border border-silver/10 rounded-xl text-lg font-mono font-bold text-indblue outline-none focus:border-saffron/40"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-silver uppercase tracking-widest">Simulation Scenario</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scenarioEntries.map(([id, item]) => (
                    <div
                      key={id}
                      onClick={() => !isDrillRunning && setScenario(id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        scenario === id ? "border-saffron bg-saffron/5 shadow-md" : "border-silver/10 bg-white hover:border-silver/30"
                      } ${isDrillRunning ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        {id === "bank_kyc" ? (
                          <AlertTriangle size={20} className={scenario === id ? "text-saffron" : "text-silver"} />
                        ) : (
                          <CheckCircle2 size={20} className={scenario === id ? "text-saffron" : "text-silver"} />
                        )}
                        <p className="font-bold text-sm text-indblue">{item.name}</p>
                      </div>
                      <p className="text-[11px] text-silver leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 bg-boxbg rounded-2xl border border-silver/10">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Active Track</p>
                    <p className="text-sm font-bold text-indblue mt-1">{currentScenario?.name || "Select a scenario"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Drill ID</p>
                    <p className="text-sm font-mono font-bold text-charcoal mt-1">{activeDrillId || "Pending"}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-silver/5">
                <button
                  onClick={() => void startDrill()}
                  disabled={isDrillRunning || !phone}
                  className="w-full py-4 bg-saffron text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-deeporange transition-all shadow-lg shadow-saffron/20 active:scale-95 disabled:opacity-50"
                >
                  {isDrillRunning ? <Loader2 className="animate-spin" /> : <Play size={20} />}
                  {isDrillRunning ? "SIMULATION IN PROGRESS..." : "START SIMULATION DRILL"}
                </button>
                <p className="text-[10px] text-center text-silver font-medium mt-4 uppercase tracking-widest">
                  Secure sandbox active • No real charges will apply
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-charcoal p-6 rounded-2xl border border-white/5 text-white shadow-xl h-[400px] flex flex-col">
            <h4 className="font-bold mb-4 flex items-center gap-2 text-indgreen text-xs">
              <Terminal size={16} />
              Simulator Logs
            </h4>
            <div
              ref={scrollRef}
              className="flex-1 bg-black/40 rounded-xl p-4 font-mono text-[10px] space-y-2 overflow-y-auto custom-scrollbar"
            >
              {logs.length === 0 ? (
                <p className="text-silver/30 italic">Target selection required...</p>
              ) : (
                logs.map((log, index) => (
                  <p key={index} className={(typeof log === "string" && log.includes("[SCORE]")) ? "text-saffron font-bold" : "text-white"}>
                    {log}
                  </p>
                ))
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                <span className="text-silver">Readiness</span>
                <span className="text-indgreen font-mono">{displayedReadiness}%</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-silver/10 p-6">
            <h4 className="font-bold text-indblue mb-4 text-sm">Drill Scorecard</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-silver">Completion Label</span>
                <span className="font-mono font-bold text-indblue">{scorecard?.completion_label || "Awaiting run"}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-silver">Channel</span>
                <span className="font-mono font-bold text-indgreen">{scorecard?.channel || "SMS / IVR"}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-silver">Regional Track</span>
                <span className="font-mono font-bold text-charcoal">{scorecard?.regional_track || "Pilot"}</span>
              </div>
              <div className="pt-3 border-t border-silver/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-silver mb-2">Recommended Follow-up</p>
                <p className="text-xs text-charcoal leading-relaxed">
                  {scorecard?.recommended_follow_up || "Run a drill to receive follow-up coaching guidance."}
                </p>
              </div>
              <div className="pt-3 border-t border-silver/10">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-silver">Phishing Clicks Prevented</span>
                  <span className="font-mono font-bold text-indblue">{data?.impact?.prevented || "0"}</span>
                </div>
                <div className="flex justify-between items-center text-xs mt-3">
                  <span className="text-silver">Reporting Velocity</span>
                  <span className="font-mono font-bold text-indgreen">{data?.impact?.velocity || "0%"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
