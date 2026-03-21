"use client";

import { useState, useRef, useEffect } from "react";
import {
  Smartphone,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  FileText,
  BadgeCheck,
  ChevronRight,
  ChevronLeft,
  X,
  Upload,
  CheckCircle2
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
  const [ussdHistory, setUssdHistory] = useState<string[]>([]);
  const [ussdInput, setUssdInput] = useState("");
  const [isReportingMode, setIsReportingMode] = useState(false);
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

  const ussdFlow = [
    { title: "DRISHYAM AI USSD NODE", content: "1. Report Cyber Crime\n2. Verify UPI ID\n3. Emergency Broadcast\n4. Digital Saathi" },
    { title: "REPORT SCAM", content: "Select Scam Category:\n1. KYC/Bank Fraud\n2. Jobs/Investment\n3. Sextortion\n4. Other" },
    { title: "PROCESSING...", content: "Sending report to National Command Center..." },
    { title: "SUCCESS", content: "Case Logged Successfully.\nA Digital FIR (65B) will be sent via SMS shortly." }
  ];

  const handleUssdSubmit = async () => {
    if (ussdInput === "1930" || ussdInput === "*1930#") {
      setIsReportingMode(true);
      setReportingStep(1);
      setUssdInput("");
      return;
    }

    if (ussdStep < ussdFlow.length - 1) {
      const nextStep = ussdStep + 1;
      setUssdHistory([...ussdHistory, `> ${ussdInput || '1'}`]);
      
      if (nextStep === ussdFlow.length - 1) {
        try {
          const authStr = localStorage.getItem('drishyam_auth');
          const token = authStr ? JSON.parse(authStr).token : null;
          const res = await fetch(`${API_BASE}/bharat/ussd/report?phone_number=${customerId}&scam_type=${ussdInput || 'General'}&lang=en`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            toast.success(`Report Dispatched: ${data.case_id}`);
          }
        } catch (e) {
          console.error("USSD Report Failed:", e);
        }
      }
      setUssdStep(nextStep);
      setUssdInput("");
    } else {
      setUssdStep(0);
      setUssdHistory([]);
    }
  };

  const submitFinalReport = async () => {
    setIsSubmitting(true);
    try {
      const authStr = localStorage.getItem('drishyam_auth');
      const token = authStr ? JSON.parse(authStr).token : null;
      const res = await fetch(`${API_BASE}/bharat/report/comprehensive?reporter_num=${customerId}&category=${reportData.category}&scam_type=${reportData.scam_type}&amount=${reportData.amount}&platform=${reportData.platform}&description=${reportData.description}`, {
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
      toast.error("Submission failed. Offline node retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full max-w-5xl py-4 lg:py-8 fade-in h-full overflow-hidden relative">
      <AnimatePresence>
        {isReportingMode && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="fixed inset-0 z-50 bg-charcoal/95 backdrop-blur-md flex items-center justify-center p-4 lg:p-8"
          >
            <div className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden flex flex-col h-[85vh]">
              {/* Wizard Header */}
              <div className="bg-indblue p-6 sm:p-8 text-white relative flex justify-between items-center shrink-0">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-deeporange via-white to-indgreen opacity-50" />
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                       <ShieldCheck className="text-deeporange" size={28} />
                    </div>
                    <div>
                       <h2 className="text-xl sm:text-2xl font-black tracking-tight">NATIONAL CYBER HELPLINE</h2>
                       <p className="text-[10px] uppercase font-bold tracking-[0.3em] opacity-60">Govt of India Interception Node</p>
                    </div>
                 </div>
                 <button onClick={() => setIsReportingMode(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X size={24} />
                 </button>
              </div>

              {/* Progress Bar */}
              <div className="px-8 pt-6 shrink-0">
                 <div className="flex justify-between mb-2">
                    {[1, 2, 3, 4].map(s => (
                       <div key={s} className={`flex items-center gap-2 ${reportingStep >= s ? 'text-indblue' : 'text-silver'}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${reportingStep >= s ? 'border-indblue bg-indblue text-white' : 'border-silver/20'}`}>
                             {reportingStep > s ? <CheckCircle2 size={12} /> : s}
                          </div>
                          <span className={`text-[10px] font-extrabold uppercase tracking-widest hidden sm:inline`}>
                             {s === 1 ? 'Category' : s === 2 ? 'Details' : s === 3 ? 'Review' : 'Receipt'}
                          </span>
                       </div>
                    ))}
                 </div>
                 <div className="w-full h-1.5 bg-boxbg rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-deeporange shadow-lg shadow-deeporange/20" 
                      initial={{ width: 0 }}
                      animate={{ width: `${(reportingStep / 4) * 100}%` }}
                    />
                 </div>
              </div>

              {/* Wizard Content */}
              <div className="flex-1 overflow-y-auto p-8 sm:p-12 scrollbar-hide">
                 {reportingStep === 1 && (
                   <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                      <div>
                        <h3 className="text-3xl font-black text-indblue tracking-tight mb-2">Select Incident Category</h3>
                        <p className="text-sm text-silver font-medium">Under Section 66D IT Act, misreporting is a punishable offense.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { id: "FINANCIAL", icon: AlertCircle, label: "Financial Fraud", desc: "UPI, ATM, Bank, Credit Card" },
                          { id: "SOCIAL", icon: Smartphone, label: "Social Media Crime", desc: "Hacking, Impersonation" },
                          { id: "IDENTITY", icon: FileText, label: "Identity Theft", desc: "PAN/Aadhar misuse" },
                          { id: "OTHER", icon: BadgeCheck, label: "Cyber Stalking", desc: "Bullying, Harassment" }
                        ].map(cat => (
                          <button 
                            key={cat.id}
                            onClick={() => { setReportData({...reportData, category: cat.id}); setReportingStep(2); }}
                            className={`p-6 rounded-3xl border-2 text-left transition-all group ${reportData.category === cat.id ? 'border-deeporange bg-deeporange/5' : 'border-silver/10 hover:border-indblue/30 bg-white'}`}
                          >
                            <cat.icon size={24} className={reportData.category === cat.id ? 'text-deeporange' : 'text-silver group-hover:text-indblue'} />
                            <h4 className="text-lg font-black text-indblue mt-4">{cat.label}</h4>
                            <p className="text-xs text-silver mt-1">{cat.desc}</p>
                          </button>
                        ))}
                      </div>
                   </motion.div>
                 )}

                 {reportingStep === 2 && (
                   <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8 max-w-2xl">
                      <div>
                        <h3 className="text-3xl font-black text-indblue tracking-tight mb-2">Evidence Capture</h3>
                        <p className="text-sm text-silver font-medium">Detailed forensics accelerate the recovery process.</p>
                      </div>
                      <div className="space-y-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-silver uppercase tracking-widest">Type of Scam</label>
                           <input 
                              type="text" 
                              placeholder="e.g. UPI QR Code Scam"
                              className="w-full p-4 bg-boxbg/50 rounded-2xl border border-silver/10 focus:border-indblue outline-none transition-all font-bold text-indblue"
                              value={reportData.scam_type}
                              onChange={e => setReportData({...reportData, scam_type: e.target.value})}
                           />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-silver uppercase tracking-widest">Amount Lost (INR)</label>
                             <input 
                                type="text" 
                                placeholder="0.00"
                                className="w-full p-4 bg-boxbg/50 rounded-2xl border border-silver/10 focus:border-indblue outline-none transition-all font-bold text-indblue"
                                value={reportData.amount}
                                onChange={e => setReportData({...reportData, amount: e.target.value})}
                             />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-silver uppercase tracking-widest">Platform</label>
                             <input 
                                type="text" 
                                placeholder="WhatsApp, Instagram, etc."
                                className="w-full p-4 bg-boxbg/50 rounded-2xl border border-silver/10 focus:border-indblue outline-none transition-all font-bold text-indblue"
                                value={reportData.platform}
                                onChange={e => setReportData({...reportData, platform: e.target.value})}
                             />
                          </div>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-silver uppercase tracking-widest">Brief Incident Description</label>
                           <textarea 
                              rows={3}
                              placeholder="How did it happen?"
                              className="w-full p-4 bg-boxbg/50 rounded-2xl border border-silver/10 focus:border-indblue outline-none transition-all font-bold text-indblue resize-none"
                              value={reportData.description}
                              onChange={e => setReportData({...reportData, description: e.target.value})}
                           />
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <button onClick={() => setReportingStep(1)} className="px-8 py-4 border-2 border-silver/10 rounded-2xl text-xs font-black text-silver uppercase tracking-widest hover:text-indblue transition-all">Back</button>
                        <button onClick={() => setReportingStep(3)} className="flex-1 py-4 bg-indblue text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indblue/90 transition-all shadow-xl shadow-indblue/20">Review Report</button>
                      </div>
                   </motion.div>
                 )}

                 {reportingStep === 3 && (
                   <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                      <div>
                        <h3 className="text-3xl font-black text-indblue tracking-tight mb-2">Final Review</h3>
                        <p className="text-sm text-silver font-medium">The DRISHYAM AI engine will auto-generate Section 65B FIR copy.</p>
                      </div>
                      <div className="bg-boxbg/30 rounded-[2rem] p-8 border border-silver/10 grid grid-cols-1 md:grid-cols-2 gap-8 ring-1 ring-silver/5">
                        <div className="space-y-4">
                          <DetailItem label="Incident Category" value={reportData.category} />
                          <DetailItem label="Scam Type" value={reportData.scam_type} />
                          <DetailItem label="Platform" value={reportData.platform} />
                        </div>
                        <div className="space-y-4">
                          <DetailItem label="Amount Lost" value={`₹${reportData.amount}`} danger />
                          <DetailItem label="Reporter Number" value={customerId} />
                          <DetailItem label="Status" value="Verification Pending" />
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <button onClick={() => setReportingStep(2)} className="px-8 py-4 border-2 border-silver/10 rounded-2xl text-xs font-black text-silver uppercase tracking-widest hover:text-indblue transition-all">Edit</button>
                        <button 
                          onClick={submitFinalReport} 
                          disabled={isSubmitting}
                          className="flex-1 py-4 bg-deeporange text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-xl shadow-deeporange/20 flex items-center justify-center gap-2"
                        >
                          {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                          {isSubmitting ? 'GENERATING FIR...' : 'SUBMIT & GENERATE FIR'}
                        </button>
                      </div>
                   </motion.div>
                 )}

                 {reportingStep === 4 && (
                   <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8 space-y-8">
                      <div className="w-24 h-24 bg-indgreen/10 rounded-full flex items-center justify-center mx-auto text-indgreen shadow-xl">
                        <CheckCircle2 size={48} />
                      </div>
                      <div>
                        <h3 className="text-4xl font-black text-indblue tracking-tight">Report Successfully Logged</h3>
                        <p className="text-silver mt-2 font-medium">FIR Copy generation triggered for Case ID: <span className="text-indblue font-black">{caseId}</span></p>
                      </div>
                      <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-indgreen/30 max-w-sm mx-auto shadow-sm">
                         <FileText size={40} className="mx-auto text-silver mb-4" />
                         <p className="text-[10px] font-black text-silver uppercase tracking-widest">DRISHYAM-AI CERTIFIED</p>
                         <p className="text-xs font-bold text-indblue mt-2 leading-relaxed">Evidence has been cryptographically hashed and synced with the National Command Center.</p>
                      </div>
                      <button 
                        onClick={() => setIsReportingMode(false)}
                        className="px-12 py-4 bg-charcoal text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all"
                      >
                        CLOSE WIZARD
                      </button>
                   </motion.div>
                 )}
              </div>

              {/* Wizard Footer */}
              <div className="bg-boxbg/30 p-6 sm:p-8 shrink-0 flex justify-between items-center border-t border-silver/5">
                 <p className="text-[9px] font-bold text-silver uppercase tracking-widest">Hashed ID: SH256-441092-X9</p>
                 <div className="flex gap-2">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="India Emblem" className="h-6 opacity-30 invert" />
                 </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center w-full z-10">
        {/* Feature Phone UI */}
        <div className="relative w-full max-w-[288px] h-[520px] bg-charcoal rounded-[2.5rem] p-6 shadow-2xl border-4 border-white/5 mx-auto">
          <div className="w-full h-full flex flex-col gap-4">
            <div className="w-16 h-1 bg-white/10 rounded-full mx-auto" />
            
            <div className="w-full h-48 bg-indblue rounded-xl p-4 font-mono text-white flex flex-col border-2 border-white/10 relative overflow-hidden">
              <div className="absolute top-1 right-2 text-[8px] opacity-50 flex gap-1">
                <span>4G</span> <Smartphone size={8} />
              </div>
              <div className="text-[10px] font-bold border-b border-white/20 pb-1 mb-2">
                {ussdFlow[ussdStep].title}
              </div>
              <div className="flex-1 text-[9px] whitespace-pre-wrap leading-tight text-white/90">
                {ussdFlow[ussdStep].content}
              </div>
              <div className="mt-auto pt-2 flex flex-col gap-1">
                {ussdHistory.slice(-2).map((h, i) => (
                  <div key={i} className="text-[8px] text-white/40">{h}</div>
                ))}
                <div className="text-[8px] text-saffron font-black">{ussdInput ? `> ${ussdInput}` : '> _'}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 px-8">
              <div />
              <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/40 ring-1 ring-white/10 hover:bg-white/10 transition-colors"><ChevronRight size={16} className="-rotate-90" /></button>
              <div />
              <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/40 ring-1 ring-white/10 hover:bg-white/10 transition-colors"><ChevronLeft size={16} /></button>
              <button className="w-10 h-10 bg-deeporange rounded-full flex items-center justify-center text-white shadow-lg shadow-deeporange/20 border-2 border-white/20" onClick={handleUssdSubmit}>OK</button>
              <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/40 ring-1 ring-white/10 hover:bg-white/10 transition-colors"><ChevronRight size={16} /></button>
              <div />
              <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/40 ring-1 ring-white/10 hover:bg-white/10 transition-colors"><ChevronRight size={16} className="rotate-90" /></button>
              <div />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(key => (
                <button 
                  key={key}
                  onClick={() => setUssdInput(prev => prev + key)}
                  className="py-3 bg-white/5 rounded-xl text-white font-bold text-xs ring-1 ring-white/5 hover:bg-white/10 active:scale-95 transition-all shadow-inner"
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-silver/10 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <AlertCircle size={80} />
            </div>
            <h4 className="text-[10px] font-black text-indblue uppercase tracking-[0.2em] mb-4">Tactical Protocol: Bharat Layer</h4>
            <h3 className="text-2xl font-black text-indblue mb-4 leading-tight">National Crime Registration Interface</h3>
            <p className="text-xs text-silver font-medium leading-relaxed mb-6">
              The Bharat Layer intercepts crimes via USSD gateways. Dial <span className="text-deeporange font-black">1930</span> on the simulator to trigger the secure National Reporting Portal.
            </p>
            <ul className="space-y-4">
              {[
                "Dial 1930 to trigger Helplne Wizard",
                "End-to-end encrypted incident logging",
                "Real-time integration with National Portal",
                "Digital FIR generation (Section 65B)"
              ].map((text, i) => (
                <li key={i} className="flex items-center gap-3 text-xs font-bold text-indblue">
                  <div className="w-1.5 h-1.5 bg-deeporange rounded-full" /> {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-charcoal p-6 rounded-[2rem] border border-white/5 text-white/40 font-mono text-[9px] space-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indgreen/5 to-transparent animate-pulse" />
            <p className="text-indgreen font-black tracking-widest uppercase text-[7px] mb-2 flex items-center gap-2">
               <div className="w-1 h-1 bg-indgreen rounded-full animate-ping" />
               GSM SIMULATION ACTIVE
            </p>
            <p className="flex justify-between"><span>NODE:</span> <span className="text-white/60">TRACE_NODE_DELHI_09</span></p>
            <p className="flex justify-between"><span>SIGNAL:</span> <span className="text-indgreen">CRYPTO_STABLE_92%</span></p>
            <p className="flex justify-between"><span>LINK:</span> <span className="text-white/60">AES_256_SECURE_TUNNEL</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, danger = false }: { label: string, value: string, danger?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-black text-silver uppercase tracking-[0.2em] mb-1">{label}</p>
      <p className={`text-sm font-black ${danger ? 'text-deeporange underline decoration-wavy decoration-deeporange/30' : 'text-indblue'}`}>
        {value || 'Not Specified'}
      </p>
    </div>
  );
}

function Loader2({ size, className }: { size: number, className?: string }) {
  return (
    <div className={`animate-spin ${className}`} style={{ width: size, height: size }}>
      <Smartphone size={size} />
    </div>
  );
}

