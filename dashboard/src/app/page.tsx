"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Users,
  PhoneOff,
  IndianRupee,
  AlertTriangle,
  ArrowUpRight,
  Loader2
} from "lucide-react";
import StatCard from "@/components/StatCard";
import { useLanguage } from "@/context/LanguageContext";
import { useActions } from "@/hooks/useActions";
import { API_BASE } from "@/config/api";


interface OverviewData {
  stats: {
    scams_blocked: string;
    citizens_protected: string;
    estimated_savings: string;
    active_threats: number;
  };
  live_feed: {
    id: number;
    location: string;
    message: string;
    time: string;
  }[];
}

export default function OverviewPage() {
  const { t } = useLanguage();
  const { performAction, downloadSimulatedFile } = useActions();
  const [data, setData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/system/overview`);
        if (res.ok) {
          const overviewData = await res.json();
          setData(overviewData);
        }
      } catch (error) {
        console.error("Error fetching overview data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !data) {
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
          <h2 className="text-3xl font-bold text-indblue tracking-tight">{t("welcome")}</h2>
          <p className="text-silver mt-1">{t("sub_welcome")}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => downloadSimulatedFile('overview', 'pdf')}
            className="px-4 py-2 bg-white border border-silver/20 rounded-lg text-sm font-semibold text-charcoal hover:bg-boxbg transition-colors">
            {t("export_report")}
          </button>
          <button
            onClick={() => performAction('VIEW_MAP')}
            className="px-4 py-2 bg-saffron text-white rounded-lg text-sm font-semibold hover:bg-deeporange transition-colors flex items-center gap-2">
            {t("view_live_map")} <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label={t("total_scams_blocked")}
          value={data?.stats.scams_blocked || "0"}
          subValue={t("across_states")}
          icon={ShieldCheck}
          color="indblue"
          trend={data?.stats.scams_blocked !== "0" ? { value: "12%", positive: true } : undefined}
          quickActions={true}
        />
        <StatCard
          label={t("citizens_protected")}
          value={data?.stats.citizens_protected || "0"}
          subValue={t("active_grid_participants")}
          icon={Users}
          color="indgreen"
          trend={data?.stats.citizens_protected !== "0" ? { value: "8%", positive: true } : undefined}
          quickActions={true}
        />
        <StatCard
          label={t("estimated_savings")}
          value={data?.stats.estimated_savings || "0"}
          subValue={t("financial_loss_prevented")}
          icon={IndianRupee}
          color="gold"
          trend={data?.stats.estimated_savings !== "0" ? { value: "15%", positive: true } : undefined}
          quickActions={true}
        />
        <StatCard
          label={t("active_threats")}
          value={data?.stats.active_threats.toString() || "0"}
          subValue={t("high_intensity_surges")}
          icon={AlertTriangle}
          color="redalert"
          trend={data?.stats.active_threats ? { value: "4%", positive: false } : undefined}
          quickActions={true}
        />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Heatmap Placeholder */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-silver/10 p-6 flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-bold text-indblue">{t("scam_weather_forecast")}</h4>
            <select className="text-xs border-none bg-boxbg p-2 rounded-lg font-semibold text-silver outline-none" defaultValue="today">
              <option value="today">{t("today")}</option>
              <option value="week">{t("past_week")}</option>
            </select>
          </div>
          <div
            onClick={() => performAction('INIT_GEO_LAYER')}
            className="flex-1 bg-boxbg rounded-xl border border-dashed border-silver/30 flex items-center justify-center relative overflow-hidden group cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-saffron/5 to-indblue/5" />
            <div className="text-center z-10">
              <div className="w-16 h-16 bg-white rounded-full shadow-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <ArrowUpRight className="text-saffron" size={32} />
              </div>
              <p className="text-sm font-bold text-indblue">{t("init_geo_layer")}</p>
              <p className="text-xs text-silver mt-1">{t("node_access_required")}</p>
            </div>
          </div>
        </div>

        {/* Live Feed */}
        <div className="bg-white rounded-2xl border border-silver/10 p-6">
          <h4 className="font-bold text-indblue mb-6 flex items-center gap-2">
            {t("live_intel_feed")}
            <div className="w-2 h-2 rounded-full bg-redalert animate-pulse" />
          </h4>
          <div className="space-y-6">
            {data?.live_feed.map((item) => (
              <div
                key={item.id}
                onClick={() => performAction('VIEW_FEED_DETAIL', item.id.toString(), { location: item.location })}
                className="flex gap-4 items-start pb-6 border-b border-boxbg last:border-0 last:pb-0 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-boxbg flex items-center justify-center flex-shrink-0 group-hover:bg-indblue/10 transition-colors">
                  <PhoneOff size={18} className="text-indblue" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-indblue uppercase group-hover:text-saffron transition-colors">{item.location}</p>
                    <ArrowUpRight size={12} className="text-silver" />
                  </div>
                  <p className="text-xs text-silver mt-0.5 leading-relaxed">
                    {item.message}
                  </p>
                  <p className="text-[10px] text-silver/60 mt-2 font-mono">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => performAction('CONNECT_TICKER')}
            className="w-full py-3 mt-6 border-2 border-dashed border-silver/20 rounded-xl text-[10px] font-bold text-silver uppercase tracking-widest hover:border-saffron/40 hover:text-saffron transition-all">
            {t("connect_live_ticker")}
          </button>
        </div>
      </div>
    </div>
  );
}
