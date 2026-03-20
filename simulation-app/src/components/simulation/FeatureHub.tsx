"use client";

import { Mic, ShieldAlert, Zap, Smartphone, ArrowRight, X } from "lucide-react";

interface FeatureHubProps {
  setActiveFeature: (feature: "chat" | "deepfake" | "upi" | "bharat" | null) => void;
  setAuthStatus: (status: "login" | "pending" | "approved") => void;
}

export default function FeatureHub({
  setActiveFeature,
  setAuthStatus,
}: FeatureHubProps) {
  return (
    <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 p-4 sm:p-6 fade-in">
      <div className="col-span-1 sm:col-span-2 lg:col-span-4 text-center mb-4 sm:mb-6">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-indblue tracking-tighter mb-2">Unified Defense Simulation</h2>
        <p className="text-silver text-xs sm:text-sm font-bold uppercase tracking-[0.2em]">Select an anti-fraud operational module</p>
      </div>

      {/* Feature 1: Chat */}
      <button
        onClick={() => setActiveFeature("chat")}
        className="group bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-silver/10 shadow-lg hover:shadow-2xl hover:border-indblue/20 transition-all flex flex-col items-center text-center"
      >
        <div className="w-14 h-14 sm:w-20 sm:h-20 bg-indblue/5 text-indblue rounded-2xl sm:rounded-3xl flex items-center justify-center mb-4 sm:mb-8 group-hover:bg-indblue group-hover:text-white transition-all transform group-hover:-translate-y-2">
          <Mic size={28} className="sm:w-9 sm:h-9" />
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-indblue mb-2 sm:mb-4">Voice & Video</h3>
        <p className="text-[10px] sm:text-xs text-silver font-medium leading-relaxed mb-4 sm:mb-6">Interactive AI Honeypot to intercept and analyze scam caller tactics in real-time.</p>
        <div className="mt-auto flex items-center gap-2 text-[10px] font-black text-indblue uppercase tracking-widest opacity-40 group-hover:opacity-100">
          Initialize Ops <ArrowRight size={14} />
        </div>
      </button>

      {/* Feature 2: Deepfake */}
      <button
        onClick={() => setActiveFeature("deepfake")}
        className="group bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-silver/10 shadow-lg hover:shadow-2xl hover:border-saffron/20 transition-all flex flex-col items-center text-center"
      >
        <div className="w-14 h-14 sm:w-20 sm:h-20 bg-saffron/5 text-saffron rounded-2xl sm:rounded-3xl flex items-center justify-center mb-4 sm:mb-8 group-hover:bg-saffron group-hover:text-white transition-all transform group-hover:-translate-y-2">
          <ShieldAlert size={28} className="sm:w-9 sm:h-9" />
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-indblue mb-2 sm:mb-4">Deepfake Defense</h3>
        <p className="text-[10px] sm:text-xs text-silver font-medium leading-relaxed mb-4 sm:mb-6">Visual forensics to detect synthetic identity manipulations and biometric bypass attempts.</p>
        <div className="mt-auto flex items-center gap-2 text-[10px] font-black text-saffron uppercase tracking-widest opacity-40 group-hover:opacity-100">
          Deploy Shield <ArrowRight size={14} />
        </div>
      </button>

      {/* Feature 3: UPI Shield */}
      <button
        onClick={() => setActiveFeature("upi")}
        className="group bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-silver/10 shadow-lg hover:shadow-2xl hover:border-indgreen/20 transition-all flex flex-col items-center text-center"
      >
        <div className="w-14 h-14 sm:w-20 sm:h-20 bg-indgreen/5 text-indgreen rounded-2xl sm:rounded-3xl flex items-center justify-center mb-4 sm:mb-8 group-hover:bg-indgreen group-hover:text-white transition-all transform group-hover:-translate-y-2">
          <Zap size={28} className="sm:w-9 sm:h-9" />
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-indblue mb-2 sm:mb-4">UPI Armor</h3>
        <p className="text-[10px] sm:text-xs text-silver font-medium leading-relaxed mb-4 sm:mb-6">Secure payment simulation with instant merchant verification and risk scoring.</p>
        <div className="mt-auto flex items-center gap-2 text-[10px] font-black text-indgreen uppercase tracking-widest opacity-40 group-hover:opacity-100">
          Secure App <ArrowRight size={14} />
        </div>
      </button>

      {/* Feature 4: Bharat Layer */}
      <button
        onClick={() => setActiveFeature("bharat")}
        className="group bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-silver/10 shadow-lg hover:shadow-2xl hover:border-saffron/20 transition-all flex flex-col items-center text-center"
      >
        <div className="w-14 h-14 sm:w-20 sm:h-20 bg-saffron/5 text-saffron rounded-2xl sm:rounded-3xl flex items-center justify-center mb-4 sm:mb-8 group-hover:bg-saffron group-hover:text-white transition-all transform group-hover:-translate-y-2">
          <Smartphone size={28} className="sm:w-9 sm:h-9" />
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-indblue mb-2 sm:mb-4">Bharat Layer</h3>
        <p className="text-[10px] sm:text-xs text-silver font-medium leading-relaxed mb-4 sm:mb-6">Simulation of feature phone reporting through USSD infrastructure for rural connectivity.</p>
        <div className="mt-auto flex items-center gap-2 text-[10px] font-black text-saffron uppercase tracking-widest opacity-40 group-hover:opacity-100">
          Access USSD <ArrowRight size={14} />
        </div>
      </button>
      
      <div className="col-span-1 sm:col-span-2 lg:col-span-4 text-center mt-6 sm:mt-8">
        <button
          onClick={() => setAuthStatus("login")}
          className="text-[10px] font-black text-silver hover:text-indblue transition-colors uppercase tracking-[0.2em]"
        >
          Termination Session <X size={10} className="inline ml-1" />
        </button>
      </div>
    </div>
  );
}
