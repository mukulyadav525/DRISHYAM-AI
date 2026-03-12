"use client";

import { Toaster } from "react-hot-toast";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AuthGate from "@/components/AuthGate";
import Sidebar from "@/components/Sidebar";
import { usePathname } from "next/navigation";

function InnerShell({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();
    const pathname = usePathname();
    const isLoginPage = pathname === "/login" || pathname === "/dashboard/login";

    // On the login page, render children without sidebar
    if (isLoginPage || !isAuthenticated) {
        return <AuthGate>{children}</AuthGate>;
    }

    // Authenticated pages: show sidebar + content
    return (
        <AuthGate>
            <div className="flex min-h-screen bg-boxbg">
                <Sidebar />
                <main className="flex-1 ml-64 p-8">
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
