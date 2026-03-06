"use client";

import { useState, useEffect } from "react";
import {
    Bell,
    Send,
    Globe,
    MapPin,
    Users,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Loader2
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useActions } from "@/hooks/useActions";
import { toast } from "react-hot-toast";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";

interface Scenario {
    id: string;
    title: string;
    severity: string;
}

export default function AlertsPage() {
    const { t } = useLanguage();
    const { performAction } = useActions();
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchScenarios = async () => {
            try {
                const res = await fetch(`${API_BASE}/inoculation/scenarios`);
                if (res.ok) {
                    const data = await res.json();
                    setScenarios(data.scenarios);
                }
            } catch (error) {
                console.error("Error fetching scenarios:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchScenarios();
    }, []);

    if (isLoading && scenarios.length === 0) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-indblue" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-indblue tracking-tight">{t("public_alert_console")}</h2>
                    <p className="text-silver mt-1">{t("broadcast_warnings")}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => performAction('VIEW_ALERT_HISTORY')}
                        className="px-4 py-2 bg-white border border-silver/10 rounded-lg text-sm font-semibold text-charcoal hover:bg-boxbg transition-colors">
                        {t("alert_history")}
                    </button>
                    <button
                        onClick={() => performAction('BROADCAST_EMERGENCY')}
                        className="px-4 py-2 bg-redalert text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors flex items-center gap-2 shadow-lg shadow-redalert/20">
                        <Bell size={16} /> {t("broadcast_emergency")}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Composition Tool */}
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
                                    <select className="w-full p-3 bg-boxbg border border-silver/10 rounded-xl text-sm font-semibold text-indblue outline-none focus:border-saffron/40">
                                        {scenarios.map(s => (
                                            <option key={s.id} value={s.id}>{s.title} ({s.severity.toUpperCase()})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-silver uppercase tracking-widest">{t("target_region")}</label>
                                    <select className="w-full p-3 bg-boxbg border border-silver/10 rounded-xl text-sm font-semibold text-indblue outline-none focus:border-saffron/40">
                                        <option>National (All Users)</option>
                                        <option>Delhi-NCR Cluster</option>
                                        <option>Maharashtra State</option>
                                        <option>Rural Karnataka</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-silver uppercase tracking-widest">{t("alert_message")}</label>
                                <textarea
                                    rows={4}
                                    className="w-full p-4 bg-boxbg border border-silver/10 rounded-xl text-sm font-medium text-charcoal outline-none focus:border-saffron/40 resize-none"
                                    placeholder="Draft your scam warning message here..."
                                ></textarea>
                                <div className="flex justify-between items-center text-[10px] text-silver font-bold uppercase py-1">
                                    <span>{t("standard_templates")}</span>
                                    <span>0 / 160 Characters</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 p-4 bg-saffron/5 border border-saffron/10 rounded-xl">
                                <div className="w-10 h-10 rounded-full bg-saffron/10 flex items-center justify-center text-saffron">
                                    <Globe size={20} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-indblue">{t("auto_translation")}</p>
                                    <p className="text-[10px] text-silver font-medium">{t("trans_desc")}</p>
                                </div>
                                <button className="text-[10px] font-bold text-saffron uppercase hover:underline">{t("edit_trans")}</button>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    onClick={() => performAction('SAVE_ALERT_DRAFT')}
                                    className="px-6 py-3 rounded-xl border border-silver/10 text-sm font-bold text-silver hover:bg-boxbg transition-all uppercase tracking-widest">
                                    {t("save_draft")}
                                </button>
                                <button
                                    onClick={() => performAction('PREVIEW_SEND_ALERT')}
                                    className="px-8 py-3 rounded-xl bg-indblue text-white text-sm font-bold hover:bg-charcoal transition-all uppercase tracking-widest shadow-lg shadow-indblue/20">
                                    {t("preview_send")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Status */}
                <div className="space-y-6">
                    {/* Target Audience Preview */}
                    <div className="bg-white rounded-2xl border border-silver/10 p-6">
                        <h4 className="font-bold text-indblue mb-6">{t("audience_coverage")}</h4>
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-indblue/5 flex items-center justify-center text-indblue">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-indblue">0 Citizens</p>
                                    <p className="text-[10px] text-silver font-medium uppercase tracking-widest">{t("target_reach")}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-saffron/5 flex items-center justify-center text-saffron">
                                    <MapPin size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-indblue">0 Districts</p>
                                    <p className="text-[10px] text-silver font-medium uppercase tracking-widest">{t("geo_spread")}</p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-silver/5">
                                <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                                    <span className="text-silver">{t("priority_delivery")}</span>
                                    <span className="text-indgreen">0%</span>
                                </div>
                                <div className="w-full h-1.5 bg-boxbg rounded-full overflow-hidden">
                                    <div className="h-full bg-indgreen" style={{ width: "0%" }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Broadcasts */}
                    <div className="bg-white rounded-2xl border border-silver/10 p-6">
                        <h4 className="font-bold text-indblue mb-6">{t("recent_records")}</h4>
                        <div className="space-y-4">
                            {scenarios.slice(0, 3).map((b, i) => (
                                <div key={i} className="flex gap-3 group cursor-pointer pb-4 border-b border-boxbg last:border-0 last:pb-0">
                                    <div className="w-8 h-8 rounded-lg bg-boxbg flex items-center justify-center text-silver">
                                        <CheckCircle2 size={16} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-indblue group-hover:text-saffron transition-colors">{b.title}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Clock size={10} className="text-silver" />
                                            <span className="text-[10px] text-silver font-medium">Available</span>
                                        </div>
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
                                {t("tokens_note")}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
