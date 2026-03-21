"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck,
  FileText,
  X,
  CheckCircle2,
  Signal,
  Wifi,
  Battery,
  Phone,
  MessageSquare,
  Menu,
  Globe,
  Lock,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronLeft,
  Smartphone,
  Hash,
  Activity,
  Cpu,
  Zap,
  Radio
} from "lucide-react";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

interface BharatModuleProps {
  customerId: string;
}

export default function BharatModule({
  customerId,
}: BharatModuleProps) {
  const [ussdStep, setUssdStep] = useState(0);
  const [ussdInput, setUssdInput] = useState("");
  const [reportingStep, setReportingStep] = useState(1);
  const [reportData, setReportData] = useState({
    category: "",
    scam_type: "",
    amount: "",
    platform: "",
    description: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  
  const [phoneState, setPhoneState] = useState<'HOME' | 'DIALER' | 'USSD' | 'WIZARD'>('HOME');
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleKeyPress = (key: string) => {
    if (phoneState === 'WIZARD' && reportingStep === 2) {
        if (!isNaN(Number(key))) {
            setReportData(prev => ({ ...prev, amount: prev.amount + key }));
        }
        return;
    }

    setUssdInput(prev => {
        const next = prev + key;
        if (phoneState === 'HOME') setPhoneState('DIALER');
        
        if (next === '1930' || next === '*1930#') {
          triggerReportingFlow();
          return "";
        }
        return next;
    });
  };

  const clearInput = () => {
    if (phoneState === 'WIZARD' && reportingStep === 2) {
        setReportData(prev => ({ ...prev, amount: prev.amount.slice(0, -1) }));
        return;
    }
    setUssdInput(prev => prev.slice(0, -1));
    if (ussdInput.length <= 1 && phoneState === 'DIALER') setPhoneState('HOME');
  };

  const triggerReportingFlow = () => {
    setPhoneState('WIZARD');
    setReportingStep(1);
    setUssdInput("");
  };

  const handleOkSubmit = async () => {
    if (phoneState === 'DIALER') {
      if (ussdInput === '1930' || ussdInput === '*1930#') {
        triggerReportingFlow();
      } else if (ussdInput.startsWith('*') && ussdInput.endsWith('#')) {
        setPhoneState('USSD');
        setUssdStep(1);
      } else {
        toast.error("Dial 1930 for Helpline");
        setPhoneState('HOME');
        setUssdInput("");
      }
      return;
    }

    if (phoneState === 'USSD' && ussdStep < ussdFlow.length - 1) {
      setUssdStep(prev => prev + 1);
      setUssdInput("");
    } else if (phoneState === 'USSD' && ussdStep === ussdFlow.length - 1) {
      setPhoneState('HOME');
      setUssdStep(0);
      setUssdInput("");
    }

    if (phoneState === 'WIZARD') {
        if (reportingStep === 2 && reportData.amount) setReportingStep(3);
        else if (reportingStep === 3) submitFinalReport();
    }
  };

  const ussdFlow = [
    { title: "DRISHYAM AI NODE", content: "1. Report Cyber Crime\n2. Verify UPI ID\n3. Emergency Broadcast\n4. Digital Saathi" },
    { title: "REPORT SCAM", content: "Select Scam Category:\n1. KYC/Bank Fraud\n2. Jobs/Investment\n3. Sextortion\n4. Other" },
    { title: "PROCESSING...", content: "Sending report to National Command Center..." },
    { title: "SUCCESS", content: "Case Logged Successfully.\nFIR (65B) sent via SMS." }
  ];

  const submitFinalReport = async () => {
    setIsSubmitting(true);
    try {
      const authStr = localStorage.getItem('drishyam_auth');
      const token = authStr ? JSON.parse(authStr).token : null;
      const res = await fetch(`${API_BASE}/bharat/report/comprehensive?reporter_num=${customerId}&category=${reportData.category}&scam_type=${reportData.scam_type}&amount=${reportData.amount || "0"}&platform=${reportData.platform || "Simulated"}&description=${reportData.description || "Simulated Report"}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCaseId(data.case_id);
        setReportingStep(4);
        toast.success("Cyber Incident Registered");
      }
    } catch (e) {
      toast.error("Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex bg-white items-center justify-center w-full h-[100dvh] overflow-hidden relative">
      <div className="flex flex-col lg:flex-row items-center justify-center gap-8 w-full h-full max-h-[95dvh] px-4">
        
        {/* iPhone 16 Mockup - Responsive Height */}
        <div className="relative shrink-0 flex flex-col items-center justify-center h-full max-h-[800px]">
            <div className="relative w-[340px] h-full max-h-[720px] rounded-[3.5rem] p-1.5 bg-[#f0f0f0] border-[8px] border-indblue/10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] ring-1 ring-silver/20 overflow-hidden flex flex-col">
                
                {/* Island (Interactive) */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-indblue rounded-full z-[100] flex items-center justify-center px-3 shadow-md border border-white/10">
                    <div className="flex gap-1 items-center"><div className="w-0.5 h-0.5 rounded-full bg-saffron animate-ping" /><div className="w-8 h-px bg-white/20 rounded-full" /></div>
                </div>

                {/* Inner Screen */}
                <div className="flex-1 relative flex flex-col bg-white rounded-[2.8rem] overflow-hidden border border-silver/5">
                    
                    {/* Status Bar */}
                    <div className="px-8 pt-8 pb-4 flex justify-between items-center bg-transparent z-50">
                        <div className="text-[9px] font-black text-indblue tracking-tight">{currentTime}</div>
                        <div className="flex items-center gap-1.5">
                            <Signal size={10} className="text-indblue/40" />
                            <Wifi size={10} className="text-indblue/40" />
                            <Battery size={14} className="text-indblue/40" />
                        </div>
                    </div>

                    {/* Viewport content */}
                    <div className="flex-1 relative flex flex-col overflow-hidden">
                        <AnimatePresence mode="wait">
                          {phoneState === 'HOME' && (
                            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-white to-boxbg/30">
                                <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 10 }} className="mb-10 text-indblue opacity-20"><Activity size={100} /></motion.div>
                                <h1 className="text-2xl font-black text-indblue tracking-[0.2em] mb-1">DRISHYAM</h1>
                                <p className="text-[8px] font-black text-silver uppercase tracking-[0.5em] mb-12">Security Node Active</p>
                                <div className="grid grid-cols-2 gap-4 w-full px-6">
                                    <div className="p-4 bg-white border border-silver/10 rounded-2xl shadow-sm flex flex-col items-center gap-2"><Phone size={16} className="text-indblue/40" /><span className="text-[7px] font-black uppercase text-silver">Comms</span></div>
                                    <div className="p-4 bg-white border border-silver/10 rounded-2xl shadow-sm flex flex-col items-center gap-2"><Lock size={16} className="text-indblue/40" /><span className="text-[7px] font-black uppercase text-silver">Secure</span></div>
                                </div>
                            </motion.div>
                          )}

                          {phoneState === 'DIALER' && (
                            <motion.div key="dialer" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col justify-end p-10 pb-20 bg-white">
                                <div className="text-right text-5xl font-black text-indblue tracking-tighter mb-10 overflow-hidden text-ellipsis">{ussdInput || "0"}</div>
                                <div className="flex justify-between items-center py-6 border-t border-silver/10">
                                    <button className="text-[8px] font-black text-silver uppercase tracking-widest hover:text-indblue" onClick={() => { setPhoneState('HOME'); setUssdInput(""); }}>Clear</button>
                                    <button className="px-10 py-4 bg-indgreen text-white text-[8px] font-black uppercase tracking-[0.4em] rounded-2xl shadow-lg ring-1 ring-white/10" onClick={handleOkSubmit}>Call Hub</button>
                                </div>
                            </motion.div>
                          )}

                          {phoneState === 'USSD' && (
                            <motion.div key="ussd" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-4 bg-boxbg/40 rounded-[2.5rem] border border-silver/10 flex flex-col p-8 overflow-hidden">
                                <div className="flex items-center gap-2 mb-4 text-[8px] font-black text-silver uppercase tracking-widest"><Radio size={10} className="text-indgreen" /> USSD Channel Alpha</div>
                                <div className="flex-1 bg-white/50 p-6 rounded-2xl border border-silver/5 shadow-inner overflow-hidden flex flex-col">
                                    <h3 className="text-lg font-black text-indblue mb-3">{ussdFlow[ussdStep].title}</h3>
                                    <p className="text-[11px] font-bold text-charcoal/70 whitespace-pre-wrap leading-relaxed font-mono flex-1 overflow-y-auto pr-2 scrollbar-hide">{ussdFlow[ussdStep].content}</p>
                                </div>
                                <div className="pt-6 mt-2 space-y-4 border-t border-silver/10">
                                    <div className="h-12 bg-white rounded-xl border border-silver/5 flex items-center px-4 font-mono text-saffron text-base font-black shadow-inner">❯ {ussdInput || "Wait..."}</div>
                                    <div className="flex justify-between px-2">
                                        <button className="text-[8px] font-black text-silver uppercase tracking-widest hover:text-indblue" onClick={() => { setPhoneState('HOME'); setUssdStep(0); }}>Abort</button>
                                        <button className="text-[8px] font-black text-saffron uppercase tracking-widest hover:text-indblue" onClick={handleOkSubmit}>Confirm</button>
                                    </div>
                                </div>
                            </motion.div>
                          )}

                          {phoneState === 'WIZARD' && (
                            <motion.div key="wizard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white flex flex-col overflow-hidden z-[200]">
                                <div className="bg-indblue p-8 pt-10 text-white shrink-0 shadow-lg relative">
                                    <div className="flex items-center justify-between mb-6 relative z-10">
                                        <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-saffron" /><span className="text-[9px] font-black uppercase tracking-widest opacity-80">Helpline 1930</span></div>
                                        <button onClick={() => setPhoneState('HOME')} className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-xl hover:bg-white/20 transition-all"><X size={16} /></button>
                                    </div>
                                    <div className="flex justify-between gap-1.5 mb-2 relative z-10">
                                      {[1, 2, 3, 4].map(s => (<div key={s} className={`flex-1 h-0.5 rounded-full transition-all duration-700 ${reportingStep >= s ? 'bg-saffron' : 'bg-white/10'}`} />))}
                                    </div>
                                    <h2 className="text-base font-black tracking-tight mt-2 relative z-10">{reportingStep === 1 ? 'Step 1: Category' : reportingStep === 2 ? 'Step 2: Details' : reportingStep === 3 ? 'Step 3: Verification' : 'Protocol Resolved'}</h2>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-8 space-y-3 scrollbar-hide bg-boxbg/10">
                                    {reportingStep === 1 && (
                                        <motion.div className="space-y-2">
                                            {['Financial Fraud', 'Impersonation', 'Identity Theft', 'Social Media'].map((cat, i) => (
                                                <button key={cat} onClick={() => { setReportData({...reportData, category: cat}); setReportingStep(2); }} className="w-full px-6 py-4 bg-white border border-silver/5 rounded-2xl text-left shadow-sm hover:shadow-md hover:border-saffron/30 transition-all group flex justify-between items-center"><span className="text-[11px] font-bold text-indblue">{cat}</span><ChevronRight size={14} className="text-silver group-hover:text-saffron transition-colors" /></button>
                                            ))}
                                        </motion.div>
                                    )}
                                    {reportingStep === 2 && (
                                        <div className="space-y-4">
                                            <div className="space-y-1.5"><label className="text-[8px] font-black text-silver uppercase tracking-widest ml-1">Monetary Impact</label><div className="relative"><span className="absolute left-6 top-1/2 -translate-y-1/2 text-lg font-black text-silver/40">₹</span><input type="text" readOnly placeholder="0" value={reportData.amount} className="w-full pl-10 p-4 bg-white border border-silver/10 rounded-2xl text-xl font-black text-indblue shadow-inner outline-none transition-all " /></div><p className="text-[7px] font-bold text-silver italic ml-1">Input using tactical keypad on right.</p></div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {['Telegram', 'WhatsApp', 'Instagram', 'Other'].map(plat => (
                                                    <button key={plat} onClick={() => setReportData({...reportData, platform: plat})} className={`py-4 rounded-xl border transition-all font-black text-[8px] uppercase tracking-widest ${reportData.platform === plat ? 'bg-indblue text-white border-indblue' : 'bg-white border-silver/10 text-silver'}`}>{plat}</button>
                                                )) }
                                            </div>
                                            <button onClick={() => setReportingStep(3)} className="w-full py-4 bg-indblue text-white rounded-xl text-[9px] font-black uppercase tracking-[0.4em] shadow-xl mt-4">Next Step</button>
                                        </div>
                                    )}
                                    {reportingStep === 3 && (
                                        <div className="space-y-4">
                                            <div className="bg-white p-6 rounded-2xl border border-silver/10 space-y-3 shadow-sm relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-4 opacity-5"><FileText size={50} /></div>
                                                <div className="flex justify-between items-center border-b border-boxbg pb-2"><span className="text-[7px] font-black text-silver uppercase">Type</span><span className="text-xs font-black text-indblue">{reportData.category}</span></div>
                                                <div className="flex justify-between items-center border-b border-boxbg pb-2"><span className="text-[7px] font-black text-silver uppercase">Loss</span><span className="text-base font-black text-saffron">₹{reportData.amount}</span></div>
                                                <div className="flex justify-between items-center"><span className="text-[7px] font-black text-silver uppercase">Platform</span><span className="text-xs font-black text-indblue">{reportData.platform}</span></div>
                                            </div>
                                            <button onClick={submitFinalReport} disabled={isSubmitting} className="w-full py-5 bg-saffron text-white rounded-xl text-[9px] font-black uppercase tracking-[0.4em] shadow-2xl hover:brightness-105 active:scale-95 transition-all text-center">{isSubmitting ? 'ENCRYPTING...' : 'ELECTRONIC SUBMIT'}</button>
                                        </div>
                                    )}
                                    {reportingStep === 4 && (
                                        <div className="text-center py-6 px-4 flex flex-col items-center">
                                            <div className="w-16 h-16 bg-indgreen/10 rounded-full flex items-center justify-center text-indgreen mb-6 shadow-inner"><CheckCircle2 size={32} /></div>
                                            <h3 className="text-xl font-black text-indblue mb-2">Protocol Logged</h3>
                                            <div className="px-5 py-2.5 bg-indblue text-white rounded-xl mb-8 shadow-md"><p className="text-[9px] font-black uppercase tracking-widest">ID: {caseId}</p></div>
                                            <p className="text-[9px] text-silver font-bold uppercase tracking-widest max-w-[160px] mx-auto leading-relaxed mb-10">Routed via Bharat Tunnel #404-Alpha.</p>
                                            <button onClick={() => setPhoneState('HOME')} className="w-full py-4 bg-charcoal text-white rounded-xl text-[8px] font-black uppercase tracking-widest shadow-xl">Disconnect Hub</button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                    </div>

                    {/* Bottom Pill */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-indblue/10 rounded-full" />
                </div>
            </div>
        </div>

        {/* Tactical Keypad Module - Responsive Scaling */}
        <div className="flex flex-col gap-6 w-full max-w-[280px] shrink-0 h-full max-h-[720px] justify-center scale-95 lg:scale-100">
            
            {/* Control Panel Header */}
            <div className="bg-white rounded-[2rem] p-5 border border-silver/10 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5"><Cpu size={60} /></div>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-boxbg rounded-xl border border-silver/5"><ShieldCheck size={14} className="text-indblue" /></div>
                    <div>
                        <h4 className="text-[9px] font-black text-indblue uppercase tracking-widest">ICU Console</h4>
                        <div className="flex items-center gap-1 mt-0.5"><div className="w-1 h-1 bg-indgreen rounded-full animate-pulse" /><span className="text-[7px] font-bold text-silver uppercase">Link Active</span></div>
                    </div>
                </div>
            </div>

            {/* Hardware Keypad Mockup */}
            <div className="bg-white rounded-[2.5rem] p-7 border border-silver/15 shadow-2xl flex flex-col items-center relative gap-6">
                
                {/* Central Select Wheel */}
                <div className="relative w-20 h-20 rounded-full bg-white border-2 border-silver/5 shadow-inner flex items-center justify-center ring-4 ring-boxbg/30">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={handleOkSubmit} className="w-14 h-14 bg-indblue text-white rounded-full shadow-2xl border-2 border-white/20 flex items-center justify-center font-black text-xs cursor-pointer hover:bg-indblue/90 transition-all z-10">OK</motion.button>
                    <ArrowUp size={10} className="absolute top-0.5 text-silver/20" />
                    <ArrowDown size={10} className="absolute bottom-0.5 text-silver/20" />
                    <ChevronLeft size={10} className="absolute left-0.5 text-silver/20" />
                    <ChevronRight size={10} className="absolute right-0.5 text-silver/20" />
                </div>

                {/* Grid Layout */}
                <div className="grid grid-cols-3 gap-2.5 w-full">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(key => (
                        <button key={key} onClick={() => handleKeyPress(key)} className="relative h-14 bg-white rounded-xl border border-silver/10 shadow-sm hover:shadow-md hover:border-indblue/10 active:scale-95 transition-all flex flex-col items-center justify-center group overflow-hidden">
                            <span className="text-xl font-black text-indblue/60 group-hover:text-indblue group-hover:scale-105 transition-all">{key}</span>
                            <span className="text-[6px] font-black text-silver/40 uppercase mt-0.5 tracking-tighter">{key === '1' ? 'abc' : key === '2' ? 'def' : key === '3' ? 'ghi' : key === '4' ? 'jkl' : key === '5' ? 'mno' : key === '6' ? 'pqrs' : key === '7' ? 'tuv' : key === '8' ? 'wxyz' : ''}</span>
                        </button>
                    ))}
                </div>

                {/* Panel Buttons */}
                <div className="grid grid-cols-2 gap-2.5 w-full pt-4 border-t border-silver/5">
                    <button className="py-3.5 bg-boxbg/50 rounded-xl flex items-center justify-center font-black text-[7px] text-silver uppercase tracking-widest hover:text-redalert transition-all" onClick={clearInput}>Clear</button>
                    <button className="py-3.5 bg-boxbg/50 rounded-xl flex items-center justify-center font-black text-[7px] text-silver uppercase tracking-widest hover:text-indblue transition-all" onClick={() => phoneState === 'HOME' ? setUssdInput("*#06#") : setPhoneState('HOME')}>Return</button>
                </div>
            </div>

            {/* Version ID */}
            <p className="text-center text-[7px] font-black text-silver/20 uppercase tracking-[0.4em]">Node Protocol Alpha 2.4.1</p>
        </div>

      </div>
    </div>
  );
}
