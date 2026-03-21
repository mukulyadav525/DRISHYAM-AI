"use client";

import { useEffect, useState } from "react";
import {
    AlertTriangle,
    BellRing,
    Languages,
    Loader2,
    MapPin,
    MessageSquare,
    Mic,
    Radio,
    Send,
    ShieldCheck,
    SignalHigh,
    Smartphone,
    TowerControl as Tower,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";

interface BharatStats {
    states_covered: number;
    central_registry_sync: string;
    ndr_compliance: string;
    interstate_cases_solved: number;
    regions: {
        id: string;
        name: string;
        towers: number;
        reach: string;
    }[];
}

interface LanguagePack {
    code: string;
    name: string;
    script: string;
    regions: string[];
    channels: string[];
    greeting: string;
    sample_menu: string;
    low_literacy_prompt: string;
}

interface BharatCoverage {
    total_feature_phone_reports: number;
    channel_breakdown: {
        channel: string;
        value: number;
    }[];
    language_breakdown: {
        code: string;
        name: string;
        value: number;
    }[];
    regional_queue: {
        id: string;
        name: string;
        incident_count: number;
        dominant_channel: string;
    }[];
    sms_delivery_rate: number;
    ivr_callbacks_pending: number;
    low_signal_ready: boolean;
}

interface BharatIncident {
    report_id: string;
    scam_type: string;
    channel: string;
    language: string;
    language_name: string;
    region: string;
    region_name: string;
    priority: string;
    status: string;
    reporter: string;
    created_at?: string | null;
    next_action: string;
    summary: string;
}

interface UssdMenu {
    language: string;
    region: string;
    text: string;
    low_literacy_prompt: string;
    callback_eta: string;
}

interface IvrScript {
    language: string;
    region: string;
    scenario: string;
    voice: string;
    greeting: string;
    steps: string[];
    low_literacy_prompt: string;
    callback_eta: string;
}

interface SmsTemplate {
    alert_type: string;
    language: string;
    language_name: string;
    region: string;
    channel: string;
    template_id: string;
    text: string;
}

function formatTimestamp(value?: string | null) {
    if (!value) {
        return "Just now";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "Just now";
    }

    return parsed.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function BharatPage() {
    const { performAction } = useActions();
    const [stats, setStats] = useState<BharatStats | null>(null);
    const [coverage, setCoverage] = useState<BharatCoverage | null>(null);
    const [incidents, setIncidents] = useState<BharatIncident[]>([]);
    const [languages, setLanguages] = useState<LanguagePack[]>([]);
    const [ussdMenu, setUssdMenu] = useState<UssdMenu | null>(null);
    const [ivrScript, setIvrScript] = useState<IvrScript | null>(null);
    const [smsTemplate, setSmsTemplate] = useState<SmsTemplate | null>(null);
    const [selectedRegion, setSelectedRegion] = useState("north");
    const [selectedLanguage, setSelectedLanguage] = useState("hi");
    const [selectedAlertType, setSelectedAlertType] = useState("regional_warning");
    const [ussdScamType, setUssdScamType] = useState("Bank KYC Fraud");
    const [isLoading, setIsLoading] = useState(true);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    const regionOptions = stats?.regions || [
        { id: "north", name: "North India (Haryana/Punjab)", towers: 1240, reach: "8.2M" },
        { id: "east", name: "East India (Bihar/WB)", towers: 2150, reach: "12.4M" },
        { id: "west", name: "West India (Rajasthan/Gujarat)", towers: 1890, reach: "10.1M" },
        { id: "south", name: "South India (Karnataka/TN)", towers: 2450, reach: "15.2M" },
    ];
    const currentRegion = regionOptions.find((region) => region.id === selectedRegion) || regionOptions[0];
    const currentLanguage = languages.find((language) => language.code === selectedLanguage) || null;

    const loadOperationalData = async () => {
        const [statsRes, coverageRes, incidentsRes, languagesRes] = await Promise.all([
            fetch(`${API_BASE}/system/stats/bharat`),
            fetch(`${API_BASE}/bharat/coverage`),
            fetch(`${API_BASE}/bharat/incidents?limit=6`),
            fetch(`${API_BASE}/bharat/languages`),
        ]);

        const statsData = statsRes.ok ? await statsRes.json() : null;
        const coverageData = coverageRes.ok ? await coverageRes.json() : null;
        const incidentsData = incidentsRes.ok ? await incidentsRes.json() : { incidents: [] };
        const languagesData = languagesRes.ok ? await languagesRes.json() : { languages: [] };

        setStats(statsData);
        setCoverage(coverageData);
        setIncidents(Array.isArray(incidentsData.incidents) ? incidentsData.incidents : []);
        setLanguages(Array.isArray(languagesData.languages) ? languagesData.languages : []);
        setSelectedRegion((previous) => previous || statsData?.regions?.[0]?.id || "north");
        setSelectedLanguage((previous) => previous || languagesData?.languages?.[0]?.code || "hi");
    };

    const loadPreviews = async () => {
        if (!selectedLanguage || !selectedRegion) {
            return;
        }

        setIsPreviewLoading(true);
        try {
            const [ussdRes, ivrRes, smsRes] = await Promise.all([
                fetch(`${API_BASE}/bharat/ussd/menu?lang=${selectedLanguage}&region=${selectedRegion}`),
                fetch(`${API_BASE}/bharat/ivr/script?lang=${selectedLanguage}&region=${selectedRegion}`),
                fetch(`${API_BASE}/bharat/templates/sms?lang=${selectedLanguage}&region=${selectedRegion}&alert_type=${selectedAlertType}`),
            ]);

            if (ussdRes.ok) {
                setUssdMenu(await ussdRes.json());
            }
            if (ivrRes.ok) {
                setIvrScript(await ivrRes.json());
            }
            if (smsRes.ok) {
                setSmsTemplate(await smsRes.json());
            }
        } catch (error) {
            console.error("Error loading Bharat previews:", error);
            toast.error("Unable to refresh Bharat previews.");
        } finally {
            setIsPreviewLoading(false);
        }
    };

    useEffect(() => {
        const load = async () => {
            try {
                await loadOperationalData();
            } catch (error) {
                console.error("Error loading Bharat data:", error);
                toast.error("Unable to load Bharat operations data.");
            } finally {
                setIsLoading(false);
            }
        };

        void load();
    }, []);

    useEffect(() => {
        void loadPreviews();
    }, [selectedAlertType, selectedLanguage, selectedRegion]);

    const refreshLiveState = async () => {
        await loadOperationalData();
        await loadPreviews();
    };

    const handleUssdLog = async () => {
        setIsSubmitting(true);
        try {
            const params = new URLSearchParams({
                phone_number: "919988776655",
                scam_type: ussdScamType || "General Fraud",
                lang: selectedLanguage,
                region: selectedRegion,
            });

            const res = await fetch(`${API_BASE}/bharat/ussd/report?${params.toString()}`, {
                method: "POST",
            });

            if (!res.ok) {
                throw new Error("USSD report logging failed");
            }

            const data = await res.json();
            toast.success(`USSD case ${data.case_id} queued with SMS confirmation.`);
            await refreshLiveState();
        } catch (error) {
            console.error("USSD report error:", error);
            toast.error("Unable to log the USSD report.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleIvrQueue = async () => {
        setIsSubmitting(true);
        try {
            const params = new URLSearchParams({
                phone_number: "919988776655",
                scam_type: ussdScamType || "General Fraud",
                lang: selectedLanguage,
                region: selectedRegion,
            });

            const res = await fetch(`${API_BASE}/bharat/ivr/report?${params.toString()}`, {
                method: "POST",
            });

            if (!res.ok) {
                throw new Error("IVR callback queue failed");
            }

            const data = await res.json();
            toast.success(`IVR callback ${data.ivr_ticket} queued.`);
            await refreshLiveState();
        } catch (error) {
            console.error("IVR queue error:", error);
            toast.error("Unable to queue IVR callback.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBroadcast = async () => {
        if (!currentRegion) {
            toast.error("Select a region first.");
            return;
        }

        setIsBroadcasting(true);
        const loadingId = toast.loading(`Preparing ${smsTemplate?.template_id || "regional alert"}...`);
        try {
            await performAction("DEPLOY_BHARAT_ALERT", currentRegion.id, {
                language: selectedLanguage,
                alert_type: selectedAlertType,
                template_id: smsTemplate?.template_id,
                preview_text: smsTemplate?.text,
            });
            toast.success(`Alert deployment initiated for ${currentRegion.name}.`, { id: loadingId });
        } catch (error) {
            console.error("Broadcast action failed:", error);
            toast.error("Broadcast action failed.", { id: loadingId });
        } finally {
            setIsBroadcasting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-indblue" size={40} />
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8 max-w-7xl">
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-indblue tracking-tight">Bharat Feature Phone Layer</h2>
                    <p className="text-silver mt-2 max-w-3xl">
                        Regional USSD, IVR, and SMS command workflow for low-signal citizens, feature phones, and multilingual incident intake.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="bg-white p-3 rounded-2xl border border-silver/10 shadow-sm flex items-center gap-3">
                        <SignalHigh className="text-indgreen" size={20} />
                        <div>
                            <p className="text-[10px] font-bold text-indblue uppercase">Coverage</p>
                            <p className="text-xs font-bold text-indgreen">{coverage?.low_signal_ready ? "2G / LOW-SIGNAL READY" : "CHECKING"}</p>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-silver/10 shadow-sm flex items-center gap-3">
                        <ShieldCheck className="text-saffron" size={20} />
                        <div>
                            <p className="text-[10px] font-bold text-indblue uppercase">Registry Sync</p>
                            <p className="text-xs font-bold text-charcoal">{stats?.central_registry_sync || "SYNCING"}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-silver/10 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Feature-Phone Reports</p>
                    <p className="text-3xl font-black text-indblue mt-2">{coverage?.total_feature_phone_reports || 0}</p>
                    <p className="text-xs text-silver mt-2">Live USSD and IVR incidents currently visible to the command center.</p>
                </div>
                <div className="bg-white rounded-2xl border border-silver/10 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">IVR Callbacks Pending</p>
                    <p className="text-3xl font-black text-redalert mt-2">{coverage?.ivr_callbacks_pending || 0}</p>
                    <p className="text-xs text-silver mt-2">USSD reports that still need spoken follow-up for fuller evidence capture.</p>
                </div>
                <div className="bg-white rounded-2xl border border-silver/10 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">SMS Delivery Rate</p>
                    <p className="text-3xl font-black text-indgreen mt-2">{coverage?.sms_delivery_rate || 0}%</p>
                    <p className="text-xs text-silver mt-2">Regional confirmation templates are being simulated through the Bharat notification rail.</p>
                </div>
                <div className="bg-white rounded-2xl border border-silver/10 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Languages Active</p>
                    <p className="text-3xl font-black text-saffron mt-2">{languages.length}</p>
                    <p className="text-xs text-silver mt-2">{stats?.states_covered || 0} states covered with pilot region routing and selected-language prompts.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-4 space-y-6">
                    <div className="bg-white rounded-3xl border border-silver/10 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-indblue/5 rounded-2xl text-indblue">
                                <Smartphone size={22} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-indblue">Feature-Phone Console</h3>
                                <p className="text-xs text-silver">Select a pilot region and language, then test the live Bharat reporting rails.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-silver">Region</label>
                                <select
                                    value={selectedRegion}
                                    onChange={(event) => setSelectedRegion(event.target.value)}
                                    className="w-full mt-2 p-3 bg-boxbg rounded-xl border border-silver/10 text-sm font-semibold outline-none"
                                >
                                    {regionOptions.map((region) => (
                                        <option key={region.id} value={region.id}>
                                            {region.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-silver">Language</label>
                                <select
                                    value={selectedLanguage}
                                    onChange={(event) => setSelectedLanguage(event.target.value)}
                                    className="w-full mt-2 p-3 bg-boxbg rounded-xl border border-silver/10 text-sm font-semibold outline-none"
                                >
                                    {languages.map((language) => (
                                        <option key={language.code} value={language.code}>
                                            {language.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-charcoal text-white min-h-[260px] flex flex-col">
                            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-white/50">
                                <span>USSD Session</span>
                                <span>{isPreviewLoading ? "Refreshing..." : currentLanguage?.script || "Pilot Pack"}</span>
                            </div>
                            <div className="mt-4 rounded-2xl bg-[#B4C494] text-indblue p-4 flex-1 font-mono text-xs whitespace-pre-wrap leading-relaxed border border-white/10">
                                {ussdMenu?.text || "Loading regional menu..."}
                            </div>
                            <p className="text-[11px] text-white/70 mt-4 leading-relaxed">
                                {ussdMenu?.low_literacy_prompt || "Voice fallback guidance will appear here."}
                            </p>
                        </div>

                        <div className="mt-4 space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-silver">Scam Category</label>
                            <input
                                type="text"
                                value={ussdScamType}
                                onChange={(event) => setUssdScamType(event.target.value)}
                                className="w-full p-3 bg-boxbg border border-silver/10 rounded-xl outline-none text-sm"
                                placeholder="Example: UPI freeze scam"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                            <button
                                onClick={() => void handleUssdLog()}
                                disabled={isSubmitting}
                                className="px-4 py-3 bg-saffron text-white rounded-xl font-bold text-sm hover:bg-deeporange transition-colors disabled:opacity-50"
                            >
                                {isSubmitting ? "Logging..." : "Log USSD Report"}
                            </button>
                            <button
                                onClick={() => void handleIvrQueue()}
                                disabled={isSubmitting}
                                className="px-4 py-3 bg-indblue text-white rounded-xl font-bold text-sm hover:bg-charcoal transition-colors disabled:opacity-50"
                            >
                                {isSubmitting ? "Queueing..." : "Queue IVR Callback"}
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-silver/10 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <Radio className="text-redalert" size={20} />
                            <div>
                                <h3 className="text-lg font-bold text-indblue">Regional Broadcast Control</h3>
                                <p className="text-xs text-silver">Push previewed SMS content toward the selected regional grid.</p>
                            </div>
                        </div>

                        <label className="text-[10px] font-bold uppercase tracking-widest text-silver">Alert Type</label>
                        <select
                            value={selectedAlertType}
                            onChange={(event) => setSelectedAlertType(event.target.value)}
                            className="w-full mt-2 p-3 bg-boxbg rounded-xl border border-silver/10 text-sm font-semibold outline-none"
                        >
                            <option value="regional_warning">Regional Warning</option>
                            <option value="case_registered">Case Registered</option>
                            <option value="ivr_callback">IVR Callback</option>
                        </select>

                        <div className="mt-4 p-4 bg-boxbg rounded-2xl border border-silver/10">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Broadcast Footprint</p>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-indgreen">{currentRegion?.reach || "--"} reach</span>
                            </div>
                            <p className="text-sm font-bold text-indblue mt-2">{currentRegion?.name || "Regional grid"}</p>
                            <p className="text-xs text-silver mt-2">{currentRegion?.towers || 0} towers available for priority routing.</p>
                        </div>

                        <button
                            onClick={() => void handleBroadcast()}
                            disabled={isBroadcasting}
                            className="w-full mt-4 bg-redalert text-white py-3 rounded-xl font-bold text-sm hover:bg-indblue transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isBroadcasting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                            {isBroadcasting ? "Deploying..." : "Deploy Bharat Alert"}
                        </button>
                    </div>
                </div>

                <div className="xl:col-span-4 space-y-6">
                    <div className="bg-white rounded-3xl border border-silver/10 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <Mic className="text-saffron" size={20} />
                            <div>
                                <h3 className="text-lg font-bold text-indblue">IVR Voice Script</h3>
                                <p className="text-xs text-silver">Selected pilot-language voice journey for low-literacy reporting.</p>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-indblue text-white">
                            <p className="text-[10px] uppercase tracking-widest text-white/60">Voice Pack</p>
                            <p className="text-sm font-bold mt-1">{ivrScript?.voice || "Loading..."}</p>
                            <p className="text-xs text-white/80 mt-3">{ivrScript?.greeting}</p>
                        </div>

                        <div className="space-y-3 mt-4">
                            {(ivrScript?.steps || []).map((step, index) => (
                                <div key={step} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Step {index + 1}</p>
                                    <p className="text-sm text-charcoal mt-2">{step}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 p-4 rounded-2xl bg-redalert/5 border border-redalert/10">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-redalert">Low-Literacy Prompt</p>
                            <p className="text-sm text-charcoal mt-2">{ivrScript?.low_literacy_prompt}</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-silver/10 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <MessageSquare className="text-indgreen" size={20} />
                            <div>
                                <h3 className="text-lg font-bold text-indblue">Regional SMS Preview</h3>
                                <p className="text-xs text-silver">Live template content from the Bharat messaging rail.</p>
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-boxbg border border-silver/10">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-silver">{smsTemplate?.template_id || "Template"}</p>
                                    <p className="text-xs text-indblue font-semibold mt-1">{smsTemplate?.language_name || currentLanguage?.name || "Pilot language"}</p>
                                </div>
                                <BellRing className="text-saffron" size={18} />
                            </div>
                            <p className="text-sm text-charcoal leading-relaxed mt-4">{smsTemplate?.text || "Loading SMS template..."}</p>
                        </div>

                        <div className="mt-4 flex items-start gap-3 text-xs text-silver">
                            <Tower size={16} className="text-indblue mt-0.5" />
                            <p>
                                Delivery target: {currentRegion?.reach || "--"} users across {currentRegion?.towers || 0} towers with {stats?.ndr_compliance || "--"} compliance.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-4 space-y-6">
                    <div className="bg-white rounded-3xl border border-silver/10 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle className="text-redalert" size={20} />
                            <div>
                                <h3 className="text-lg font-bold text-indblue">Feature-Phone Incident Queue</h3>
                                <p className="text-xs text-silver">Live queue from USSD and IVR intake pathways.</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {incidents.map((incident) => (
                                <div key={incident.report_id} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-silver">{incident.report_id}</p>
                                            <p className="text-sm font-bold text-charcoal mt-1">{incident.scam_type}</p>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full bg-redalert/10 text-redalert text-[10px] font-bold uppercase tracking-wide">
                                            {incident.channel}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mt-4 text-xs text-silver">
                                        <div>
                                            <p className="font-bold text-indblue">{incident.language_name}</p>
                                            <p>{incident.region_name}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-charcoal">{incident.priority}</p>
                                            <p>{incident.status}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-charcoal mt-3 leading-relaxed">{incident.summary}</p>
                                    <div className="flex items-center justify-between mt-4 text-[10px] uppercase tracking-widest text-silver">
                                        <span>{incident.reporter}</span>
                                        <span>{formatTimestamp(incident.created_at)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border border-silver/10 p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-5">
                        <MapPin className="text-saffron" size={20} />
                        <div>
                            <h3 className="text-lg font-bold text-indblue">Regional Queue Pressure</h3>
                            <p className="text-xs text-silver">Where feature-phone incidents are concentrating right now.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {(coverage?.regional_queue || []).map((region) => {
                            const maxIncidents = Math.max(...(coverage?.regional_queue || [{ incident_count: 1 }]).map((item) => item.incident_count), 1);
                            const width = `${Math.max((region.incident_count / maxIncidents) * 100, 12)}%`;

                            return (
                                <div key={region.id}>
                                    <div className="flex items-center justify-between text-sm mb-2">
                                        <span className="font-bold text-charcoal">{region.name}</span>
                                        <span className="text-silver text-xs uppercase tracking-widest">{region.dominant_channel}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-boxbg overflow-hidden">
                                        <div className="h-full rounded-full bg-gradient-to-r from-saffron to-redalert" style={{ width }} />
                                    </div>
                                    <p className="text-xs text-silver mt-2">{region.incident_count} live incidents in queue</p>
                                </div>
                            );
                        })}
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-6">
                        {(coverage?.channel_breakdown || []).map((channel) => (
                            <div key={channel.channel} className="p-3 rounded-2xl bg-boxbg border border-silver/10 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-silver">{channel.channel}</p>
                                <p className="text-xl font-black text-indblue mt-1">{channel.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-silver/10 p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-5">
                        <Languages className="text-indblue" size={20} />
                        <div>
                            <h3 className="text-lg font-bold text-indblue">Pilot Language Packs</h3>
                            <p className="text-xs text-silver">Eight-language Bharat pilot with USSD, IVR, and SMS support.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {languages.map((language) => (
                            <button
                                key={language.code}
                                onClick={() => setSelectedLanguage(language.code)}
                                className={`px-3 py-2 rounded-full border text-xs font-bold uppercase tracking-widest transition-colors ${
                                    selectedLanguage === language.code
                                        ? "bg-indblue text-white border-indblue"
                                        : "bg-boxbg text-indblue border-silver/10 hover:border-saffron/40"
                                }`}
                            >
                                {language.name}
                            </button>
                        ))}
                    </div>

                    <div className="mt-5 p-5 rounded-2xl bg-boxbg border border-silver/10">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-silver">Selected Pack</p>
                        <p className="text-lg font-black text-indblue mt-2">{currentLanguage?.name || "Language pack"}</p>
                        <p className="text-xs text-silver mt-1">{currentLanguage?.script || "--"} script</p>
                        <p className="text-sm text-charcoal mt-4 leading-relaxed">{currentLanguage?.greeting}</p>
                        <p className="text-xs text-silver mt-4">{currentLanguage?.low_literacy_prompt}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                        {(coverage?.language_breakdown || []).map((language) => (
                            <div key={language.code} className="p-4 rounded-2xl bg-boxbg border border-silver/10">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-silver">{language.code}</p>
                                <p className="text-sm font-bold text-charcoal mt-1">{language.name}</p>
                                <p className="text-xs text-silver mt-2">{language.value} incidents in recent Bharat intake</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
