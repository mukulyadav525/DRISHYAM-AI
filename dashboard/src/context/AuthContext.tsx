"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { API_BASE } from "@/config/api";

export interface AccessPageDecision {
    path: string;
    resource: string;
    label: string;
    allowed: boolean;
}

export interface AccessManifest {
    role: string;
    role_label: string;
    allowed_pages: string[];
    allowed_resources: string[];
    pages: AccessPageDecision[];
    generated_at?: string | null;
}

interface AuthUser {
    username: string;
    role: string;
    full_name: string | null;
    token: string;
    mfaRequired: boolean;
    mfaVerified: boolean;
    access: AccessManifest;
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
const STORAGE_KEY = "drishyam_auth";
const PRIVILEGED_ROLES = new Set(["admin", "police", "bank", "government", "telecom", "court"]);

function defaultAccess(role: string): AccessManifest {
    return {
        role,
        role_label: role === "common" ? "Citizen" : role.charAt(0).toUpperCase() + role.slice(1),
        allowed_pages: [],
        allowed_resources: [],
        pages: [],
        generated_at: null,
    };
}

function normalizeAccess(raw: any, role: string): AccessManifest {
    const manifest = raw && typeof raw === "object" ? raw : {};
    return {
        role: manifest.role || role,
        role_label: manifest.role_label || defaultAccess(role).role_label,
        allowed_pages: Array.isArray(manifest.allowed_pages) ? manifest.allowed_pages : [],
        allowed_resources: Array.isArray(manifest.allowed_resources) ? manifest.allowed_resources : [],
        pages: Array.isArray(manifest.pages) ? manifest.pages : [],
        generated_at: manifest.generated_at || null,
    };
}

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
        access: normalizeAccess(parsed?.access, role),
    };
}

function buildAuthHeaders(init?: HeadersInit): Headers {
    const headers = new Headers(init || {});
    if (headers.has("Authorization")) {
        return headers;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return headers;
        }
        const parsed = normalizeStoredUser(JSON.parse(stored));
        if (parsed.token) {
            headers.set("Authorization", `Bearer ${parsed.token}`);
        }
    } catch {
        localStorage.removeItem(STORAGE_KEY);
    }

    return headers;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const persistUser = useCallback((authUser: AuthUser | null) => {
        setUser(authUser);
        if (authUser) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, []);

    useEffect(() => {
        const originalFetch = window.fetch.bind(window);

        window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const requestUrl =
                typeof input === "string"
                    ? input
                    : input instanceof URL
                      ? input.toString()
                      : input.url;

            if (!requestUrl.startsWith(API_BASE)) {
                return originalFetch(input, init);
            }

            const headers = buildAuthHeaders(init?.headers || (input instanceof Request ? input.headers : undefined));
            return originalFetch(input, { ...init, headers });
        }) as typeof window.fetch;

        return () => {
            window.fetch = originalFetch;
        };
    }, []);

    useEffect(() => {
        let active = true;

        const restoreSession = async () => {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) {
                setIsLoading(false);
                return;
            }

            try {
                const parsed = normalizeStoredUser(JSON.parse(stored));
                if (!parsed.token) {
                    persistUser(null);
                    return;
                }

                setUser(parsed);

                const res = await fetch(`${API_BASE}/auth/session`, {
                    headers: {
                        Authorization: `Bearer ${parsed.token}`,
                    },
                });

                if (!res.ok) {
                    throw new Error(`Session refresh failed (${res.status})`);
                }

                const session = await res.json();
                const refreshedUser: AuthUser = {
                    username: session.username,
                    role: session.role,
                    full_name: session.full_name ?? null,
                    token: parsed.token,
                    mfaRequired: Boolean(session.mfa_required),
                    mfaVerified: Boolean(session.mfa_verified),
                    access: normalizeAccess(session.access, session.role),
                };

                if (active) {
                    persistUser(refreshedUser);
                }
            } catch {
                if (active) {
                    persistUser(null);
                }
            } finally {
                if (active) {
                    setIsLoading(false);
                }
            }
        };

        void restoreSession();

        return () => {
            active = false;
        };
    }, [persistUser]);

    const login = useCallback(async (username: string, password: string) => {
        const formData = new URLSearchParams();
        formData.append("username", username);
        formData.append("password", password);

        const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData.toString(),
        });

        const contentType = res.headers.get("content-type");
        const isJson = contentType?.includes("application/json");

        if (!res.ok) {
            if (isJson) {
                const err = await res.json();
                throw new Error(err.detail || "Login failed");
            }
            throw new Error(`Server error (${res.status})`);
        }

        if (!isJson) {
            throw new Error("Invalid server response: expected JSON");
        }

        const data = await res.json();
        const authUser: AuthUser = {
            username: data.username,
            role: data.role,
            full_name: data.full_name ?? null,
            token: data.access_token,
            mfaRequired: Boolean(data.mfa_required),
            mfaVerified: Boolean(data.mfa_verified),
            access: normalizeAccess(data.access, data.role),
        };

        persistUser(authUser);
        return authUser;
    }, [persistUser]);

    const verifyMfa = useCallback(async (otp: string) => {
        if (!user?.token) {
            throw new Error("Session expired. Please log in again.");
        }

        const res = await fetch(`${API_BASE}/auth/mfa/verify`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user.token}`,
            },
            body: JSON.stringify({ otp }),
        });

        const contentType = res.headers.get("content-type");
        const isJson = contentType?.includes("application/json");

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
            full_name: data.full_name ?? null,
            token: data.access_token,
            mfaRequired: Boolean(data.mfa_required),
            mfaVerified: Boolean(data.mfa_verified),
            access: normalizeAccess(data.access, data.role),
        };

        persistUser(authUser);
    }, [persistUser, user]);

    const logout = useCallback(() => {
        persistUser(null);
    }, [persistUser]);

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
