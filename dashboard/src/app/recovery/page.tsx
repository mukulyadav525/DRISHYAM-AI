"use client";

import { useState, useRef, useEffect } from "react";
import {
  RotateCcw,
  FileText,
  ShieldCheck,
  Clock,
  ArrowRight,
  Download,
  History,
  AlertCircle,
  CheckCircle2,
  Building2,
  Scale,
  LifeBuoy,
  ExternalLink,
  Loader2
} from "lucide-react";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";

export default function RecoveryPage() {
  const { performAction, downloadSimulatedFile } = useActions();
  const [step, setStep] = useState(1);
  const [scamType, setScamType] = useState("");
  const [txnId, setTxnId] = useState("");
  const [txnDate, setTxnDate] = useState("");
  const [bankName, setBankName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [activeCases, setActiveCases] = useState<any[]>([]);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const res = await fetch(`${API_BASE}/system/stats/agency`);
        if (res.ok) {
          const data = await res.json();
          // Use police cases as sample active cases for tracking
          setActiveCases(data.police.cases.slice(0, 3));
        }
      } catch (e) {
        console.error("Failed to fetch cases:", e);
      }
    };
    fetchCases();
  }, []);

  const handleNext = () => setStep(s => s + 1);

  const generateLetters = () => {
    setIsGenerating(true);
    performAction('GENERATE_RECOVERY_BUNDLE', scamType, {
      txn_id: txnId,
      txn_date: txnDate,
      bank_name: bankName,
      scam_type: scamType
    });
    setTimeout(() => {
      setIsGenerating(false);
      setShowResults(true);
      toast.success("Recovery bundle generated successfully");
    }, 2000);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-indblue tracking-tight">Post-Scam Recovery Companion</h2>
        <p className="text-silver mt-1 italic font-medium">Citizen roadmap for financial & legal restoration.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Panel: Recovery Roadmap / Intake */}
        <div className="lg:col-span-8 space-y-6">
          {!showResults ? (
            <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm min-h-[500px] flex flex-col">
              {/* Progres Tracker */}
              <div className="flex gap-2 mb-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${step >= i ? 'bg-saffron' : 'bg-boxbg'}`} />
                ))}
              </div>

              <div className="flex-1 space-y-8 animate-in fade-in duration-500">
                {step === 1 && (
                  <div className="space-y-6">
                    <h3 className="text-2xl font-bold text-indblue">Step 1: Incident Classification</h3>
                    <p className="text-silver text-sm">Select the type of fraud occurred to generate appropriate legal templates.</p>
                    <div className="grid grid-cols-2 gap-4">
                      {['UPI Collect Trap', 'Investment Scam', 'Job Fraud', 'Deepfake Identity'].map((type) => (
                        <button
                          key={type}
                          onClick={() => setScamType(type)}
                          className={`p-6 rounded-2xl border text-left transition-all ${scamType === type ? 'border-saffron bg-saffron/5 shadow-sm' : 'border-silver/10 hover:border-silver/30'}`}
                        >
                          <p className={`font-bold text-sm ${scamType === type ? 'text-saffron' : 'text-indblue'}`}>{type}</p>
                          <p className="text-[10px] text-silver mt-1 font-medium italic">Standard Procedure Available</p>
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
                      We will automatically generate legal-compliant letters for NPCI, the RBI Ombudsman, and your home bank branch.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-auto pt-8 flex justify-between">
                {step > 1 && (
                  <button onClick={() => setStep(s => s - 1)} className="px-6 py-3 text-xs font-bold text-silver hover:text-charcoal uppercase tracking-widest transition-colors">Back</button>
                )}
                <button
                  onClick={step === 3 ? generateLetters : handleNext}
                  disabled={step === 1 && !scamType || isGenerating}
                  className={`ml-auto bg-indblue text-white px-8 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-saffron transition-all flex items-center gap-2 ${isGenerating ? 'opacity-50' : ''}`}
                >
                  {isGenerating ? "Processing AI templates..." : (step === 3 ? "Generate Bundle" : "Continue to Details")}
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
                  <p className="text-white/80 text-sm mt-1">Generated legal documents based on Section 65B IT Act guidelines.</p>
                </div>
                <button
                  onClick={() => downloadSimulatedFile('RESTITUTION_BUNDLE', 'zip')}
                  className="ml-auto bg-white text-indgreen px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-boxbg transition-all">Download All (.zip)</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { target: 'RBI Ombudsman', desc: 'Official Appeal for Transaction Reversal', icon: Scale, file: 'RBI_APPEAL' },
                  { target: 'Home Bank (Branch Mgr)', desc: 'Immediate Freeze & Chargeback Request', icon: Building2, file: 'BANK_FREEZE_REQ' },
                  { target: 'NPCI Grievance', desc: 'VPA Reputation Block & UPI Flagging', icon: AlertCircle, file: 'NPCI_GRIEVANCE' }
                ].map((doc, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-silver/10 shadow-sm hover:border-saffron/30 transition-all flex flex-col justify-between">
                    <div>
                      <doc.icon className="text-saffron mb-3" size={20} />
                      <h4 className="font-bold text-indblue text-sm">{doc.target}</h4>
                      <p className="text-[11px] text-silver mt-1">{doc.desc}</p>
                    </div>
                    <button
                      onClick={() => downloadSimulatedFile(doc.file, 'pdf')}
                      className="flex items-center gap-2 text-[10px] font-bold text-indblue uppercase mt-4 hover:text-saffron">
                      <Download size={14} /> Download .PDF
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Tracking & Resources */}
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
                      <div className={`w-1.5 h-1.5 rounded-full ${c.status === 'PENDING' ? 'bg-saffron' : 'bg-indgreen'}`} />
                      <span className="text-[8px] font-black text-silver/60 uppercase">{c.status}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-silver italic">No active cases tracked.</p>
              )}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full mt-6 py-2 bg-boxbg rounded-xl text-[10px] font-bold text-silver uppercase hover:text-charcoal transition-all"
            >
              Refresh Registry
            </button>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-silver/10 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <LifeBuoy className="text-saffron" size={20} />
              <h4 className="font-bold text-indblue text-sm">Support Ecosystem</h4>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  performAction('SUPPORT_TOOL', 'LEGAL_AID');
                  window.open('https://www.cybercrime.gov.in/', '_blank');
                }}
                className="w-full p-4 bg-boxbg rounded-2xl border border-silver/5 text-left hover:border-saffron transition-all">
                <p className="text-xs font-bold text-indblue flex items-center justify-between">
                  Legal Aid Referral
                  <ExternalLink size={14} className="opacity-40" />
                </p>
                <p className="text-[10px] text-silver mt-1">Connect with the official National Cyber Crime Reporting Portal.</p>
              </button>
              <button
                onClick={() => {
                  performAction('SUPPORT_TOOL', 'MENTAL_HEALTH');
                  window.open('https://nimhans.ac.in/psw-services/cyber-psychology-clinic/', '_blank');
                }}
                className="w-full p-4 bg-boxbg rounded-2xl border border-silver/5 text-left hover:border-saffron transition-all">
                <p className="text-xs font-bold text-indblue flex items-center justify-between">
                  Mental Health Helpline
                  <ExternalLink size={14} className="opacity-40" />
                </p>
                <p className="text-[10px] text-silver mt-1">Specialized NIMHANS support for cybercrime survivors.</p>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
