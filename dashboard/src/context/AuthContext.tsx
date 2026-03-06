"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API_BASE } from "@/config/api";

interface AuthUser {
    username: string;
    role: string;
    full_name: string | null;
    token: string;
}

interface AuthContextType {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Role → Page Access Matrix ─────────────────────────────────────────
export const ROLE_ACCESS: Record<string, string[]> = {
    admin: [
        "/", "/detection", "/honeypot", "/graph", "/alerts", "/deepfake",
        "/mule", "/inoculation", "/upi", "/score", "/profiling", "/command",
        "/agency", "/launch", "/shield", "/bharat", "/recovery", "/settings",
    ],
    police: [
        "/", "/detection", "/honeypot", "/graph", "/alerts", "/deepfake",
        "/mule", "/inoculation", "/score", "/profiling", "/command",
        "/agency", "/shield", "/bharat", "/recovery",
    ],
    bank: [
        "/", "/graph", "/alerts", "/mule", "/inoculation", "/upi",
        "/score", "/agency", "/bharat", "/recovery",
    ],
    government: [
        "/", "/detection", "/graph", "/alerts", "/deepfake", "/inoculation",
        "/upi", "/score", "/command", "/agency", "/launch", "/shield", "/bharat",
    ],
    telecom: [
        "/", "/detection", "/alerts", "/inoculation", "/agency", "/shield", "/bharat",
    ],
    court: [
        "/", "/graph", "/deepfake", "/mule", "/score", "/profiling",
        "/agency", "/bharat", "/recovery",
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Restore session from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem("sentinel_auth");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setUser(parsed);
            } catch {
                localStorage.removeItem("sentinel_auth");
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
            };

            setUser(authUser);
            localStorage.setItem("sentinel_auth", JSON.stringify(authUser));
        } catch (error: any) {
            console.error("Login request failed:", error);
            throw error;
        }
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem("sentinel_auth");
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isLoading,
                login,
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
