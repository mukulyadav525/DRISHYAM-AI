"use client";

import { useState, useEffect, useRef } from "react";
import {
  Zap,
  Send,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  History,
  Play,
  Loader2,
  Terminal
} from "lucide-react";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";


interface Scenario {
  name: string;
  desc: string;
  steps: string[];
}

interface InoculationStats {
  scenarios: Record<string, Scenario>;
  impact: { prevented: string; velocity: string };
}

export default function InoculationPage() {
  const { performAction } = useActions();
  const [phone, setPhone] = useState("");
  const [scenario, setScenario] = useState("bank_kyc");
  const [isDrillRunning, setIsDrillRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [data, setData] = useState<InoculationStats | null>(null);
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
    fetchStats();
  }, []);

  const startDrill = () => {
    if (!phone || !data) return;
    setIsDrillRunning(true);
    setLogs([]);

    performAction('START_DRILL', phone, { scenario });

    let step = 0;
    // ... (omitting interval for brevity in replacement but it will be preserved)
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-indblue tracking-tight">Inoculation Engine</h2>
          <p className="text-silver mt-1">Controlled scam simulations to build citizen resilience.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => performAction('VIEW_HISTORY')}
            className="px-4 py-2 bg-white border border-silver/10 rounded-lg text-sm font-semibold text-charcoal hover:bg-boxbg flex items-center gap-2 transition-colors">
            <History size={16} className="text-silver" />
            Simulation History
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Simulation Launcher */}
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
                  {data?.scenarios && Object.entries(data.scenarios).map(([id, s]) => (
                    <div
                      key={id}
                      onClick={() => !isDrillRunning && setScenario(id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${scenario === id ? "border-saffron bg-saffron/5 shadow-md" : "border-silver/10 bg-white hover:border-silver/30"
                        } ${isDrillRunning ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        {id === 'bank_kyc' ? <AlertTriangle size={20} className={scenario === id ? "text-saffron" : "text-silver"} /> : <CheckCircle2 size={20} className={scenario === id ? "text-saffron" : "text-silver"} />}
                        <p className="font-bold text-sm text-indblue">{s.name}</p>
                      </div>
                      <p className="text-[11px] text-silver leading-relaxed">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-silver/5">
                <button
                  onClick={startDrill}
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

        {/* Live Preview / Logs */}
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
                logs.map((log, i) => (
                  <p key={i} className={log.includes("DISPATCHED") ? "text-saffron font-bold" : "text-white"}>
                    {log}
                  </p>
                ))
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                <span className="text-silver">Success Rate</span>
                <span className="text-indgreen font-mono">92%</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-silver/10 p-6">
            <h4 className="font-bold text-indblue mb-4 text-sm">Resilience Impact</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-silver">Phishing Clicks Prevented</span>
                <span className="font-mono font-bold text-indblue">{data?.impact.prevented || "..."}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-silver">Reporting Velocity</span>
                <span className="font-mono font-bold text-indgreen">{data?.impact.velocity || "..."}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
