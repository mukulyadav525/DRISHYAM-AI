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
  Radio,
  Banknote,
  UserRound,
  IdCard,
  Hash as HashIcon,
  AlertCircle,
  Link as LinkIcon,
  Search,
  Key
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
    amount: "",
    platform: "",
    description: "",
    // Contextual fields
    bank_name: "",
    impersonated_name: "",
    id_type: "",
    leak_location: "",
    handle_link: "",
    // Contextual Step 3 fields
    utr_id: "",
    fake_handle: "",
    pii_details: "",
    scam_link: ""
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
    if (phoneState === 'WIZARD' && reportingStep === 2 && reportData.category === 'Financial Fraud') {
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
    if (phoneState === 'WIZARD' && reportingStep === 2 && reportData.category === 'Financial Fraud') {
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
        if (reportingStep === 2) setReportingStep(3);
        else if (reportingStep === 3) setReportingStep(4);
        else if (reportingStep === 4) submitFinalReport();
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
      const res = await fetch(`${API_BASE}/bharat/report/comprehensive?reporter_num=${customerId}&category=${reportData.category}&amount=${reportData.amount || "0"}&platform=${reportData.platform || "Simulated"}&description=${reportData.description || "Simulated Report"}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCaseId(data.case_id);
        setReportingStep(5);
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
        
        {/* iPhone 16 Mockup */}
        <div className="relative shrink-0 flex flex-col items-center justify-center h-full max-h-[800px]">
            <div className="relative w-[340px] h-full max-h-[740px] rounded-[3.5rem] p-1.5 bg-[#f0f0f0] border-[8px] border-indblue/10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] ring-1 ring-silver/20 overflow-hidden flex flex-col">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-indblue rounded-full z-[100] flex items-center justify-center px-3 shadow-md border border-white/10">
                    <div className="flex gap-1 items-center"><div className="w-0.5 h-0.5 rounded-full bg-saffron animate-ping" /><div className="w-8 h-px bg-white/20 rounded-full" /></div>
                </div>

                <div className="flex-1 relative flex flex-col bg-white rounded-[2.8rem] overflow-hidden border border-silver/5">
                    <div className="px-8 pt-8 pb-4 flex justify-between items-center bg-transparent z-50">
                        <div className="text-[9px] font-black text-indblue tracking-tight">{currentTime}</div>
                        <div className="flex items-center gap-1.5">
                            <Signal size={10} className="text-indblue/40" />
                            <Wifi size={10} className="text-indblue/40" />
                            <Battery size={14} className="text-indblue/40" />
                        </div>
                    </div>

                    <div className="flex-1 relative flex flex-col overflow-hidden">
                        <AnimatePresence mode="wait">
                          {phoneState === 'HOME' && (
                            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-white to-boxbg/30">
                                <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 10 }} className="mb-10 text-indblue opacity-20"><Activity size={100} /></motion.div>
                                <h1 className="text-2xl font-black text-indblue tracking-[0.2em] mb-1 uppercase">DRISHYAM</h1>
                                <p className="text-[8px] font-black text-silver uppercase tracking-[0.5em] mb-12">Security Node Active</p>
                                <div className="grid grid-cols-2 gap-4 w-full px-6 text-silver">
                                    <div className="p-4 bg-white border border-silver/10 rounded-2xl shadow-sm flex flex-col items-center gap-2"><Phone size={16} /><span className="text-[7px] font-black uppercase">Comms</span></div>
                                    <div className="p-4 bg-white border border-silver/10 rounded-2xl shadow-sm flex flex-col items-center gap-2"><Lock size={16} /><span className="text-[7px] font-black uppercase">Secure</span></div>
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
                                <div className="bg-indblue p-6 pt-10 text-white shrink-0 shadow-lg relative">
                                    <div className="flex items-center justify-between mb-4 relative z-10">
                                        <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-saffron" /><span className="text-[8px] font-black uppercase tracking-widest opacity-80">Helpline 1930</span></div>
                                        <button onClick={() => setPhoneState('HOME')} className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-xl hover:bg-white/20 transition-all"><X size={14} /></button>
                                    </div>
                                    <div className="flex justify-between gap-1 mb-2 relative z-10">
                                      {[1, 2, 3, 4].map(s => (<div key={s} className={`flex-1 h-0.5 rounded-full transition-all duration-700 ${reportingStep >= s ? 'bg-saffron' : 'bg-white/10'}`} />))}
                                    </div>
                                    <h2 className="text-sm font-black tracking-tight mt-1 relative z-10 uppercase italic">{reportData.category || "Select Issue"}</h2>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-hide bg-boxbg/5">
                                    {reportingStep === 1 && (
                                        <div className="space-y-2">
                                            {['Financial Fraud', 'Impersonation', 'Identity Theft', 'Social Media'].map((cat, i) => (
                                                <button key={cat} onClick={() => { setReportData({...reportData, category: cat}); setReportingStep(2); }} className="w-full px-5 py-3.5 bg-white border border-silver/10 rounded-xl text-left shadow-sm hover:shadow-md hover:border-saffron/30 transition-all group flex justify-between items-center"><span className="text-[10px] font-black text-indblue/80">{cat}</span><ChevronRight size={14} className="text-silver group-hover:text-saffron" /></button>
                                            ))}
                                        </div>
                                    )}

                                    {reportingStep === 2 && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                                            <div className="flex items-center gap-2 mb-2"><div className="w-5 h-5 rounded-full bg-indblue flex items-center justify-center text-white text-[10px]">2</div><p className="text-[8px] font-black text-indblue uppercase tracking-widest">Initial Incident Data</p></div>
                                            
                                            {reportData.category === 'Financial Fraud' && (
                                                <div className="space-y-3">
                                                    <div className="space-y-1"><label className="text-[7px] font-black text-silver uppercase ml-1 flex items-center gap-1"><Banknote size={8} /> Loss (INR)</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-silver/40">₹</span><input type="text" readOnly value={reportData.amount} className="w-full pl-8 p-3 bg-white border border-silver/10 rounded-xl text-lg font-black text-indblue shadow-inner" /></div><p className="text-[6px] font-bold text-silver italic ml-1">Use tactile keypad.</p></div>
                                                    <div className="space-y-1"><label className="text-[7px] font-black text-silver uppercase ml-1">Affected Bank Name</label><input type="text" placeholder="e.g. HDFC, SBI" value={reportData.bank_name} onChange={(e) => setReportData({...reportData, bank_name: e.target.value})} className="w-full p-3 bg-white border border-silver/10 rounded-xl text-[10px] font-black text-indblue outline-none border-focus:border-indblue/40" /></div>
                                                </div>
                                            )}

                                            {reportData.category === 'Impersonation' && (
                                                <div className="space-y-3">
                                                    <div className="space-y-1"><label className="text-[7px] font-black text-silver uppercase ml-1 flex items-center gap-1"><Globe size={8} /> Platform</label><input type="text" placeholder="Instagram, LinkedIn, etc." value={reportData.platform} onChange={(e) => setReportData({...reportData, platform: e.target.value})} className="w-full p-3 bg-white border border-silver/10 rounded-xl text-[10px] font-black text-indblue outline-none" /></div>
                                                    <div className="space-y-1"><label className="text-[7px] font-black text-silver uppercase ml-1 flex items-center gap-1"><UserRound size={8} /> Target Entity</label><input type="text" placeholder="Name or Organization Being Fake" value={reportData.impersonated_name} onChange={(e) => setReportData({...reportData, impersonated_name: e.target.value})} className="w-full p-3 bg-white border border-silver/10 rounded-xl text-[10px] font-black text-indblue outline-none" /></div>
                                                </div>
                                            )}

                                            {reportData.category === 'Identity Theft' && (
                                                <div className="space-y-3">
                                                    <div className="space-y-1"><label className="text-[7px] font-black text-silver uppercase ml-1 flex items-center gap-1"><IdCard size={8} /> Compromised ID</label><select value={reportData.id_type} onChange={(e) => setReportData({...reportData, id_type: e.target.value})} className="w-full p-3 bg-white border border-silver/10 rounded-xl text-[10px] font-black text-indblue outline-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27 fill=%27none%27 viewBox=%270 0 24 24%27 stroke=%27%23cbd5e1%27%3E%3Cpath stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%272%27 d=%27m19 9-7 7-7-7%27%2F%3E%3C%2Fsvg%3E')] bg-[length:1rem_1rem] bg-[right_0.75rem_center] bg-no-repeat appearance-none"><option value="">Select Primary ID</option><option value="Aadhaar">Aadhaar Card</option><option value="PAN">PAN Card</option><option value="Passport">Passport</option><option value="Driving License">DL</option></select></div>
                                                    <div className="space-y-1"><label className="text-[7px] font-black text-silver uppercase ml-1 flex items-center gap-1"><Search size={8} /> Discovery Channel</label><input type="text" placeholder="How did you find the leak?" value={reportData.leak_location} onChange={(e) => setReportData({...reportData, leak_location: e.target.value})} className="w-full p-3 bg-white border border-silver/10 rounded-xl text-[10px] font-black text-indblue outline-none" /></div>
                                                </div>
                                            )}

                                            {reportData.category === 'Social Media' && (
                                                <div className="space-y-3">
                                                    <div className="space-y-1"><label className="text-[7px] font-black text-silver uppercase ml-1 flex items-center gap-1"><Smartphone size={8} /> App</label><select value={reportData.platform} onChange={(e) => setReportData({...reportData, platform: e.target.value})} className="w-full p-3 bg-white border border-silver/10 rounded-xl text-[10px] font-black text-indblue outline-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27 fill=%27none%27 viewBox=%270 0 24 24%27 stroke=%27%23cbd5e1%27%3E%3Cpath stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%272%27 d=%27m19 9-7 7-7-7%27%2F%3E%3C%2Fsvg%3E')] bg-[length:1rem_1rem] bg-[right_0.75rem_center] bg-no-repeat appearance-none"><option value="">Select Active Channel</option><option value="Instagram">Instagram</option><option value="Facebook">Facebook</option><option value="X">X (Twitter)</option><option value="WhatsApp">WhatsApp</option><option value="Telegram">Telegram</option></select></div>
                                                    <div className="space-y-1"><label className="text-[7px] font-black text-silver uppercase ml-1 flex items-center gap-1"><HashIcon size={8} /> Profile / Identifier</label><input type="text" placeholder="@handle or Link" value={reportData.handle_link} onChange={(e) => setReportData({...reportData, handle_link: e.target.value})} className="w-full p-3 bg-white border border-silver/10 rounded-xl text-[10px] font-black text-indblue outline-none" /></div>
                                                </div>
                                            )}
                                            <button onClick={() => setReportingStep(3)} className="w-full py-3.5 bg-indblue text-white rounded-xl text-[8px] font-black uppercase tracking-[0.4em] shadow-lg mt-2">Proceed to Context</button>
                                        </div>
                                    )}

                                    {reportingStep === 3 && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                                            <div className="flex items-center gap-2 mb-2"><div className="w-5 h-5 rounded-full bg-indblue flex items-center justify-center text-white text-[10px]">3</div><p className="text-[8px] font-black text-indblue uppercase tracking-widest">Contextual description</p></div>
                                            
                                            {reportData.category === 'Financial Fraud' && (
                                                <div className="space-y-1"><label className="text-[7px] font-black text-silver uppercase ml-1 flex items-center gap-1"><Key size={8} /> 12-Digit Transaction UTR</label><input type="text" placeholder="Scan SMS for 12 digits" value={reportData.utr_id} onChange={(e) => setReportData({...reportData, utr_id: e.target.value})} className="w-full p-3 bg-white border border-silver/10 rounded-xl text-[10px] font-bold text-saffron tracking-tight outline-none" /></div>
                                            )}

                                            {reportData.category === 'Impersonation' && (
                                                <div className="space-y-1"><label className="text-[7px] font-black text-silver uppercase ml-1 flex items-center gap-1"><UserRound size={8} /> Fake Account Handle</label><input type="text" placeholder="Exact @username used" value={reportData.fake_handle} onChange={(e) => setReportData({...reportData, fake_handle: e.target.value})} className="w-full p-3 bg-white border border-silver/10 rounded-xl text-[10px] font-black text-indblue outline-none" /></div>
                                            )}

                                            {reportData.category === 'Identity Theft' && (
                                                <div className="space-y-1"><label className="text-[7px] font-black text-silver uppercase ml-1 flex items-center gap-1"><ShieldCheck size={8} /> Specific ID Details</label><input type="text" placeholder="Last 4 digits or ID Number" value={reportData.pii_details} onChange={(e) => setReportData({...reportData, pii_details: e.target.value})} className="w-full p-3 bg-white border border-silver/10 rounded-xl text-[10px] font-black text-indblue outline-none" /></div>
                                            )}

                                            {reportData.category === 'Social Media' && (
                                                <div className="space-y-1"><label className="text-[7px] font-black text-silver uppercase ml-1 flex items-center gap-1"><LinkIcon size={8} /> Malicious Link / Post URL</label><input type="text" placeholder="https://..." value={reportData.scam_link} onChange={(e) => setReportData({...reportData, scam_link: e.target.value})} className="w-full p-3 bg-white border border-silver/10 rounded-xl text-[10px] font-black text-indblue outline-none" /></div>
                                            )}

                                            <div className="space-y-1.5"><label className="text-[7px] font-black text-silver uppercase ml-1">Incident Narration</label><textarea rows={5} placeholder={`Detail the ${reportData.category} sequence...`} value={reportData.description} onChange={(e) => setReportData({...reportData, description: e.target.value})} className="w-full p-3 bg-white border border-silver/10 rounded-xl text-[10px] font-bold text-indblue outline-none resize-none shadow-inner leading-relaxed" /></div>
                                            <button onClick={() => setReportingStep(4)} className="w-full py-3.5 bg-indblue text-white rounded-xl text-[8px] font-black uppercase tracking-[0.4em] shadow-lg">Lock Details</button>
                                        </div>
                                    )}

                                    {reportingStep === 4 && (
                                        <div className="animate-in fade-in zoom-in-95 duration-400 space-y-4">
                                            <div className="flex items-center gap-2 mb-2"><div className="w-5 h-5 rounded-full bg-saffron flex items-center justify-center text-white text-[10px]">4</div><p className="text-[8px] font-black text-saffron uppercase tracking-widest">Digital Affidavit</p></div>
                                            
                                            <div className="bg-white p-5 rounded-2xl border border-silver/15 space-y-2.5 shadow-sm text-indblue">
                                                <div className="flex justify-between items-center border-b border-boxbg pb-2"><span className="text-[7px] font-black text-silver uppercase">Case Type</span><span className="text-[9px] font-black">{reportData.category}</span></div>
                                                
                                                {reportData.category === 'Financial Fraud' && (
                                                    <>
                                                        <div className="flex justify-between items-center border-b border-boxbg pb-2"><span className="text-[7px] font-black text-silver uppercase">Loss</span><span className="text-[10px] font-black text-saffron">₹{reportData.amount}</span></div>
                                                        <div className="flex justify-between items-center border-b border-boxbg pb-2"><span className="text-[7px] font-black text-silver uppercase">UTR Ref</span><span className="text-[9px] font-black">{reportData.utr_id || "--"}</span></div>
                                                    </>
                                                )}
                                                
                                                {reportData.platform && (<div className="flex justify-between items-center border-b border-boxbg pb-2"><span className="text-[7px] font-black text-silver uppercase">Platform</span><span className="text-[9px] font-black">{reportData.platform}</span></div>)}
                                                
                                                {reportData.fake_handle && (<div className="flex justify-between items-center border-b border-boxbg pb-2"><span className="text-[7px] font-black text-silver uppercase">Flagged Handle</span><span className="text-[9px] font-black text-redalert">{reportData.fake_handle}</span></div>)}
                                                
                                                <div className="space-y-1"><span className="text-[7px] font-black text-silver uppercase">Incident Summary</span><p className="text-[9px] font-bold text-charcoal/60 leading-tight line-clamp-2">{reportData.description || "No description provided."}</p></div>
                                            </div>

                                            <div className="p-4 bg-saffron/5 border border-saffron/10 rounded-xl flex items-start gap-3"><AlertCircle size={14} className="text-saffron shrink-0" /><p className="text-[7px] font-bold text-saffron leading-tight uppercase">Identity Corroboration Required under Section 65B IE Act. Penalties apply for false data.</p></div>
                                            <button onClick={submitFinalReport} disabled={isSubmitting} className="w-full py-4 bg-indgreen text-white rounded-xl text-[8px] font-black uppercase tracking-[0.4em] shadow-xl hover:brightness-110 active:scale-95 transition-all">{isSubmitting ? 'ENCRYPTING...' : 'SIGN & SUBMIT PROTOCOL'}</button>
                                        </div>
                                    )}

                                    {reportingStep === 5 && (
                                        <div className="text-center py-6 px-4 flex flex-col items-center animate-in zoom-in-90 duration-500">
                                            <div className="w-16 h-16 bg-indgreen/10 rounded-full flex items-center justify-center text-indgreen mb-6 shadow-inner ring-1 ring-indgreen/20"><CheckCircle2 size={32} /></div>
                                            <h3 className="text-xl font-black text-indblue mb-2 tracking-tight">Case Initialized</h3>
                                            <div className="px-5 py-2.5 bg-indblue text-white rounded-xl mb-8 shadow-md border border-white/20"><p className="text-[9px] font-black uppercase tracking-widest font-mono">{caseId}</p></div>
                                            <p className="text-[7px] text-silver font-black uppercase tracking-[0.2em] max-w-[200px] mx-auto leading-relaxed mb-10">Routed to National Cyber Forensic Lab Via Tunnel #ALPHA-42. Tracking SMS Sent.</p>
                                            <button onClick={() => setPhoneState('HOME')} className="w-full py-4 bg-charcoal text-white rounded-xl text-[8px] font-black uppercase tracking-[0.4em] shadow-xl ring-1 ring-white/10 hover:bg-charcoal/90">End Secure Session</button>
                                        </div>
                                    )}

                                </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                    </div>

                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-indblue/10 rounded-full" />
                </div>
            </div>
        </div>

        {/* Tactical Keypad */}
        <div className="flex flex-col gap-6 w-full max-w-[280px] shrink-0 h-full max-h-[720px] justify-center scale-95 lg:scale-100">
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

            <div className="bg-white rounded-[2.5rem] p-7 border border-silver/15 shadow-2xl flex flex-col items-center relative gap-6">
                <div className="relative w-20 h-20 rounded-full bg-white border-2 border-silver/5 shadow-inner flex items-center justify-center ring-4 ring-boxbg/30">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={handleOkSubmit} className="w-14 h-14 bg-indblue text-white rounded-full shadow-2xl border-2 border-white/20 flex items-center justify-center font-black text-xs cursor-pointer hover:bg-indblue/90 transition-all z-10">OK</motion.button>
                    <ArrowUp size={10} className="absolute top-0.5 text-silver/20" />
                    <ArrowDown size={10} className="absolute bottom-0.5 text-silver/20" />
                    <ChevronLeft size={10} className="absolute left-0.5 text-silver/20" />
                    <ChevronRight size={10} className="absolute right-0.5 text-silver/20" />
                </div>

                <div className="grid grid-cols-3 gap-2.5 w-full">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(key => (
                        <button key={key} onClick={() => handleKeyPress(key)} className="relative h-14 bg-white rounded-xl border border-silver/10 shadow-sm hover:shadow-md hover:border-indblue/10 active:scale-95 transition-all flex flex-col items-center justify-center group overflow-hidden">
                            <span className="text-xl font-black text-indblue/60 group-hover:text-indblue group-hover:scale-105 transition-all">{key}</span>
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-2.5 w-full pt-4 border-t border-silver/5">
                    <button className="py-3.5 bg-boxbg/50 rounded-xl flex items-center justify-center font-black text-[7px] text-silver uppercase tracking-widest hover:text-redalert transition-all" onClick={clearInput}>Clear</button>
                    <button className="py-3.5 bg-boxbg/50 rounded-xl flex items-center justify-center font-black text-[7px] text-silver uppercase tracking-widest hover:text-indblue transition-all" onClick={() => phoneState === 'HOME' ? setUssdInput("*#06#") : setPhoneState('HOME')}>Return</button>
                </div>
            </div>
            <p className="text-center text-[7px] font-black text-silver/40 uppercase tracking-[0.4em]">Node Protocol Alpha 2.4.3</p>
        </div>

      </div>
    </div>
  );
}
