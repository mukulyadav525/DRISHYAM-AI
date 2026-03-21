"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API_BASE } from "@/config/api";

interface AuthUser {
    username: string;
    role: string;
    full_name: string | null;
    token: string;
    mfaRequired: boolean;
    mfaVerified: boolean;
}

interface AuthContextType {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isMfaPending: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<AuthUser>;
    verifyMfa: (otp: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Role → Page Access Matrix ─────────────────────────────────────────
export const ROLE_ACCESS: Record<string, string[]> = {
    admin: [
        "/", "/detection", "/honeypot", "/graph", "/alerts", "/deepfake", "/history",
        "/mule", "/inoculation", "/upi", "/score", "/profiling", "/command",
        "/agency", "/launch", "/national", "/business", "/ops", "/governance",
        "/shield", "/bharat", "/recovery", "/settings",
    ],
    police: [
        "/", "/detection", "/honeypot", "/graph", "/alerts", "/deepfake", "/history",
        "/mule", "/inoculation", "/score", "/profiling", "/command",
        "/agency", "/national", "/business", "/ops", "/governance",
        "/shield", "/bharat", "/recovery",
    ],
    bank: [
        "/", "/graph", "/alerts", "/mule", "/inoculation", "/upi",
        "/score", "/agency", "/national", "/business", "/ops", "/governance",
        "/bharat", "/recovery",
    ],
    government: [
        "/", "/detection", "/graph", "/alerts", "/deepfake", "/history", "/inoculation",
        "/upi", "/score", "/command", "/agency", "/launch", "/national",
        "/business", "/ops", "/governance", "/shield", "/bharat",
    ],
    telecom: [
        "/", "/detection", "/alerts", "/inoculation", "/agency", "/national",
        "/business", "/ops", "/governance", "/shield", "/bharat",
    ],
    court: [
        "/", "/graph", "/deepfake", "/history", "/mule", "/score", "/profiling",
        "/agency", "/national", "/business", "/ops", "/governance", "/bharat", "/recovery",
    ],
    common: [
        "/", "/alerts", "/inoculation", "/upi", "/score", "/shield",
        "/bharat", "/recovery",
    ],
};

export const ROLE_LABELS: Record<string, string> = {
    admin: "Administrator",
    police: "Police / LEA",
    bank: "Banking / NBFC",
    government: "Government",
    telecom: "Telecom Operator",
    court: "Judiciary / Court",
    common: "Citizen",
};

const PRIVILEGED_ROLES = new Set(["admin", "police", "bank", "government", "telecom", "court"]);

function normalizeStoredUser(parsed: any): AuthUser {
    const role = parsed?.role || "common";
    const mfaRequired = parsed?.mfaRequired ?? PRIVILEGED_ROLES.has(role);
    const mfaVerified = parsed?.mfaVerified ?? !mfaRequired;

    return {
        username: parsed?.username || "",
        role,
        full_name: parsed?.full_name ?? null,
        token: parsed?.token || "",
        mfaRequired,
        mfaVerified,
    };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Restore session from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem("drishyam_auth");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setUser(normalizeStoredUser(parsed));
            } catch {
                localStorage.removeItem("drishyam_auth");
            }
        }
        setIsLoading(false);
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        const formData = new URLSearchParams();
        formData.append("username", username);
        formData.append("password", password);

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: formData.toString(),
            });

            const contentType = res.headers.get("content-type");
            const isJson = contentType && contentType.includes("application/json");

            if (!res.ok) {
                if (isJson) {
                    const err = await res.json();
                    throw new Error(err.detail || "Login failed");
                } else {
                    const text = await res.text();
                    console.error("Non-JSON error response:", text);
                    throw new Error(`Server error (${res.status}): ${res.statusText}`);
                }
            }

            if (!isJson) {
                throw new Error("Invalid server response: Expected JSON");
            }

            const data = await res.json();
            const authUser: AuthUser = {
                username: data.username,
                role: data.role,
                full_name: data.full_name,
                token: data.access_token,
                mfaRequired: Boolean(data.mfa_required),
                mfaVerified: Boolean(data.mfa_verified),
            };

            setUser(authUser);
            localStorage.setItem("drishyam_auth", JSON.stringify(authUser));
            return authUser;
        } catch (error: any) {
            console.error("Login request failed:", error);
            throw error;
        }
    }, []);

    const verifyMfa = useCallback(async (otp: string) => {
        if (!user?.token) {
            throw new Error("Session expired. Please log in again.");
        }

        const res = await fetch(`${API_BASE}/auth/mfa/verify`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${user.token}`,
            },
            body: JSON.stringify({ otp }),
        });

        const contentType = res.headers.get("content-type");
        const isJson = contentType && contentType.includes("application/json");

        if (!res.ok) {
            if (isJson) {
                const err = await res.json();
                throw new Error(err.detail || "MFA verification failed");
            }
            throw new Error(`MFA verification failed (${res.status})`);
        }

        if (!isJson) {
            throw new Error("Invalid MFA response from server");
        }

        const data = await res.json();
        const authUser: AuthUser = {
            username: data.username,
            role: data.role,
            full_name: data.full_name,
            token: data.access_token,
            mfaRequired: Boolean(data.mfa_required),
            mfaVerified: Boolean(data.mfa_verified),
        };

        setUser(authUser);
        localStorage.setItem("drishyam_auth", JSON.stringify(authUser));
    }, [user]);

    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem("drishyam_auth");
    }, []);

    const isMfaPending = !!user && user.mfaRequired && !user.mfaVerified;

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isMfaPending,
                isLoading,
                login,
                verifyMfa,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
