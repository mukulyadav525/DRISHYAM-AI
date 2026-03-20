"use client";

import { useState } from "react";
import {
  Smartphone,
  ArrowRight
} from "lucide-react";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";

interface BharatModuleProps {
  customerId: string;
}

export default function BharatModule({
  customerId,
}: BharatModuleProps) {
  const [ussdStep, setUssdStep] = useState(0);
  const [ussdHistory, setUssdHistory] = useState<string[]>([]);
  const [ussdInput, setUssdInput] = useState("");

  const ussdFlow = [
    { title: "DRISHYAM AI USSD NODE", content: "1. Report Cyber Crime\n2. Verify UPI ID\n3. Emergency Broadcast\n4. Digital Saathi" },
    { title: "REPORT SCAM", content: "Select Scam Category:\n1. KYC/Bank Fraud\n2. Jobs/Investment\n3. Sextortion\n4. Other" },
    { title: "PROCESSING...", content: "Sending report to National Command Center..." },
    { title: "SUCCESS", content: "Case Logged Successfully.\nA Digital FIR (65B) will be sent via SMS shortly." }
  ];

  const handleUssdSubmit = async () => {
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

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full max-w-4xl py-6 fade-in overflow-y-auto scrollbar-hide">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center w-full">
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
              {ussdHistory.slice(-1).map((h, i) => (
                <div key={i} className="text-[8px] text-saffron mt-2 font-black">{h}</div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 px-8">
              <div />
              <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/40 ring-1 ring-white/10 hover:bg-white/10 transition-colors"><ArrowRight size={16} className="-rotate-90" /></button>
              <div />
              <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/40 ring-1 ring-white/10 hover:bg-white/10 transition-colors"><ArrowRight size={16} className="rotate-180" /></button>
              <button className="w-10 h-10 bg-saffron rounded-full flex items-center justify-center text-white shadow-lg shadow-saffron/20 border-2 border-white/20" onClick={handleUssdSubmit}>OK</button>
              <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/40 ring-1 ring-white/10 hover:bg-white/10 transition-colors"><ArrowRight size={16} /></button>
              <div />
              <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/40 ring-1 ring-white/10 hover:bg-white/10 transition-colors"><ArrowRight size={16} className="rotate-90" /></button>
              <div />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(key => (
                <button 
                  key={key}
                  onClick={() => setUssdInput(prev => prev + key)}
                  className="py-3 bg-white/5 rounded-xl text-white font-bold text-xs ring-1 ring-white/5 hover:bg-white/10 active:scale-95 transition-all"
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-silver/10 shadow-sm">
            <h4 className="text-[10px] font-black text-indblue uppercase tracking-[0.2em] mb-4">Tactical Protocol</h4>
            <h3 className="text-2xl font-black text-indblue mb-4 leading-tight">Infrastructure-Level Scam Interception</h3>
            <p className="text-xs text-silver font-medium leading-relaxed mb-6">
              The Bharat Layer enables rural citizens on 2G/GSM devices to report crimes via USSD gateways. These reports are directly ingested into the National Command Dashboard for rapid response.
            </p>
            <ul className="space-y-4">
              {[
                "Enter *193# to trigger USSD menu",
                "Select scam type via numeric input",
                "Real-time integration with Agency Portal",
                "Automatic generation of Section 65B FIR"
              ].map((text, i) => (
                <li key={i} className="flex items-center gap-3 text-xs font-bold text-indblue">
                  <div className="w-1.5 h-1.5 bg-saffron rounded-full" /> {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-charcoal p-6 rounded-[2rem] border border-white/5 text-white/40 font-mono text-[9px] space-y-2">
            <p className="text-indgreen">// Network Node Simulation Active</p>
            <p>USSD_GATEWAY: TRACE_NODE_DELHI_09</p>
            <p>GSM_SIGNAL: CRYPTO_STABLE_88%</p>
            <p>ENCRYPTION: AES_256_LOCAL_TUNNEL</p>
          </div>
        </div>
      </div>
    </div>
  );
}
