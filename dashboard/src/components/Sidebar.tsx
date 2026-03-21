"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    ShieldAlert,
    LayoutDashboard,
    PhoneIncoming,
    Share2,
    Bell,
    Settings,
    Scan,
    Briefcase,
    Zap,
    RotateCcw,
    ShieldCheck,
    Activity,
    Smartphone,
    ScanEye,
    Landmark,
    Building2,
    Rocket,
    Languages,
    LogOut,
    User,
    Menu,
    Globe,
    Scale,
    AlertTriangle,
    X,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth, ROLE_ACCESS, ROLE_LABELS } from "@/context/AuthContext";

interface SidebarProps {
    isOpen?: boolean;
    onToggle?: () => void;
}

export default function Sidebar({ isOpen = false, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const { language, setLanguage, t } = useLanguage();
    const { user, logout } = useAuth();

    const role = user?.role || "common";
    const allowedPages = ROLE_ACCESS[role] || ROLE_ACCESS["common"];

    const allMenuItems = [
        { name: t("overview"), icon: LayoutDashboard, href: "/" },
        { name: t("detection"), icon: PhoneIncoming, href: "/detection" },
        { name: t("honeypot"), icon: ShieldAlert, href: "/honeypot" },
        { name: t("graph"), icon: Share2, href: "/graph" },
        { name: t("alerts"), icon: Bell, href: "/alerts" },
        { name: t("deepfake"), icon: Scan, href: "/deepfake" },
        { name: t("history"), icon: RotateCcw, href: "/history" },
        { name: t("mule"), icon: Briefcase, href: "/mule" },
        { name: t("inoculation"), icon: Zap, href: "/inoculation" },
        { name: t("upi_shield"), icon: ShieldCheck, href: "/upi" },
        { name: t("drishyam_score"), icon: Activity, href: "/score" },
        { name: t("reverse_profiling"), icon: ScanEye, href: "/profiling" },
        { name: t("command_center"), icon: Landmark, href: "/command" },
        { name: t("agency_portal"), icon: Building2, href: "/agency" },
        { name: t("launch_control"), icon: Rocket, href: "/launch" },
        { name: t("national_scale"), icon: Globe, href: "/national" },
        { name: t("business_ops"), icon: Briefcase, href: "/business" },
        { name: t("support_ops"), icon: AlertTriangle, href: "/ops" },
        { name: t("governance"), icon: Scale, href: "/governance" },
        { name: t("bharat_layer"), icon: Smartphone, href: "/bharat" },
        { name: t("recovery"), icon: RotateCcw, href: "/recovery" },
    ];

    // Filter menu items based on role
    const menuItems = allMenuItems.filter((item) => allowedPages.includes(item.href));

    const handleNavClick = () => {
        // Close sidebar on mobile after navigation
        if (onToggle && window.innerWidth < 1024) {
            onToggle();
        }
    };

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                    onClick={onToggle}
                />
            )}

            {/* Sidebar */}
            <div className={`
                w-64 bg-indblue text-white h-screen fixed left-0 top-0 flex flex-col border-r border-saffron/20 overflow-y-auto z-50
                transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0
            `}>
                <div className="p-6 flex items-center justify-between">
                    <h1 className="text-xl font-bold tracking-tighter flex items-center gap-2">
                        <span className="text-saffron">DRISHYAM</span><sub className="text-indblue text-xs font-bold ml-0.5">AI</sub>
                    </h1>
                    {/* Mobile close button */}
                    <button
                        onClick={onToggle}
                        className="lg:hidden p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <p className="text-[10px] text-silver px-6 -mt-4 mb-2 uppercase tracking-widest font-semibold">
                    BASIG Operational Grid
                </p>

                <div className="px-6 mb-4">
                    <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                        <button
                            onClick={() => setLanguage("en")}
                            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-bold transition-all ${language === "en" ? "bg-saffron text-white shadow-sm" : "text-silver hover:text-white"
                                }`}
                        >
                            <Languages size={12} /> ENGLISH
                        </button>
                        <button
                            onClick={() => setLanguage("hi")}
                            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-bold transition-all ${language === "hi" ? "bg-saffron text-white shadow-sm" : "text-silver hover:text-white font-sans"
                                }`}
                        >
                            हिंदी
                        </button>
                    </div>
                </div>

                <nav className="flex-1 mt-2 px-4 pb-8 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={handleNavClick}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                                    ? "bg-saffron text-white shadow-lg shadow-saffron/20"
                                    : "hover:bg-white/10 text-silver hover:text-white"
                                    }`}
                            >
                                <item.icon size={18} className={isActive ? "text-white" : "group-hover:text-saffron"} />
                                <span className={`font-medium text-xs tracking-tight ${language === 'hi' ? 'font-sans' : ''}`}>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-white/10 sticky bottom-0 bg-indblue">
                    <div className="space-y-1">
                        {/* Settings - only for admin */}
                        {role === "admin" && (
                            <Link href="/settings" onClick={handleNavClick} className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-silver hover:bg-white/10 hover:text-white">
                                <Settings size={18} />
                                <span className="text-xs">{t("settings")}</span>
                            </Link>
                        )}

                        {/* User Info */}
                        <div className="mt-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-7 h-7 rounded-full bg-saffron/20 border border-saffron/30 flex items-center justify-center flex-shrink-0">
                                    <User size={14} className="text-saffron" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold text-white truncate">
                                        {user?.full_name || user?.username}
                                    </p>
                                    <p className="text-[9px] font-bold uppercase tracking-wide text-saffron">
                                        {ROLE_LABELS[role] || role}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="mt-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-indgreen" />
                                <span className="text-[9px] font-bold uppercase tracking-wide text-indgreen">
                                    PRODUCTION ACTIVE
                                </span>
                            </div>
                            <p className="text-[10px] text-silver leading-tight font-medium">
                                {t("system_online")} · {t("protecting")}
                            </p>
                        </div>

                        {/* Logout */}
                        <button
                            onClick={logout}
                            className="w-full mt-2 flex items-center gap-3 px-4 py-2.5 rounded-lg text-redalert/70 hover:bg-redalert/10 hover:text-redalert transition-all"
                        >
                            <LogOut size={18} />
                            <span className="text-xs font-semibold">Logout</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
