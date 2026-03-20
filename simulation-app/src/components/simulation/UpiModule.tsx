"use client";

import { useState, useEffect } from "react";
import {
  Zap,
  ShieldCheck,
  ShieldAlert,
  Search,
  QrCode,
  MessageSquare,
  Loader2,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";

interface UpiModuleProps {
  performAction: (action: string, detail?: string) => any;
}

export default function UpiModule({
  performAction,
}: UpiModuleProps) {
  const [activeUpiTab, setActiveUpiTab] = useState<'lookup' | 'qr' | 'message'>('lookup');
  const [upiId, setUpiId] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [messageText, setMessageText] = useState("");
  const [isMessageScanning, setIsMessageScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [qrScanning, setQrScanning] = useState(false);
  const [forensicResult, setForensicResult] = useState<any>(null);
  const [upiStats, setUpiStats] = useState<any>(null);

  useEffect(() => {
    const fetchUPIStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/upi/stats`);
        if (res.ok) setUpiStats(await res.json());
      } catch (e) {
        console.error("UPI Stats fetch failed:", e);
      }
    };
    fetchUPIStats();
  }, []);

  const handleLookup = async () => {
    if (!upiId) return;
    setIsLookingUp(true);
    setLookupResult(null);
    performAction('VPA_LOOKUP', upiId);

    try {
      const res = await fetch(`${API_BASE}/upi/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vpa: upiId })
      });
      if (res.ok) {
        setLookupResult(await res.json());
      }
    } catch (e) {
      console.error("Lookup failed:", e);
      toast.error("NPCI Gateway Timeout");
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleHardBlock = async () => {
    if (!upiId) return;
    const confirm = window.confirm("NPCI DIRECTIVE: Are you sure you want to enforce a network-wide block on this VPA?");
    if (!confirm) return;

    try {
      const res = await fetch(`${API_BASE}/upi/npci/direct-block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vpa: upiId, reason: "Manual Forensic Identification" })
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`NPCI Block Enforced: ${data.npci_ref}`);
        handleLookup(); // Refresh status
      }
    } catch (e) {
      toast.error("Block operation failed");
    }
  };

  const handleMessageScan = async () => {
    if (!messageText) return;
    setIsMessageScanning(true);
    setScanResult(null);

    try {
      const res = await fetch(`${API_BASE}/upi/scan-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText })
      });
      if (res.ok) {
        setScanResult(await res.json());
      }
    } catch (error) {
      console.error("Error scanning message:", error);
    } finally {
      setIsMessageScanning(false);
    }
  };

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setQrScanning(true);
    setForensicResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/upi/scan-qr`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setForensicResult(data);
        performAction('SCAN_QR', data.is_safe === false ? 'MALICIOUS_QR_FOUND' : 'SAFE_QR_SCANNED');
      }
    } catch (err) {
      console.error("QR Scan failed:", err);
    } finally {
      setQrScanning(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-6xl mt-4">
      {/* Tabs */}
      <div className="flex flex-wrap bg-boxbg p-1 rounded-xl border border-silver/10 self-start w-fit mx-auto gap-1">
        {[
          { id: 'lookup', label: 'Risk Lookup' },
          { id: 'qr', label: 'QR Forensic' },
          { id: 'message', label: 'Message Scanner' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveUpiTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeUpiTab === tab.id ? 'bg-white shadow-sm text-indblue' : 'text-silver hover:text-charcoal'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 w-full">
        {/* Left Panel */}
        <div className="lg:col-span-8 space-y-6">
          {activeUpiTab === 'lookup' && (
            <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Search size={120} />
              </div>
              <h3 className="text-xl font-bold text-indblue mb-6">Real-Time VPA Reputation</h3>
              <div className="space-y-4 relative z-10">
                <div className="p-1 bg-boxbg rounded-2xl border border-silver/10 flex items-center focus-within:border-saffron/50 transition-colors">
                  <div className="pl-4 text-silver"><Zap size={18} /></div>
                  <input type="text" placeholder="Enter VPA (e.g., citizen@upi)" className="w-full bg-transparent p-4 text-sm font-bold text-indblue outline-none placeholder:text-silver/50" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
                  <button onClick={handleLookup} disabled={isLookingUp} className="bg-indblue text-white px-6 py-3 rounded-xl m-1 text-xs font-bold uppercase tracking-widest hover:bg-saffron transition-all disabled:opacity-50">{isLookingUp ? "Verifying..." : "Check"}</button>
                </div>
                {lookupResult && (
                  <div className={`p-6 rounded-2xl border ${lookupResult.is_flagged ? 'bg-red-50 border-red-200' : 'bg-indgreen/5 border-indgreen/20'} animate-in fade-in slide-in-from-top-4 duration-500`}>
                    <div className="flex gap-4 items-start">
                      <div className={`p-3 rounded-full ${lookupResult.is_flagged ? 'bg-redalert text-white' : 'bg-indgreen text-white'}`}>{lookupResult.is_flagged ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className={`font-bold ${lookupResult.is_flagged ? 'text-redalert' : 'text-indgreen'}`}>{lookupResult.is_flagged ? "High Risk Signature Detected" : "VPA Verified Safe"}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${lookupResult.npci_status === 'ACTIVE' ? 'bg-indgreen/20 text-indgreen' : 'bg-red-200 text-redalert'}`}>NPCI: {lookupResult.npci_status}</span>
                        </div>
                        <p className="text-xs text-charcoal mt-1 leading-relaxed font-bold uppercase">{lookupResult.bank_name || "Unknown Bank"}</p>
                        <p className="text-[10px] text-silver mt-2 leading-relaxed">{lookupResult.reason}</p>
                        
                        {lookupResult.is_flagged && (
                          <div className="mt-4 flex gap-2">
                            <button 
                              onClick={handleHardBlock}
                              className="bg-redalert text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-charcoal transition-all shadow-md"
                            >
                              Enforce NPCI Hard Block
                            </button>
                            <button 
                              onClick={() => toast.success("NPCI Dispute Grievance Generated")}
                              className="bg-white border border-silver/20 text-charcoal px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-boxbg transition-all"
                            >
                              Generate Grievance
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeUpiTab === 'qr' && (
            <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm text-center">
              <div className={`w-20 h-20 bg-boxbg rounded-2xl flex items-center justify-center mx-auto mb-4 border ${qrScanning ? 'border-indblue animate-pulse' : 'border-silver/5'}`}><QrCode className={qrScanning ? 'text-indblue animate-bounce' : 'text-saffron'} size={40} /></div>
              <h3 className="text-xl font-bold text-indblue mb-2">QR Forensic Analysis</h3>
              <p className="text-silver text-sm max-w-sm mx-auto mb-8 italic">Analyzing destination overlay before payment initiation.</p>
              {!qrScanning && !forensicResult && (
                <label className="cursor-pointer bg-indblue text-white px-8 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-saffron transition-all inline-block shadow-lg">Upload QR Image<input type="file" className="hidden" accept="image/*" onChange={handleQRUpload} /></label>
              )}
              {qrScanning && <div className="inline-flex items-center gap-3 text-indblue text-xs font-bold uppercase tracking-widest"><Loader2 className="animate-spin" size={16} /> Processing QR...</div>}
              {forensicResult && !qrScanning && (
                <div className="mt-6 text-left p-6 rounded-2xl border bg-boxbg/50">
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`p-3 rounded-full ${forensicResult.is_safe ? 'bg-indgreen text-white' : 'bg-redalert text-white'}`}>{forensicResult.is_safe ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}</div>
                    <div className="w-full">
                      <h4 className={`font-bold ${forensicResult.is_safe ? 'text-indgreen' : 'text-redalert'}`}>{forensicResult.is_safe ? "Safe QR Destination" : "Malicious QR Detected"}</h4>
                      <div className="mt-2 text-[10px] font-mono bg-white/50 p-3 rounded border border-silver/10 break-all">{forensicResult.payload}</div>
                    </div>
                  </div>
                  <button onClick={() => setForensicResult(null)} className="text-[10px] font-black text-indblue uppercase tracking-widest">Scan Alternative QR</button>
                </div>
              )}
            </div>
          )}

          {activeUpiTab === 'message' && (
            <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
              <h3 className="text-xl font-bold text-indblue mb-6 flex items-center gap-2"><MessageSquare className="text-saffron" size={20} /> Pattern Scanner</h3>
              <textarea className="w-full p-4 bg-boxbg border border-silver/10 rounded-2xl text-sm text-charcoal outline-none focus:border-saffron/40 resize-none min-h-[120px]" placeholder="Paste suspicious WhatsApp message..." value={messageText} onChange={(e) => setMessageText(e.target.value)} />
              <button onClick={handleMessageScan} disabled={isMessageScanning || !messageText} className="mt-4 bg-indblue text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-charcoal transition-all disabled:opacity-50 flex items-center gap-2">{isMessageScanning && <Loader2 size={14} className="animate-spin" />}{isMessageScanning ? "Scanning..." : "Analyze Patterns"}</button>
              {scanResult && (
                <div className={`mt-6 p-6 rounded-2xl border ${scanResult.verdict === 'SAFE' ? 'bg-indgreen/5 border-indgreen/20' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${scanResult.verdict === 'SAFE' ? 'bg-indgreen' : 'bg-redalert'}`}>{scanResult.verdict === 'SAFE' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}</div>
                    <div>
                      <p className={`text-xs font-bold uppercase ${scanResult.verdict === 'SAFE' ? 'text-indgreen' : 'text-redalert'}`}>{scanResult.verdict === 'SAFE' ? 'Safe Communication' : `Fraud Probability: ${scanResult.confidence}%`}</p>
                      <p className="text-[10px] text-charcoal font-bold mt-1">Pattern: {scanResult.pattern_detected}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-indblue p-6 rounded-3xl border border-saffron/20 shadow-xl text-white">
            <h4 className="font-bold text-sm mb-4 border-b border-white/10 pb-2 uppercase tracking-tighter">UPI Shield Stats</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div><p className="text-[9px] uppercase font-bold text-silver">VPA Checks (24h)</p><p className="text-2xl font-bold">{upiStats?.dashboard?.vpa_checks_24h || "1.2k"}</p></div>
                <div className="text-right"><p className="text-[9px] uppercase font-bold text-indgreen">Flags</p><p className="text-lg font-bold">{upiStats?.dashboard?.flags || "14"}</p></div>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-saffron h-full" style={{ width: `${upiStats?.dashboard?.vpa_risk_percent || 15}%` }} />
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
            <h4 className="font-bold text-indblue text-xs mb-4 uppercase tracking-widest">Threat Feed</h4>
            <div className="space-y-3">
              {(upiStats?.threat_feed || [{ type: 'ID_COLLECT', risk: 'High', time: '2m ago' }, { type: 'QR_OVERLAY', risk: 'Medium', time: '15m ago' }]).slice(0, 3).map((threat: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-boxbg rounded-xl border border-silver/5">
                  <div><p className="text-[9px] font-black text-indblue uppercase">{threat.type}</p><p className="text-[8px] text-silver font-bold uppercase">{threat.time}</p></div>
                  <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase ${threat.risk === 'High' ? 'bg-red-100 text-redalert' : 'bg-orange-100 text-saffron'}`}>{threat.risk}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
