"use client";

import { useEffect, useState } from "react";
import {
    AlertTriangle,
    Bell,
    CheckCircle2,
    Clock,
    Globe,
    Loader2,
    MapPin,
    Send,
    Users,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useLanguage } from "@/context/LanguageContext";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";
import FeedModal from "@/components/FeedModal";
import type { FeedModalData } from "@/components/FeedModal";

interface Scenario {
    id: string;
    title: string;
    severity: string;
    description?: string;
}

interface CoverageState {
    citizens: number;
    districts: number;
    delivery: number;
    active_broadcast_channels: string[];
    latency_sec: number;
}

interface RecentAlert {
    id: string;
    message: string;
    region: string;
    scenario_title: string;
    citizens_notified: number;
    delivery_rate_percent: number;
    status: string;
    sent_at?: string | null;
    channels: string[];
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

export default function AlertsPage() {
    const { t } = useLanguage();
    const { performAction } = useActions();
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDispatching, setIsDispatching] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState<FeedModalData | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [targetRegion, setTargetRegion] = useState("national");
    const [selectedScenarioId, setSelectedScenarioId] = useState("");
    const [alertMessage, setAlertMessage] = useState("");
    const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
    const [coverage, setCoverage] = useState<CoverageState>({
        citizens: 1480000,
        districts: 766,
        delivery: 94,
        active_broadcast_channels: ["SMS", "IVR", "WHATSAPP", "FM_RADIO"],
        latency_sec: 4,
    });

    const fetchCoverage = async (region: string) => {
        try {
            const res = await fetch(`${API_BASE}/system/alerts/coverage?region=${region}`);
            if (res.ok) {
                const json = await res.json();
                setCoverage({
                    citizens: json.citizens || 0,
                    districts: json.districts || 0,
                    delivery: json.delivery || 0,
                    active_broadcast_channels: json.active_broadcast_channels || [],
                    latency_sec: json.latency_sec || 0,
                });
            }
        } catch (error) {
            console.error("Error fetching coverage:", error);
        }
    };

    const fetchRecentAlerts = async () => {
        try {
            const res = await fetch(`${API_BASE}/notifications/history/recent?limit=6`);
            if (res.ok) {
                const json = await res.json();
                setRecentAlerts(Array.isArray(json.alerts) ? json.alerts : []);
            }
        } catch (error) {
            console.error("Error fetching alert history:", error);
        }
    };

    useEffect(() => {
        void fetchCoverage(targetRegion);
    }, [targetRegion]);

    useEffect(() => {
        const fetchScenarios = async () => {
            try {
                const [scenarioRes] = await Promise.all([
                    fetch(`${API_BASE}/inoculation/scenarios`),
                    fetchRecentAlerts(),
                ]);

                if (scenarioRes.ok) {
                    const json = await scenarioRes.json();
                    const loadedScenarios = Array.isArray(json?.scenarios) ? json.scenarios : [];
                    setScenarios(loadedScenarios);
                    if (loadedScenarios.length > 0) {
                        setSelectedScenarioId(loadedScenarios[0].id);
                        setAlertMessage(`DRISHYAM advisory: ${loadedScenarios[0].title} activity detected. Do not share OTP, PIN, or payment approval.`);
                    }
                }
            } catch (error) {
                console.error("Error fetching scenarios:", error);
            } finally {
                setIsLoading(false);
            }
        };
        void fetchScenarios();
    }, []);

