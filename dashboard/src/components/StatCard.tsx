"use client";

import { LucideIcon, Zap, Search, ShieldX } from "lucide-react";
import { useActions } from "@/hooks/useActions";

interface StatCardProps {
    label: string;
    value: string;
    subValue?: string;
    icon: LucideIcon;
    color: string;
    trend?: {
        value: string;
        positive: boolean;
    };
    quickActions?: boolean;
    onAction?: (type: string) => void;
    onClickCard?: () => void;
}

export default function StatCard({ label, value, subValue, icon: Icon, color, trend, quickActions, onAction, onClickCard }: StatCardProps) {
    const { performAction } = useActions();

    return (
        <div
            onClick={onClickCard}
            className="bg-white p-6 rounded-2xl border border-silver/10 shadow-sm hover:shadow-md hover:border-indblue/20 transition-all duration-200 group cursor-pointer active:scale-[0.98]"
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl bg-${color}/10 text-${color}`}>
                    <Icon size={24} />
                </div>
                {trend && (
                    <div className={`text-xs font-bold px-2 py-1 rounded-full ${trend.positive ? "bg-indgreen/10 text-indgreen" : "bg-redalert/10 text-redalert"
                        }`}>
                        {trend.positive ? "↑" : "↓"} {trend.value}
                    </div>
                )}
            </div>
            <div>
                <p className="text-silver text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
                <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-2xl font-bold text-indblue tracking-tight">{value}</h3>
                    {quickActions && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => { e.stopPropagation(); if (onAction) onAction('INTERCEPT'); else performAction('INTERCEPT', label); }}
                                title="Intercept"
                                className="p-1.5 bg-saffron/10 text-saffron rounded-lg hover:bg-saffron hover:text-white transition-colors"
                            >
                                <Zap size={14} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); if (onAction) onAction('TRACE'); else performAction('TRACE', label); }}
                                title="Trace"
                                className="p-1.5 bg-indblue/10 text-indblue rounded-lg hover:bg-indblue hover:text-white transition-colors"
                            >
                                <Search size={14} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); if (onAction) onAction('BLOCK'); else performAction('BLOCK', label); }}
                                title="Block"
                                className="p-1.5 bg-redalert/10 text-redalert rounded-lg hover:bg-redalert hover:text-white transition-colors"
                            >
                                <ShieldX size={14} />
                            </button>
                        </div>
                    )}
                </div>
                {subValue && <p className="text-[10px] text-silver mt-1 font-medium">{subValue}</p>}
            </div>
        </div>
    );
}
