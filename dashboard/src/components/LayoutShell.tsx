"use client";

import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AuthGate from "@/components/AuthGate";
import Sidebar from "@/components/Sidebar";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

function InnerShell({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();
    const pathname = usePathname();
    const isLoginPage = pathname === "/login";
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // On the login page, render children without sidebar
    if (isLoginPage || !isAuthenticated) {
        return <AuthGate>{children}</AuthGate>;
    }

    // Authenticated pages: show sidebar + content
    return (
        <AuthGate>
            <div className="flex min-h-screen bg-boxbg">
                <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

                {/* Mobile Header */}
                <div className="fixed top-0 left-0 right-0 h-14 bg-indblue text-white flex items-center px-4 gap-3 z-30 lg:hidden">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <Menu size={22} />
                    </button>
                    <h1 className="text-sm font-bold tracking-tighter">
                        <span className="text-saffron">DRISHYAM</span><sub className="text-xs ml-0.5">AI</sub>
                    </h1>
                </div>

                <main className="flex-1 lg:ml-64 p-4 pt-18 lg:p-8 lg:pt-8 min-w-0">
                    {children}
                </main>
            </div>
        </AuthGate>
    );
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <LanguageProvider>
                <Toaster position="top-right" />
                <InnerShell>{children}</InnerShell>
            </LanguageProvider>
        </AuthProvider>
    );
}
