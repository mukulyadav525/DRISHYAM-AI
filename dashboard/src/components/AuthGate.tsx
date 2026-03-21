"use client";

import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

export default function AuthGate({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, isMfaPending, isLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAuthenticated && pathname !== "/login") {
            router.replace("/login");
        }
        if (!isLoading && isAuthenticated && isMfaPending && pathname !== "/login") {
            router.replace("/login");
        }
    }, [isLoading, isAuthenticated, isMfaPending, pathname, router]);

    // Show loading spinner while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-boxbg">
                <Loader2 className="animate-spin text-indblue" size={48} />
            </div>
        );
    }

    // If on login page, always show content
    if (pathname === "/login") {
        return <>{children}</>;
    }

    // If not authenticated, show nothing (redirect will happen)
    if (!isAuthenticated) {
        return null;
    }

    if (isMfaPending) {
        return null;
    }

    // Role-based page access check
    const role = user?.role || "common";
    const allowedPages = user?.access?.allowed_pages || [];
    
    // Normalize path for comparison
    const normalizedPath = pathname;
    const isAllowed = allowedPages.includes(normalizedPath);

    if (!isAllowed) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-boxbg">
                <div className="bg-white rounded-2xl border border-redalert/20 shadow-2xl p-10 max-w-md text-center">
                    <div className="w-20 h-20 bg-redalert/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert className="text-redalert" size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-indblue mb-2">Access Denied</h2>
                    <p className="text-silver mb-6">
                        Your role <span className="font-bold text-redalert uppercase">({user?.access?.role_label || role})</span> does not have permission to access this page.
                    </p>
                    <button
                        onClick={() => router.push("/")}
                        className="px-6 py-3 bg-indblue text-white rounded-xl font-semibold hover:bg-indblue/90 transition-colors"
                    >
                        Return to Overview
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
