"use client";

import { useState, useEffect } from "react";
import {
    Smartphone,
    MessageSquare,
    Mic,
    Radio,
    MapPin,
    TowerControl as Tower,
    ChevronRight,
    Send,
    SignalHigh,
    AlertTriangle,
    CheckCircle2,
    Database,
    Zap,
    Users,
    Loader2
} from "lucide-react";
import { useActions } from "@/hooks/useActions";
import { toast } from "react-hot-toast";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";

export default function BharatPage() {
    const { performAction } = useActions();
    const [selectedRegion, setSelectedRegion] = useState("");
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    // USSD Simulator State
    const [ussdStep, setUssdStep] = useState(0);
    const [ussdInput, setUssdInput] = useState("");
    const [ussdHistory, setUssdHistory] = useState<string[]>([]);

    const [data, setData] = useState<{ regions: any[] } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`${API_BASE}/system/stats/bharat`);
                if (res.ok) setData(await res.json());
            } catch (error) {
                console.error("Error fetching bharat stats:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, []);

    const regions = data?.regions || [
        { id: 'north', name: 'North India (Haryana/Punjab)', towers: 1240, reach: '8.2M' },
        { id: 'east', name: 'East India (Bihar/WB)', towers: 2150, reach: '12.4M' },
        { id: 'west', name: 'West India (Rajasthan/Gujarat)', towers: 1890, reach: '10.1M' }
    ];

    const currentRegionData = regions.find(r => r.id === selectedRegion);

    // USSD Logic
    const ussdFlow = [
        {
            title: "Main Menu",
            options: "1. Report Fraud\n2. Check Status\n3. Language\n4. Digital Safety Tips",
        },
        {
            title: "Report Fraud",
            options: "Enter Type:\n1. UPI/Bank\n2. Social Media\n3. Job Scam\n4. Others",
        },
        {
            title: "Incident Details",
            options: "Enter Date (DDMMYY):",
        },
        {
            title: "Processing",
            options: "Request Received. You will receive an IVR call for details. [End]",
        }
    ];

    const handleUssdSubmit = () => {
        if (ussdStep < ussdFlow.length - 1) {
            setUssdHistory([...ussdHistory, `> ${ussdInput}`]);
            setUssdStep(ussdStep + 1);
            setUssdInput("");
            if (ussdStep + 1 === ussdFlow.length - 1) {
                performAction('USE_USSD', 'REPORT_SUCCESS');
            }
        } else {
            resetUssd();
        }
    };

    const handleBroadcast = () => {
        if (!selectedRegion) return toast.error("Select a target region first");
        setIsBroadcasting(true);
        const id = toast.loading(`Handshaking with ${currentRegionData?.towers} towers...`);
        performAction('DEPLOY_BHARAT_ALERT', selectedRegion);

        setTimeout(() => toast.loading("Confirming LSA Broadcast Priority...", { id }), 800);
        setTimeout(() => toast.loading(`Pushing alert to ${currentRegionData?.reach} devices...`, { id }), 1800);
        setTimeout(() => {
            toast.success("National Strategic Alert Successfully Deployed", { id });
            setIsBroadcasting(false);
        }, 3000);
    };

    const resetUssd = () => {
        setUssdStep(0);
        setUssdInput("");
        setUssdHistory([]);
    };

    return (
        <div className="space-y-6 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-indblue tracking-tight underline decoration-saffron decoration-4 underline-offset-8">Bharat Feature Phone Layer</h2>
                    <p className="text-silver mt-4 italic font-medium">Protecting the Offline & Feature Phone Userbase (Module 5).</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-white p-3 rounded-2xl border border-silver/10 shadow-sm flex items-center gap-3">
                        <SignalHigh className="text-indgreen" size={20} />
                        <div>
                            <p className="text-[10px] font-bold text-indblue uppercase leading-none">GSM Signal Strength</p>
                            <p className="text-xs font-bold text-indgreen uppercase">High | 98% Rural Coverage</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* USSD Simulator */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-charcoal p-1 rounded-[3rem] border-8 border-indblue shadow-2xl relative overflow-hidden aspect-[9/18]">
                        <div className="absolute top-0 left-0 w-full h-8 bg-charcoal z-10 flex justify-center items-end">
                            <div className="w-20 h-4 bg-charcoal rounded-b-xl border border-white/10" />
                        </div>

                        {/* Mock Screen */}
                        <div className="bg-[#B4C494] h-full m-4 rounded-xl p-6 font-mono text-indblue flex flex-col justify-between">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-indblue/20 pb-2">
                                    <span className="text-[10px] font-bold">SIGNAL: FULL</span>
                                    <span className="text-[10px] font-bold">14:02</span>
                                </div>

                                <div className="text-sm leading-tight whitespace-pre-wrap">
                                    {ussdStep === 0 ? ussdFlow[0].options : ussdFlow[ussdStep].options}
                                </div>

                                <div className="space-y-1">
                                    {ussdHistory.map((h, i) => (
                                        <p key={i} className="text-[10px] opacity-60 italic">{h}</p>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={ussdInput}
                                    onChange={(e) => setUssdInput(e.target.value)}
                                    placeholder="Enter Response"
                                    className="w-full bg-transparent border-b-2 border-indblue outline-none py-2 text-xl font-bold placeholder:text-indblue/30"
                                    onKeyDown={(e) => e.key === 'Enter' && handleUssdSubmit()}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <button onClick={resetUssd} className="text-xs font-bold border border-indblue p-2 rounded hover:bg-indblue/10">CANCEL</button>
                                    <button onClick={handleUssdSubmit} className="text-xs font-bold bg-indblue text-[#B4C494] p-2 rounded shadow-lg uppercase">Send</button>
                                </div>
                            </div>
                        </div>

                        {/* Physical Buttons Mock */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2">
                            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />
                        </div>
                    </div>
                </div>

                {/* Dashboard Tools & Trace */}
                <div className="lg:col-span-8 space-y-8">

                    {/* Rural Alert Control Center */}
                    <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-3 bg-redalert/10 rounded-2xl text-redalert">
                                <Radio size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-indblue">National Gram Panchayat Alert Node</h3>
                                <p className="text-xs text-silver">Direct-to-Citizen (D2C) emergency broadcasts via 2G/AM/FM.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 bg-boxbg rounded-2xl border border-silver/5 space-y-4">
                                <div className="flex items-center gap-2">
                                    <MapPin size={16} className="text-saffron" />
                                    <h4 className="font-bold text-indblue text-sm">Target Region Selection</h4>
                                </div>
                                <select
                                    value={selectedRegion}
                                    onChange={(e) => setSelectedRegion(e.target.value)}
                                    className="w-full p-3 bg-white rounded-xl border border-silver/10 text-xs font-bold outline-none">
                                    <option value="">Select Target Region...</option>
                                    {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                                <div className="flex justify-between items-center text-[10px] font-bold text-silver uppercase">
                                    <span>Active Towers: {currentRegionData?.towers || '--'}</span>
                                    <span>Reach: {currentRegionData?.reach || '--'} Users</span>
                                </div>
                            </div>

                            <div className="p-6 bg-boxbg rounded-2xl border border-silver/5 space-y-4">
                                <div className="flex items-center gap-2">
                                    <Tower size={16} className="text-indblue" />
                                    <h4 className="font-bold text-indblue text-sm">Broadcast Channels</h4>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {['Cell Broadcast (2G)', 'SMS Push', 'Radio (AM/FM)', 'IVR Call Blast'].map((c, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-silver/10 text-[10px] font-bold">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indgreen" />
                                            {c}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleBroadcast}
                            disabled={isBroadcasting}
                            className={`w-full mt-6 text-white font-bold py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 group disabled:opacity-50 ${isBroadcasting ? 'bg-silver' : 'bg-redalert hover:bg-indblue'}`}>
                            {isBroadcasting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} className="group-hover:translate-x-1 transition-transform" />}
                            {isBroadcasting ? 'DEPLOYING ALERT...' : 'DEPLOY BHARAT EMERGENCY ALERT'}
                        </button>
                    </div>

                    {/* IVR to AI Digital Trace */}
                    <div className="bg-indblue p-8 rounded-3xl border border-saffron/20 shadow-xl text-white relative overflow-hidden">
                        <Users size={120} className="absolute -right-8 -bottom-8 text-white/5" />
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <Mic className="text-saffron" size={24} />
                                <h3 className="text-xl font-bold uppercase tracking-tight">Voice-to-Digital Intelligence Path</h3>
                            </div>
                            <span className="text-[10px] font-bold bg-white/10 px-3 py-1 rounded-full border border-white/10 uppercase">Module 5 Bridge</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/5 -translate-y-1/2 hidden md:block" />

                            {[
                                { step: "Citizen Call", icon: Smartphone, color: "bg-saffron" },
                                { step: "ASR Transcription", icon: Mic, color: "bg-indgreen" },
                                { step: "NER Entity Filter", icon: Database, color: "bg-white/20" },
                                { step: "BASIG Core Link", icon: Zap, color: "bg-indblue" },
                            ].map((s, i) => (
                                <div key={i} className="relative z-10 flex flex-col items-center text-center space-y-3">
                                    <div className={`w-12 h-12 ${s.color} rounded-2xl flex items-center justify-center border border-white/20 shadow-lg`}>
                                        <s.icon size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider">{s.step}</p>
                                        <p className="text-[8px] opacity-40">STEP 0{i + 1}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 p-6 bg-black/20 rounded-2xl border border-white/5 font-mono text-[10px] space-y-2">
                            <p className="text-indgreen">// Real-time Audio Stream Logic</p>
                            <p className="opacity-60">Citizen ID: --</p>
                            <p className="opacity-60">Status: <span className="text-silver">WAITING FOR AUDIO STREAM...</span></p>
                            <p className="opacity-60">Detected Entity: <span className="text-silver">NONE</span></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
