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
import { getAuthHeaders } from "@/lib/auth";

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
  const [isSubmittingUssd, setIsSubmittingUssd] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [language, setLanguage] = useState("hi");
  const [region, setRegion] = useState("north");
  const [ussdMenuText, setUssdMenuText] = useState("Loading regional low-bandwidth menu...");
  const [smsPreview, setSmsPreview] = useState<string | null>(null);
  const [routedTo, setRoutedTo] = useState<string[]>([]);
  
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

  const openUssdFlow = async () => {
    try {
      const response = await fetch(`${API_BASE}/bharat/ussd/menu?lang=${encodeURIComponent(language)}&region=${encodeURIComponent(region)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.detail || "Could not load regional USSD menu");
      }
      setUssdMenuText(payload.text || "DRISHYAM Bharat menu");
      setPhoneState("USSD");
      setUssdStep(0);
      setUssdInput("");
    } catch (error: any) {
      toast.error(error.message || "Could not load the Bharat USSD flow.");
    }
  };

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
        
        if (next === '1930') {
          triggerReportingFlow();
          return "";
        }
        if (next === '*1930#') {
          void openUssdFlow();
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
    setCaseId(null);
    setSmsPreview(null);
    setRoutedTo([]);
  };

  const handleOkSubmit = async () => {
    if (phoneState === 'DIALER') {
      if (ussdInput === '1930') {
        triggerReportingFlow();
      } else if (ussdInput === '*1930#') {
        await openUssdFlow();
      } else if (ussdInput.startsWith('*') && ussdInput.endsWith('#')) {
        await openUssdFlow();
      } else {
        toast.error("Dial 1930 for Helpline");
        setPhoneState('HOME');
        setUssdInput("");
      }
      return;
    }

    if (phoneState === 'USSD') {
      if (ussdStep === 0) {
        if (ussdInput !== "1") {
          toast.error("Select 1 to report a cyber crime.");
          return;
        }
        setUssdStep(1);
        setUssdInput("");
        return;
      }

      if (ussdStep === 1) {
        const scamMap: Record<string, string> = {
          "1": "KYC/Bank Fraud",
          "2": "Jobs/Investment",
          "3": "Sextortion",
          "4": "Other",
        };
        const selectedCategory = scamMap[ussdInput];
        if (!selectedCategory) {
          toast.error("Select a valid scam category.");
          return;
        }

        setIsSubmittingUssd(true);
        try {
          const response = await fetch(
            `${API_BASE}/bharat/ussd/report?phone_number=${encodeURIComponent(customerId)}&scam_type=${encodeURIComponent(selectedCategory)}&lang=${encodeURIComponent(language)}&region=${encodeURIComponent(region)}`,
            {
              method: "POST",
              headers: getAuthHeaders(),
            },
          );
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload?.detail || "Could not register the USSD complaint.");
          }
          setCaseId(payload.case_id);
          setSmsPreview(payload?.sms_preview?.text || null);
          setRoutedTo(payload?.routed_to || []);
          setUssdStep(2);
          setUssdInput("");
          toast.success("USSD complaint registered.");
        } catch (error: any) {
          toast.error(error.message || "Could not register the USSD complaint.");
        } finally {
          setIsSubmittingUssd(false);
        }
        return;
      }

      if (ussdStep === 2) {
        setPhoneState('HOME');
        setUssdStep(0);
        setUssdInput("");
      }
      return;
    }

    if (phoneState === 'WIZARD') {
        if (reportingStep === 2) setReportingStep(3);
        else if (reportingStep === 3) setReportingStep(4);
        else if (reportingStep === 4) submitFinalReport();
    }
  };

  const ussdFlow = [
    { title: "DRISHYAM AI NODE", content: ussdMenuText },
    { title: "REPORT SCAM", content: "Select Scam Category:\n1. KYC/Bank Fraud\n2. Jobs/Investment\n3. Sextortion\n4. Other" },
    { title: "SUCCESS", content: `Case logged successfully.\nCase ID: ${caseId || "Pending"}\nFIR (65B) queued via SMS.` }
  ];

  const submitFinalReport = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/bharat/report/comprehensive`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reporter_num: customerId,
          category: reportData.category,
          scam_type: reportData.category,
          amount: reportData.amount || "0",
          platform: reportData.platform || "Simulated",
          description: reportData.description || "Simulated Report",
          channel: "IVR",
          lang: language,
          region,
          ...reportData,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || "Could not register the incident");
      }
      setCaseId(data.case_id);
      setSmsPreview(data?.sms_preview?.text || null);
      setRoutedTo(data?.routed_to || []);
      setReportingStep(5);
      toast.success("Cyber incident registered.");
    } catch (e: any) {
      toast.error(e.message || "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full rounded-[2.5rem] border border-indblue/10 bg-[radial-gradient(circle_at_top,rgba(0,33,106,0.05),rgba(255,255,255,0.98)_50%)] px-3 py-4 shadow-[0_24px_70px_-40px_rgba(0,33,106,0.35)] sm:px-5">
      <div className="mx-auto mb-5 max-w-3xl text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-saffron">Low-bandwidth citizen routing</p>
        <p className="mt-2 text-sm leading-relaxed text-silver">
          Dial <span className="font-black text-indblue">1930</span> for guided reporting or
          launch <span className="font-black text-indblue">*1930#</span> for the USSD incident path. Every step writes the complaint into the live backend workflow.
        </p>
      </div>

      <div className="flex flex-col xl:flex-row items-center justify-center gap-8 xl:gap-10 w-full px-1 pb-2">
        
        {/* iPhone 16 Mockup */}
        <div className="relative shrink-0 flex flex-col items-center justify-center scale-[0.88] sm:scale-[0.94] xl:scale-100 origin-center">
            <div className="relative w-[340px] h-[680px] rounded-[3.5rem] p-1.5 bg-[#f5f5f5] border-[10px] border-white shadow-[0_50px_100px_-20px_rgba(0,33,106,0.15)] ring-2 ring-indblue/5 overflow-hidden flex flex-col">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-indblue rounded-full z-[100] flex items-center justify-center px-3 shadow-md border border-white/10">
                    <div className="flex gap-1 items-center"><div className="w-0.5 h-0.5 rounded-full bg-saffron animate-ping" /><div className="w-8 h-px bg-white/20 rounded-full" /></div>
                </div>

                <div className="flex-1 relative flex flex-col bg-white rounded-[2.8rem] overflow-hidden border border-silver/5">
                    <div className="px-8 pt-8 pb-4 flex justify-between items-center bg-transparent z-50">
                        <div className="text-[9px] font-black text-indblue tracking-tight">{currentTime}</div>
                        <div className="flex items-center gap-1.5">
                            <Signal size={10} className="text-indblue" />
                            <Wifi size={10} className="text-indblue" />
                            <Battery size={14} className="text-indblue" />
                        </div>
                    </div>

                    <div className="flex-1 relative flex flex-col overflow-hidden">
                        <AnimatePresence mode="wait">
                          {phoneState === 'HOME' && (
                            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                                <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 10 }} className="mb-8 text-indblue opacity-[0.08]"><Activity size={120} /></motion.div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-2xl font-black text-saffron tracking-[0.1em] uppercase">DRISHYAM</span>
                                </div>
                                <p className="text-[7px] font-black text-indblue/30 uppercase tracking-[0.6em] mb-12">Security Node Active</p>
                                <div className="grid grid-cols-2 gap-4 w-full px-6">
                                    <div className="p-4 bg-indblue/[0.02] border border-indblue/5 rounded-2xl flex flex-col items-center gap-2"><Phone size={16} className="text-indblue/20" /><span className="text-[7px] font-black uppercase text-indblue/20">Comms</span></div>
                                    <div className="p-4 bg-indblue/[0.02] border border-indblue/5 rounded-2xl flex flex-col items-center gap-2"><Lock size={16} className="text-indblue/20" /><span className="text-[7px] font-black uppercase text-indblue/20">Secure</span></div>
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
                            <motion.div key="ussd" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-4 bg-indblue/5 rounded-[2.5rem] border border-indblue/10 flex flex-col p-8 overflow-hidden">
                                <div className="flex items-center gap-2 mb-4 text-[8px] font-black text-indblue/40 uppercase tracking-widest"><Radio size={10} className="text-indgreen" /> USSD Channel Alpha</div>
                                <div className="flex-1 bg-white p-6 rounded-2xl border border-indblue/5 shadow-inner overflow-hidden flex flex-col">
                                    <h3 className="text-lg font-black text-indblue mb-3 uppercase tracking-tight">{ussdFlow[ussdStep].title}</h3>
                                    <p className="text-[11px] font-bold text-charcoal/70 whitespace-pre-wrap leading-relaxed font-mono flex-1 overflow-y-auto pr-2 scrollbar-hide">{ussdFlow[ussdStep].content}</p>
                                </div>
                                <div className="pt-6 mt-2 space-y-4 border-t border-indblue/5">
                                    <div className="h-12 bg-white rounded-xl border border-indblue/5 flex items-center px-4 font-mono text-saffron text-base font-black shadow-inner">❯ {ussdInput || "Wait..."}</div>
                                    <div className="flex justify-between px-2">
                                        <button className="text-[8px] font-black text-silver uppercase tracking-widest hover:text-indblue" onClick={() => { setPhoneState('HOME'); setUssdStep(0); }}>Abort</button>
                                        <button className="text-[8px] font-black text-saffron uppercase tracking-widest hover:text-indblue disabled:opacity-50" disabled={isSubmittingUssd} onClick={handleOkSubmit}>{isSubmittingUssd ? "Routing..." : "Confirm"}</button>
                                    </div>
                                </div>
                            </motion.div>
                          )}

                          {phoneState === 'WIZARD' && (
                            <motion.div key="wizard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white flex flex-col overflow-hidden z-[200]">
                                <div className="bg-indblue p-6 pt-10 text-white shrink-0 shadow-lg relative rounded-b-[2.5rem]">
                                    <div className="flex items-center justify-between mb-4 relative z-10">
                                        <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-saffron" /><span className="text-[8px] font-black uppercase tracking-widest opacity-80">Helpline 1930</span></div>
                                        <button onClick={() => setPhoneState('HOME')} className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-xl hover:bg-white/20 transition-all"><X size={14} /></button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mb-4 relative z-10">
                                        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white outline-none">
                                            <option value="hi" className="text-charcoal">Hindi</option>
                                            <option value="en" className="text-charcoal">English</option>
                                            <option value="bn" className="text-charcoal">Bengali</option>
                                            <option value="ta" className="text-charcoal">Tamil</option>
                                        </select>
                                        <select value={region} onChange={(e) => setRegion(e.target.value)} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white outline-none">
                                            <option value="north" className="text-charcoal">North</option>
                                            <option value="east" className="text-charcoal">East</option>
                                            <option value="west" className="text-charcoal">West</option>
                                            <option value="south" className="text-charcoal">South</option>
                                        </select>
                                    </div>
                                    <div className="flex justify-between gap-1 mb-2 relative z-10">
                                      {[1, 2, 3, 4].map(s => (<div key={s} className={`flex-1 h-0.5 rounded-full transition-all duration-700 ${reportingStep >= s ? 'bg-saffron' : 'bg-white/10'}`} />))}
                                    </div>
                                    <h2 className="text-sm font-black tracking-tight mt-1 relative z-10 uppercase italic">{reportData.category || "Select Issue"}</h2>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-hide">
                                    {reportingStep === 1 && (
                                        <div className="space-y-2">
                                            {['Financial Fraud', 'Impersonation', 'Identity Theft', 'Social Media'].map((cat, i) => (
                                                <button key={cat} onClick={() => { setReportData({...reportData, category: cat}); setReportingStep(2); }} data-testid={`bharat-category-${cat.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="w-full px-5 py-3.5 bg-white border border-indblue/5 rounded-xl text-left shadow-sm hover:shadow-md hover:border-saffron/30 transition-all group flex justify-between items-center"><span className="text-[10px] font-black text-indblue/80 uppercase">{cat}</span><ChevronRight size={14} className="text-indblue/20 group-hover:text-saffron" /></button>
                                            ))}
                                        </div>
                                    )}

                                    {reportingStep === 2 && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                                            <div className="flex items-center gap-2 mb-2"><div className="w-5 h-5 rounded-full bg-indblue flex items-center justify-center text-white text-[10px]">2</div><p className="text-[8px] font-black text-indblue uppercase tracking-widest">Initial Incident Data</p></div>
                                            
                                            {reportData.category === 'Financial Fraud' && (
                                                <div className="space-y-3">
                                                    <div className="space-y-1"><label className="text-[7px] font-black text-indblue/30 uppercase ml-1 flex items-center gap-1 font-mono"><Banknote size={8} /> Loss (INR)</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-saffron">₹</span><input type="text" readOnly value={reportData.amount} className="w-full pl-8 p-3 bg-indblue/[0.02] border border-indblue/5 rounded-xl text-lg font-black text-indblue shadow-inner" /></div><p className="text-[6px] font-bold text-silver italic ml-1 uppercase">Input via tactical keypad.</p></div>
                                                    <div className="space-y-1"><label className="text-[7px] font-black text-indblue/30 uppercase ml-1 font-mono">Affected Bank Name</label><input type="text" placeholder="e.g. HDFC, SBI" value={reportData.bank_name} onChange={(e) => setReportData({...reportData, bank_name: e.target.value})} className="w-full p-3 bg-indblue/[0.02] border border-indblue/5 rounded-xl text-[10px] font-black text-indblue outline-none border-focus:border-indblue/40 uppercase" /></div>
                                                </div>
                                            )}

                                            {reportData.category === 'Impersonation' && (
                                                <div className="space-y-3">
                                                    <div className="space-y-1"><label className="text-[7px] font-black text-indblue/30 uppercase ml-1 flex items-center gap-1 font-mono"><Globe size={8} /> Platform</label><input type="text" placeholder="Instagram, LinkedIn, etc." value={reportData.platform} onChange={(e) => setReportData({...reportData, platform: e.target.value})} className="w-full p-3 bg-indblue/[0.02] border border-indblue/5 rounded-xl text-[10px] font-black text-indblue outline-none uppercase" /></div>
                                                    <div className="space-y-1"><label className="text-[7px] font-black text-indblue/30 uppercase ml-1 flex items-center gap-1 font-mono"><UserRound size={8} /> Target Entity</label><input type="text" placeholder="Name Being Faked" value={reportData.impersonated_name} onChange={(e) => setReportData({...reportData, impersonated_name: e.target.value})} className="w-full p-3 bg-indblue/[0.02] border border-indblue/5 rounded-xl text-[10px] font-black text-indblue outline-none uppercase" /></div>
                                                </div>
                                            )}

                                            {reportData.category === 'Identity Theft' && (
                                                <div className="space-y-3">
                                                    <div className="space-y-1"><label className="text-[7px] font-black text-indblue/30 uppercase ml-1 flex items-center gap-1 font-mono"><IdCard size={8} /> Compromised ID</label><select value={reportData.id_type} onChange={(e) => setReportData({...reportData, id_type: e.target.value})} className="w-full p-3 bg-indblue/[0.02] border border-indblue/5 rounded-xl text-[10px] font-black text-indblue outline-none appearance-none uppercase"><option value="">Select Primary ID</option><option value="Aadhaar">Aadhaar Card</option><option value="PAN">PAN Card</option><option value="Passport">Passport</option><option value="Driving License">DL</option></select></div>
                                                    <div className="space-y-1"><label className="text-[7px] font-black text-indblue/30 uppercase ml-1 flex items-center gap-1 font-mono"><Search size={8} /> Discovery Channel</label><input type="text" placeholder="How was it leaked?" value={reportData.leak_location} onChange={(e) => setReportData({...reportData, leak_location: e.target.value})} className="w-full p-3 bg-indblue/[0.02] border border-indblue/5 rounded-xl text-[10px] font-black text-indblue outline-none uppercase" /></div>
                                                </div>
                                            )}

                                            {reportData.category === 'Social Media' && (
                                                <div className="space-y-3">
                                                    <div className="space-y-1"><label className="text-[7px] font-black text-indblue/30 uppercase ml-1 flex items-center gap-1 font-mono"><Smartphone size={8} /> App</label><select value={reportData.platform} onChange={(e) => setReportData({...reportData, platform: e.target.value})} className="w-full p-3 bg-indblue/[0.02] border border-indblue/5 rounded-xl text-[10px] font-black text-indblue outline-none appearance-none uppercase"><option value="">Select Channel</option><option value="Instagram">Instagram</option><option value="Facebook">Facebook</option><option value="X">X (Twitter)</option><option value="WhatsApp">WhatsApp</option><option value="Telegram">Telegram</option></select></div>
                                                    <div className="space-y-1"><label className="text-[7px] font-black text-indblue/30 uppercase ml-1 flex items-center gap-1 font-mono"><HashIcon size={8} /> Handle / Link</label><input type="text" placeholder="@handle" value={reportData.handle_link} onChange={(e) => setReportData({...reportData, handle_link: e.target.value})} className="w-full p-3 bg-indblue/[0.02] border border-indblue/5 rounded-xl text-[10px] font-black text-indblue outline-none" /></div>
                                                </div>
                                            )}
                                            <button onClick={() => setReportingStep(3)} data-testid="bharat-proceed-context" className="w-full py-3.5 bg-indblue text-white rounded-xl text-[8px] font-black uppercase tracking-[0.4em] shadow-lg mt-2">Proceed to Context</button>
                                        </div>
                                    )}

                                    {reportingStep === 3 && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                                            <div className="flex items-center gap-2 mb-2"><div className="w-5 h-5 rounded-full bg-indblue flex items-center justify-center text-white text-[10px]">3</div><p className="text-[8px] font-black text-indblue uppercase tracking-widest">Contextual Investigation</p></div>
                                            
                                            {reportData.category === 'Financial Fraud' && (
                                                <div className="space-y-1"><label className="text-[7px] font-black text-indblue/30 uppercase ml-1 flex items-center gap-1 font-mono"><Key size={8} /> 12-Digit Transaction UTR</label><input type="text" placeholder="12 Digit No." value={reportData.utr_id} onChange={(e) => setReportData({...reportData, utr_id: e.target.value})} className="w-full p-3 bg-indblue/[0.02] border border-indblue/5 rounded-xl text-[10px] font-bold text-saffron tracking-tight outline-none uppercase" /></div>
                                            )}

                                            {reportData.category === 'Impersonation' && (
                                                <div className="space-y-1"><label className="text-[7px] font-black text-indblue/30 uppercase ml-1 flex items-center gap-1 font-mono"><UserRound size={8} /> Fake Account Handle</label><input type="text" placeholder="@username" value={reportData.fake_handle} onChange={(e) => setReportData({...reportData, fake_handle: e.target.value})} className="w-full p-3 bg-indblue/[0.02] border border-indblue/5 rounded-xl text-[10px] font-black text-indblue outline-none" /></div>
                                            )}

                                            {reportData.category === 'Identity Theft' && (
                                                <div className="space-y-1"><label className="text-[7px] font-black text-indblue/30 uppercase ml-1 flex items-center gap-1 font-mono"><ShieldCheck size={8} /> ID Specifics</label><input type="text" placeholder="Last 4 digits" value={reportData.pii_details} onChange={(e) => setReportData({...reportData, pii_details: e.target.value})} className="w-full p-3 bg-indblue/[0.02] border border-indblue/5 rounded-xl text-[10px] font-black text-indblue outline-none uppercase" /></div>
                                            )}

                                            {reportData.category === 'Social Media' && (
                                                <div className="space-y-1"><label className="text-[7px] font-black text-indblue/30 uppercase ml-1 flex items-center gap-1 font-mono"><LinkIcon size={8} /> Scam Link / Post URL</label><input type="text" placeholder="https://..." value={reportData.scam_link} onChange={(e) => setReportData({...reportData, scam_link: e.target.value})} className="w-full p-3 bg-indblue/[0.02] border border-indblue/5 rounded-xl text-[10px] font-black text-indblue outline-none" /></div>
                                            )}

                                            <div className="space-y-1.5"><label className="text-[7px] font-black text-indblue/30 uppercase ml-1 font-mono">Incident Narration</label><textarea rows={5} placeholder={`Detail the sequence...`} data-testid="bharat-description-input" value={reportData.description} onChange={(e) => setReportData({...reportData, description: e.target.value})} className="w-full p-3 bg-indblue/[0.02] border border-indblue/5 rounded-xl text-[10px] font-bold text-charcoal outline-none resize-none shadow-inner leading-relaxed uppercase" /></div>
                                            <button onClick={() => setReportingStep(4)} data-testid="bharat-authenticate-details" className="w-full py-3.5 bg-indblue text-white rounded-xl text-[8px] font-black uppercase tracking-[0.4em] shadow-lg">Authenticate Details</button>
                                        </div>
                                    )}

                                    {reportingStep === 4 && (
                                        <div className="animate-in fade-in zoom-in-95 duration-400 space-y-4">
                                            <div className="flex items-center gap-2 mb-2"><div className="w-5 h-5 rounded-full bg-saffron flex items-center justify-center text-white text-[10px]">4</div><p className="text-[8px] font-black text-saffron uppercase tracking-widest">Digital Affidavit</p></div>
                                            
                                            <div className="bg-indblue/[0.02] p-5 rounded-2xl border border-indblue/10 space-y-2.5 shadow-sm text-indblue">
                                                <div className="flex justify-between items-center border-b border-indblue/5 pb-2"><span className="text-[7px] font-black text-indblue/30 uppercase">Case Type</span><span className="text-[9px] font-black uppercase tracking-tighter">{reportData.category}</span></div>
                                                
                                                {reportData.category === 'Financial Fraud' && (
                                                    <>
                                                        <div className="flex justify-between items-center border-b border-indblue/5 pb-2"><span className="text-[7px] font-black text-indblue/30 uppercase">Loss</span><span className="text-[10px] font-black text-saffron">₹{reportData.amount}</span></div>
                                                    </>
                                                )}
                                                
                                                <div className="space-y-1"><span className="text-[7px] font-black text-indblue/30 uppercase">Summary</span><p className="text-[9px] font-bold text-charcoal/40 leading-tight line-clamp-2 uppercase italic">{reportData.description || "Incomplete"}</p></div>
                                            </div>

                                            <div className="p-4 bg-saffron/5 border border-saffron/10 rounded-xl flex items-start gap-3"><AlertCircle size={14} className="text-saffron shrink-0" /><p className="text-[7px] font-bold text-saffron leading-tight uppercase">Identity Corroboration Required under Section 65B IE Act. Legal penalties apply.</p></div>
                                            <button onClick={submitFinalReport} disabled={isSubmitting} data-testid="bharat-submit-report" className="w-full py-4 bg-indgreen text-white rounded-xl text-[8px] font-black uppercase tracking-[0.4em] shadow-xl hover:brightness-110 active:scale-95 transition-all">{isSubmitting ? 'ENCRYPTING...' : 'SIGN & SUBMIT'}</button>
                                        </div>
                                    )}

                                    {reportingStep === 5 && (
                                        <div className="text-center py-6 px-4 flex flex-col items-center animate-in zoom-in-90 duration-500">
                                            <div className="w-16 h-16 bg-indgreen/10 rounded-full flex items-center justify-center text-indgreen mb-6 shadow-inner ring-1 ring-indgreen/20"><CheckCircle2 size={32} /></div>
                                            <h3 className="text-xl font-black text-indblue mb-2 tracking-tight uppercase">Logged</h3>
                                            <div className="px-5 py-2.5 bg-indblue text-white rounded-xl mb-8 shadow-md border border-white/20"><p className="text-[9px] font-black uppercase tracking-widest font-mono">{caseId}</p></div>
                                            <p className="text-[7px] text-indblue/40 font-black uppercase tracking-[0.2em] max-w-[200px] mx-auto leading-relaxed mb-10">Routed to forensic lab Alpha-4. SMS Confirmation Sent.</p>
                                            {(routedTo.length > 0 || smsPreview) && (
                                                <div className="w-full mb-4 rounded-2xl border border-indblue/10 bg-indblue/[0.02] px-4 py-4 text-left">
                                                    <p className="text-[7px] font-black uppercase tracking-[0.2em] text-indblue/40">Routing Summary</p>
                                                    {routedTo.length > 0 ? <p className="mt-2 text-[9px] font-black text-indblue uppercase">{routedTo.join(" | ")}</p> : null}
                                                    {smsPreview ? <p className="mt-3 text-[8px] font-bold text-charcoal/60 normal-case">{smsPreview}</p> : null}
                                                </div>
                                            )}
                                            <button onClick={() => setPhoneState('HOME')} className="w-full py-4 bg-indblue text-white rounded-xl text-[8px] font-black uppercase tracking-[0.4em] shadow-xl">End Session</button>
                                        </div>
                                    )}

                                </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                    </div>

                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-indblue/5 rounded-full" />
                </div>
            </div>
        </div>

        {/* Tactical Keypad */}
        <div className="flex w-full max-w-[320px] shrink-0 flex-col gap-5 self-center scale-[0.92] sm:scale-100 xl:scale-105 origin-center drop-shadow-2xl">
            <div className="bg-white rounded-[2rem] p-5 border border-indblue/5 shadow-xl relative overflow-hidden ring-1 ring-indblue/[0.02]">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-indblue"><Cpu size={64} /></div>
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-indblue/[0.02] rounded-2xl border border-indblue/5 ring-1 ring-white shadow-inner"><ShieldCheck size={16} className="text-indblue" /></div>
                    <div>
                        <h4 className="text-[9px] font-black text-indblue uppercase tracking-[0.2em] opacity-80">Tactical ICU</h4>
                        <div className="flex items-center gap-1.5 mt-0.5"><div className="w-1.5 h-1.5 bg-indgreen rounded-full animate-pulse shadow-[0_0_8px_rgba(0,122,61,0.4)]" /><span className="text-[7px] font-black text-silver uppercase tracking-widest">Live Link</span></div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2.8rem] p-7 border border-indblue/5 shadow-[0_40px_80px_-20px_rgba(0,33,106,0.1)] flex flex-col items-center relative gap-6 ring-1 ring-indblue/[0.02]">
                <div className="relative w-24 h-24 rounded-full bg-boxbg border-4 border-white shadow-[inset_0_4px_12px_rgba(0,0,0,0.05),0_8px_16px_rgba(0,0,0,0.02)] flex items-center justify-center group">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }} onClick={handleOkSubmit} className="w-16 h-16 bg-indblue text-white rounded-full shadow-2xl border-4 border-white/20 flex items-center justify-center font-black text-sm cursor-pointer hover:bg-indblue/90 transition-all z-10 group-hover:shadow-indblue/20">OK</motion.button>
                    <ArrowUp size={12} className="absolute top-1 text-indblue/5 group-hover:text-indblue/20 transition-all" />
                    <ArrowDown size={12} className="absolute bottom-1 text-indblue/5 group-hover:text-indblue/20 transition-all" />
                    <ChevronLeft size={12} className="absolute left-1 text-indblue/5 group-hover:text-indblue/20 transition-all" />
                    <ChevronRight size={12} className="absolute right-1 text-indblue/5 group-hover:text-indblue/20 transition-all" />
                </div>

                <div className="grid grid-cols-3 gap-3 w-full">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(key => (
                        <button key={key} onClick={() => handleKeyPress(key)} data-testid={`bharat-key-${key === '*' ? 'star' : key === '#' ? 'hash' : key}`} className="relative h-15 bg-white rounded-2xl border border-indblue/5 shadow-[0_4px_10px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-indblue/10 active:scale-95 transition-all flex flex-col items-center justify-center group overflow-hidden">
                            <span className="text-2xl font-black text-indblue/30 group-hover:text-indblue group-hover:scale-110 transition-all duration-300">{key}</span>
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-3 w-full pt-6 border-t border-indblue/5">
                    <button className="py-4 bg-indblue/[0.02] rounded-2xl flex items-center justify-center font-black text-[8px] text-silver uppercase tracking-widest hover:text-redalert hover:bg-redalert/5 transition-all" onClick={clearInput}>Clear</button>
                    <button className="py-4 bg-indblue/[0.02] rounded-2xl flex items-center justify-center font-black text-[8px] text-silver uppercase tracking-widest hover:text-indblue hover:bg-indblue/5 transition-all" onClick={() => phoneState === 'HOME' ? setUssdInput("*#06#") : setPhoneState('HOME')}>Return</button>
                </div>
            </div>
            <p className="text-center text-[7px] font-bold text-indblue/10 uppercase tracking-[0.5em]">Protocol Alpha V2.4.4</p>
        </div>

      </div>
    </div>
  );
}
