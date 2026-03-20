"use client";

import { Phone, ArrowRight, User, Loader2 } from "lucide-react";
import { API_BASE } from "@/config/api";
import { toast } from "react-hot-toast";

interface AuthScreenProps {
  authStatus: "login" | "pending" | "approved";
  setAuthStatus: (status: "login" | "pending" | "approved") => void;
  customerId: string;
  setCustomerId: (id: string) => void;
}

export default function AuthScreen({
  authStatus,
  setAuthStatus,
  customerId,
  setCustomerId,
}: AuthScreenProps) {
  const handleRequestAccess = async () => {
    if (customerId.length >= 10) {
      try {
        const res = await fetch(`${API_BASE}/auth/simulation/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone_number: customerId })
        });
        if (res.ok) {
          setAuthStatus("pending");
          toast.success(`Request Sent to HQ: ${customerId}`);
        } else {
          toast.error(`HQ Rejected Request: ${res.status}`);
        }
      } catch (e: any) {
        toast.error("HQ Connection Failed: " + e.message);
      }
    } else {
      toast.error("Please enter a valid Phone Number");
    }
  };

  if (authStatus === "login") {
    return (
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl border border-silver/10 fade-in">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 bg-indblue rounded-3xl flex items-center justify-center text-white mb-6 shadow-xl shadow-indblue/20">
            <User size={40} />
          </div>
          <h2 className="text-3xl font-black text-indblue tracking-tight mb-2">Citizen Login</h2>
          <p className="text-sm text-silver font-medium">Verify your phone to enter the protective grid.</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indblue uppercase tracking-widest ml-1">Phone Number</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Enter 10-digit Phone Number"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full bg-boxbg border border-silver/20 rounded-2xl px-5 py-4 text-sm font-bold text-indblue focus:outline-none focus:border-indblue transition-all"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-silver">
                <Phone size={20} />
              </div>
            </div>
          </div>

          <button
            onClick={handleRequestAccess}
            className="w-full py-5 bg-indblue text-white rounded-2xl font-black text-sm hover:bg-indblue/90 transition-all shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            REQUEST ACCESS <ArrowRight size={18} />
          </button>

          <div className="pt-4 flex items-center gap-3">
            <div className="h-[1px] flex-1 bg-silver/10" />
            <span className="text-[10px] font-black text-silver/40 uppercase tracking-[0.2em]">Secured by BASIG</span>
            <div className="h-[1px] flex-1 bg-silver/10" />
          </div>
        </div>
      </div>
    );
  }

  if (authStatus === "pending") {
    return (
      <div className="w-full max-w-md bg-white rounded-[3rem] p-12 shadow-2xl border border-silver/10 text-center fade-in">
        <div className="w-24 h-24 bg-saffron/10 text-saffron rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
          <Loader2 size={48} className="animate-spin" />
        </div>
        <h2 className="text-3xl font-black text-indblue mb-4 tracking-tight">Access Pending</h2>
        <p className="text-silver text-sm font-medium mb-10 px-4">
          Security clearance is being verified by the National Command Dashboard. Please wait for official approval.
        </p>
        
        <div className="w-full h-2 bg-boxbg rounded-full overflow-hidden mt-8">
          <div className="h-full bg-saffron animate-[pulse_2s_infinite]" style={{width: '60%'}} />
        </div>
        <p className="text-[10px] text-silver font-bold uppercase tracking-widest mt-6">
          Connecting to <span className="text-indblue">DRISHYAM HQ...</span>
        </p>
      </div>
    );
  }

  return null;
}
