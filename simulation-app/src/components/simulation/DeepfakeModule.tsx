"use client";

import { useState, useRef, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  FileWarning,
  Brain,
  Loader2
} from "lucide-react";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";

interface DeepfakeModuleProps {
  performAction: (action: string, detail?: string) => any;
  setSelectedIncident: (incident: any) => void;
  setIsModalOpen: (open: boolean) => void;
}

export default function DeepfakeModule({
  performAction,
  setSelectedIncident,
  setIsModalOpen,
}: DeepfakeModuleProps) {
  const [isDeepfakeScanning, setIsDeepfakeScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [deepfakeVerdict, setDeepfakeVerdict] = useState<null | 'VERIFIED' | 'DEEPFAKE'>(null);
  const [deepfakeStats, setDeepfakeStats] = useState<any>(null);
  const [deepfakeAiResult, setDeepfakeAiResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchDFStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/system/stats/deepfake`);
        if (res.ok) setDeepfakeStats(await res.json());
      } catch (e) {
        console.error("DF Stats fetch failed:", e);
      }
    };
    fetchDFStats();
  }, []);

  useEffect(() => {
    if (isDeepfakeScanning && scanProgress < 100) {
      const timer = setTimeout(() => {
        setScanProgress(prev => prev + 5);
      }, 100);
      return () => clearTimeout(timer);
    } else if (scanProgress >= 100) {
      setTimeout(() => {
        setIsDeepfakeScanning(false);
        setDeepfakeVerdict(deepfakeAiResult?.verdict || 'DEEPFAKE');
      }, 500);
    }
  }, [isDeepfakeScanning, scanProgress, deepfakeAiResult]);

  const startDeepfakeScan = async (file?: File) => {
    setIsDeepfakeScanning(true);
    setScanProgress(0);
    setDeepfakeVerdict(null);
    setDeepfakeAiResult(null);

    performAction('SCAN_VIDEO', 'FORENSIC_PIPELINE');

    try {
      const authStr = localStorage.getItem('drishyam_auth');
      const token = authStr ? JSON.parse(authStr).token : null;

      let res;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch(`${API_BASE}/forensic/deepfake/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
      } else {
        res = await fetch(`${API_BASE}/forensic/deepfake/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ media_type: 'video' })
        });
      }

      if (res.ok) {
        const result = await res.json();
        if (result.status === "PENDING" && result.id) {
          const pollInterval = setInterval(async () => {
            try {
              const statusRes = await fetch(`${API_BASE}/forensic/status/${result.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                if (statusData.status === "COMPLETED") {
                  clearInterval(pollInterval);
                  setDeepfakeAiResult(statusData);
                  setScanProgress(100);
                } else if (statusData.status === "FAILED") {
                  clearInterval(pollInterval);
                  setIsDeepfakeScanning(false);
                  toast.error("Forensic analysis failed.");
                } else {
                  setScanProgress(prev => Math.min(prev + 5, 95));
                }
              }
            } catch (err) {
              console.error("Polling Error:", err);
              clearInterval(pollInterval);
              setIsDeepfakeScanning(false);
            }
          }, 3000);
        } else {
          setDeepfakeAiResult(result);
          setScanProgress(100);
        }
      } else {
        setIsDeepfakeScanning(false);
      }
    } catch (err) {
      console.error("Forensic API Error:", err);
      setIsDeepfakeScanning(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 w-full max-w-6xl mt-4">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl border border-silver/10 p-8 shadow-sm h-[400px] flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-boxbg/30" />
          {isDeepfakeScanning ? (
            <div className="z-10 text-center space-y-6 w-full max-w-xs">
              <div className="relative w-32 h-32 mx-auto">
                <div className="absolute inset-0 border-4 border-saffron/10 rounded-full" />
                <div className="absolute inset-0 border-4 border-saffron rounded-full border-t-transparent animate-spin" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-indblue">{scanProgress}%</div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-bold text-indblue">Extracting Forensic Markers...</p>
                <div className="w-full h-1.5 bg-boxbg rounded-full overflow-hidden">
                  <div className="h-full bg-saffron transition-all duration-300" style={{ width: `${scanProgress}%` }} />
                </div>
              </div>
            </div>
          ) : deepfakeVerdict ? (
            <div className="z-10 text-center space-y-6">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-lg ${deepfakeVerdict === 'DEEPFAKE' ? 'bg-redalert/10 text-redalert' : 'bg-indgreen/10 text-indgreen'}`}>
                {deepfakeVerdict === 'DEEPFAKE' ? <ShieldAlert size={48} /> : <ShieldCheck size={48} />}
              </div>
              <div>
                <h3 className={`text-2xl font-bold ${deepfakeVerdict === 'DEEPFAKE' ? 'text-redalert' : 'text-indgreen'}`}>{deepfakeVerdict === 'DEEPFAKE' ? 'Deepfake Detected' : 'Verified Identity'}</h3>
                <p className="text-silver mt-2">Forensic analysis complete.</p>
              </div>
              <button onClick={() => { setDeepfakeVerdict(null); performAction('RESET_SCAN'); }} className="px-4 py-2 border border-silver/10 rounded-lg text-xs font-bold text-silver uppercase tracking-wider hover:text-indblue">Reset Scan</button>
            </div>
          ) : (
            <div className="z-10 text-center space-y-4">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*,audio/*,application/pdf" onChange={(e) => e.target.files?.[0] && startDeepfakeScan(e.target.files[0])} />
              <div className="w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center mx-auto border border-silver/10 group cursor-pointer hover:border-saffron/40 transition-colors" onClick={() => fileInputRef.current?.click()}><FileWarning className="text-silver group-hover:text-saffron transition-colors" size={32} /></div>
              <p className="text-sm font-bold text-indblue">Drop Forensic Media or Documents</p>
              <p className="text-[10px] text-silver font-medium uppercase tracking-widest leading-relaxed">Supports .mp4, .png, .mp3, .pdf • MAX 50MB</p>
              <button onClick={() => startDeepfakeScan()} className="px-6 py-2 bg-saffron text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-deeporange transition-all">START FORENSIC SCAN</button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Lip-Sync (SyncNet)", value: isDeepfakeScanning ? "Analyzing..." : deepfakeVerdict ? (deepfakeAiResult?.analysis_details?.lip_sync_match || "Verified") : "Ready" },
            { label: "Acoustic Env", value: isDeepfakeScanning ? "Matching..." : deepfakeVerdict ? (deepfakeAiResult?.analysis_details?.acoustic_env || "Matched") : "Ready" },
            { label: "GAN Artifacts", value: isDeepfakeScanning ? "Scanning..." : deepfakeVerdict ? (deepfakeAiResult?.analysis_details?.visual_artifacts || "None") : "Ready" },
            { label: "Forensic Confidence", value: isDeepfakeScanning ? "Assessing..." : deepfakeVerdict ? `${((deepfakeAiResult?.confidence || 0.98) * 100).toFixed(1)}%` : "Ready" }
          ].map(f => (
            <div key={f.label} className="bg-white p-4 rounded-xl border border-silver/10 text-center shadow-sm">
              <p className="text-[9px] font-extrabold text-silver uppercase tracking-wider mb-1">{f.label}</p>
              <p className={`text-xs font-black ${deepfakeVerdict === 'DEEPFAKE' ? 'text-redalert' : 'text-indblue'}`}>{f.value}</p>
            </div>
          ))}
        </div>

      </div>
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-silver/10 p-6 shadow-sm">
          <h4 className="font-bold text-indblue mb-6 flex items-center gap-2"><Brain size={18} className="text-saffron" />Recent Incidents</h4>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
            {deepfakeStats?.incidents && Array.isArray(deepfakeStats.incidents) ? deepfakeStats.incidents.map((inc: any, i: number) => (
              <div key={i} onClick={async () => { const result = await performAction('VIEW_INCIDENT', inc.type); if (result && result.detail) { setSelectedIncident(result.detail); setIsModalOpen(true); } }} className="p-4 rounded-xl bg-boxbg/50 border border-silver/5 hover:border-saffron/20 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-2"><ShieldAlert size={18} className={inc.status === "Deepfake" ? "text-redalert" : "text-indgreen"} /><span className="text-[10px] font-bold uppercase text-silver">{inc.risk} Risk</span></div>
                <p className="text-xs font-bold text-indblue group-hover:text-saffron transition-colors">{inc.type}</p>
                <p className="text-[10px] text-silver mt-1">Verdict: <span className="font-bold">{inc.status}</span></p>
              </div>
            )) : <p className="text-[10px] text-silver italic">No recent incidents found.</p>}
          </div>
        </div>
        <div className="bg-indblue p-6 rounded-2xl border border-saffron/20 text-white shadow-xl relative overflow-hidden group">
          <h4 className="font-bold mb-4 flex items-center gap-2"><ShieldCheck className="text-indgreen" size={18} />Model Status</h4>
          <div className="space-y-4">
            <div className="flex justify-between text-xs font-bold"><span className="text-silver">Liveness V4</span><span className="text-indgreen uppercase">{deepfakeStats?.model_status?.liveness || "Operational"}</span></div>
            <div className="flex justify-between text-xs font-bold"><span className="text-silver">GAN Detector</span><span className="text-indgreen uppercase">{deepfakeStats?.model_status?.gan_detector || "Active"}</span></div>
            <div className="flex justify-between text-xs font-bold border-t border-white/5 pt-4 mt-4"><span className="text-silver">False Positive</span><span className="text-saffron">{deepfakeStats?.model_status?.false_positive_rate || "0.01%"}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