    const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId);

    const handleScenarioChange = (scenarioId: string) => {
        setSelectedScenarioId(scenarioId);
        const scenario = scenarios.find((item) => item.id === scenarioId);
        if (scenario) {
            setAlertMessage(`DRISHYAM advisory: ${scenario.title} activity detected in ${targetRegion}. Stay alert and report suspicious requests immediately.`);
        }
    };

    const handleSendPreview = async () => {
        if (!alertMessage || !selectedScenario) {
            return;
        }

        setIsDispatching(true);
        try {
            const res = await fetch(`${API_BASE}/notifications/citizen/push-alert`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    region: targetRegion,
                    message: alertMessage,
                    scenario_title: selectedScenario.title,
                    channels: coverage.active_broadcast_channels.slice(0, 2).length > 0 ? coverage.active_broadcast_channels.slice(0, 2) : ["SMS", "PUSH"],
                }),
            });

            if (!res.ok) {
                throw new Error("Alert dispatch failed");
            }

            const payload = await res.json();
            await performAction("PREVIEW_SEND_ALERT", targetRegion, {
                alert_id: payload.alert_id,
                region: targetRegion,
                citizens_notified: payload.citizens_notified,
            });

            toast.success(`Alert ${payload.alert_id} prepared for ${payload.citizens_notified.toLocaleString()} citizens.`);
            setAlertMessage("");
            await Promise.all([fetchCoverage(targetRegion), fetchRecentAlerts()]);
        } catch (error) {
            console.error("Dispatch error:", error);
            toast.error("Unable to dispatch the alert preview.");
        } finally {
            setIsDispatching(false);
        }
    };

    if (isLoading && scenarios.length === 0) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-indblue" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-indblue tracking-tight">{t("public_alert_console")}</h2>
                    <p className="text-silver mt-1">{t("broadcast_warnings")}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => performAction("VIEW_ALERT_HISTORY")}
                        className="px-4 py-2 bg-white border border-silver/10 rounded-lg text-sm font-semibold text-charcoal hover:bg-boxbg transition-colors"
                    >
                        {t("alert_history")}
                    </button>
                    <button
                        onClick={() => performAction("BROADCAST_EMERGENCY")}
                        className="px-4 py-2 bg-redalert text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors flex items-center gap-2 shadow-lg shadow-redalert/20"
                    >
                        <Bell size={16} /> {t("broadcast_emergency")}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl border border-silver/10 p-8 shadow-sm">
                        <h3 className="font-bold text-indblue mb-6 flex items-center gap-2">
                            <Send size={18} className="text-saffron" />
                            {t("new_composer")}
                        </h3>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-silver uppercase tracking-widest">{t("alert_category")}</label>
                                    <select
                                        value={selectedScenarioId}
                                        onChange={(event) => handleScenarioChange(event.target.value)}
                                        className="w-full p-3 bg-boxbg border border-silver/10 rounded-xl text-sm font-semibold text-indblue outline-none focus:border-saffron/40"
                                    >
                                        {scenarios.map((scenario) => (
                                            <option key={scenario.id} value={scenario.id}>
                                                {scenario.title} ({scenario.severity})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-silver uppercase tracking-widest">{t("target_region")}</label>
                                    <select
                                        value={targetRegion}
                                        onChange={(event) => setTargetRegion(event.target.value)}
                                        className="w-full p-3 bg-boxbg border border-silver/10 rounded-xl text-sm font-semibold text-indblue outline-none focus:border-saffron/40"
                                    >
                                        <option value="national">National (All Users)</option>
                                        <option value="delhi">Delhi-NCR Cluster</option>
                                        <option value="mh">Maharashtra State</option>
                                        <option value="ka">Rural Karnataka</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-silver uppercase tracking-widest">{t("alert_message")}</label>
                                <textarea
                                    rows={4}
                                    value={alertMessage}
                                    onChange={(event) => setAlertMessage(event.target.value)}
                                    className="w-full p-4 bg-boxbg border border-silver/10 rounded-xl text-sm font-medium text-charcoal outline-none focus:border-saffron/40 resize-none"
                                    placeholder="Draft your scam warning message here..."
                                />
                                <div className="flex justify-between items-center text-[10px] text-silver font-bold uppercase py-1">
                                    <span>{t("standard_templates")}</span>
                                    <span>{alertMessage.length} / 160 Characters</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 p-4 bg-saffron/5 border border-saffron/10 rounded-xl">
                                <div className="w-10 h-10 rounded-full bg-saffron/10 flex items-center justify-center text-saffron">
                                    <Globe size={20} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-indblue">Dispatch Channels</p>
                                    <p className="text-[10px] text-silver font-medium">
                                        {(coverage.active_broadcast_channels || []).join(" • ") || "SMS • PUSH"}
                                    </p>
                                </div>
                                <span className="text-[10px] font-bold text-saffron uppercase">Latency {coverage.latency_sec}s</span>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    onClick={() => performAction("SAVE_ALERT_DRAFT", alertMessage.substring(0, 10) + "...")}
                                    disabled={!alertMessage}
                                    className="px-6 py-3 rounded-xl border border-silver/10 text-sm font-bold text-silver hover:bg-boxbg transition-all uppercase tracking-widest disabled:opacity-50"
                                >
                                    {t("save_draft")}
                                </button>
                                <button
                                    onClick={() => void handleSendPreview()}
                                    disabled={!alertMessage || isDispatching}
                                    className="px-8 py-3 rounded-xl bg-indblue text-white text-sm font-bold hover:bg-charcoal transition-all uppercase tracking-widest shadow-lg shadow-indblue/20 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isDispatching ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                                    {t("preview_send")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-silver/10 p-6">
                        <h4 className="font-bold text-indblue mb-6">{t("audience_coverage")}</h4>
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-indblue/5 flex items-center justify-center text-indblue">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-indblue">{coverage.citizens.toLocaleString()} Citizens</p>
                                    <p className="text-[10px] text-silver font-medium uppercase tracking-widest">{t("target_reach")}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-saffron/5 flex items-center justify-center text-saffron">
                                    <MapPin size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-indblue">{coverage.districts} Districts</p>
                                    <p className="text-[10px] text-silver font-medium uppercase tracking-widest">{t("geo_spread")}</p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-silver/5">
                                <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                                    <span className="text-silver">{t("priority_delivery")}</span>
                                    <span className="text-indgreen">{coverage.delivery}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-boxbg rounded-full overflow-hidden">
                                    <div className="h-full bg-indgreen transition-all duration-1000" style={{ width: `${coverage.delivery}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-silver/10 p-6">
                        <h4 className="font-bold text-indblue mb-6">{t("recent_records")}</h4>
                        <div className="space-y-4">
                            {recentAlerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    onClick={() => {
                                        setSelectedAlert({
                                            victim_id: alert.id,
                                            location: alert.region,
                                            scam_type: alert.scenario_title,
                                            risk_score: alert.delivery_rate_percent >= 96 ? 0.82 : 0.68,
                                            status: alert.status,
                                            evidence: [
                                                `Channels: ${(alert.channels || []).join(", ")}`,
                                                `Citizens notified: ${alert.citizens_notified.toLocaleString()}`,
                                                `Delivery rate: ${alert.delivery_rate_percent}%`,
                                            ],
                                        });
                                        setIsModalOpen(true);
                                    }}
                                    className="flex gap-3 group cursor-pointer pb-4 border-b border-boxbg last:border-0 last:pb-0"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-boxbg flex items-center justify-center text-silver group-hover:bg-saffron/10 group-hover:text-saffron transition-all">
                                        <CheckCircle2 size={16} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-indblue group-hover:text-saffron transition-colors">{alert.scenario_title}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Clock size={10} className="text-silver" />
                                            <span className="text-[10px] text-silver font-medium">{formatTimestamp(alert.sent_at)}</span>
                                        </div>
                                        <p className="text-[10px] text-silver mt-1">{alert.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-redalert p-6 rounded-2xl text-white shadow-xl flex items-start gap-4">
                        <AlertTriangle className="flex-shrink-0 mt-1" />
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider mb-1">{t("critical_note")}</p>
                            <p className="text-[11px] leading-relaxed opacity-90">
                                Broadcast content should stay short, multilingual, and action-oriented. Avoid links or callback numbers that create new scam risk.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <FeedModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                data={selectedAlert}
            />
        </div>
    );
}
