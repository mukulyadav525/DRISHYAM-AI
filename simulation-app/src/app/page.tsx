"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, X } from "lucide-react";
import Image from "next/image";
import { API_BASE } from "@/config/api";
import { Toaster, toast } from "react-hot-toast";
import { useActions } from "@/hooks/useActions";
import { getAuthHeaders, getStoredAuth } from "@/lib/auth";
import FeedModal from "@/components/FeedModal";

// Modular Components
import AuthScreen from "@/components/simulation/AuthScreen";
import CitizenHome from "@/components/simulation/CitizenHome";
import ChatModule from "@/components/simulation/ChatModule";
import DeepfakeModule from "@/components/simulation/DeepfakeModule";
import UpiModule from "@/components/simulation/UpiModule";
import BharatModule from "@/components/simulation/BharatModule";
import RecoveryModule from "@/components/simulation/RecoveryModule";
import DrillModule from "@/components/simulation/DrillModule";

interface Persona {
  id: string;
  label: string;
  lang: string;
}

type ActiveFeature = "home" | "chat" | "deepfake" | "upi" | "bharat" | "recovery" | "drills" | null;
const API_CACHE_TTL_MS = 5000;
const apiResponseCache = new Map<string, { expiresAt: number; response: Response }>();
const apiInFlightRequests = new Map<string, Promise<Response>>();

function clearApiCache() {
  apiResponseCache.clear();
  apiInFlightRequests.clear();
}

function resolveRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) {
    return init.method.toUpperCase();
  }
  if (input instanceof Request) {
    return input.method.toUpperCase();
  }
  return "GET";
}

function buildApiCacheKey(requestUrl: string, method: string, headers: Headers) {
  return `${method}:${requestUrl}:${headers.get("Authorization") || ""}`;
}

export default function SimulationPortal() {
  const [authStatus, setAuthStatus] = useState<"login" | "pending" | "approved">("login");
  const [customerId, setCustomerId] = useState<string>("");
  const [activeFeature, setActiveFeature] = useState<ActiveFeature>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { performAction, downloadSimulatedFile } = useActions();

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

      const method = resolveRequestMethod(input, init);
      const headers = new Headers(getAuthHeaders(init?.headers || (input instanceof Request ? input.headers : undefined)));

      if (method !== "GET") {
        clearApiCache();
        return originalFetch(input, { ...init, headers });
      }

      if (requestUrl.includes("/actions/download")) {
        return originalFetch(input, { ...init, headers });
      }

      const cacheKey = buildApiCacheKey(requestUrl, method, headers);
      const cached = apiResponseCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.response.clone();
      }

      const inFlight = apiInFlightRequests.get(cacheKey);
      if (inFlight) {
        return (await inFlight).clone();
      }

      const requestPromise = originalFetch(input, { ...init, headers }).then((response) => {
        const contentType = response.headers.get("content-type") || "";
        if (response.ok && contentType.includes("application/json")) {
          apiResponseCache.set(cacheKey, {
            expiresAt: Date.now() + API_CACHE_TTL_MS,
            response: response.clone(),
          });
        } else {
          apiResponseCache.delete(cacheKey);
        }
        return response;
      });

      apiInFlightRequests.set(
        cacheKey,
        requestPromise.then((response) => response.clone()).finally(() => {
          apiInFlightRequests.delete(cacheKey);
        }),
      );

      return requestPromise;
    }) as typeof window.fetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    const existingAuth = getStoredAuth();
    if (!existingAuth?.token || existingAuth.role !== "common") {
      return;
    }

    setCustomerId(existingAuth.username || "");
    setAuthStatus("approved");
    setActiveFeature("home");
  }, []);

  // Fetch Personas for Chat
  useEffect(() => {
    if (authStatus !== "approved" || activeFeature !== "chat" || personas.length > 0) return;

    const controller = new AbortController();
    const fetchPersonas = async () => {
      try {
        const res = await fetch(`${API_BASE}/voice/personas`, {
            signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          const formatted = data.personas.map((p: any) => ({
            id: p.name,
            label: `${p.speaker === 'Male' ? '👨' : '👩'} ${p.name}`,
            lang: p.language === 'hi-IN' ? 'Hindi' : p.language === 'en-IN' ? 'English' : p.language
          }));
          setPersonas(formatted);
          if (formatted.length > 0) setSelectedPersona(formatted[0]);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error("Error fetching personas:", error);
      }
    };
    fetchPersonas();
    return () => controller.abort();
  }, [activeFeature, authStatus, personas.length]);

  // Poll for Admin Approval
  useEffect(() => {
    let interval: any;
    if (authStatus === 'pending' && customerId) {
      const checkStatus = async () => {
        try {
          const res = await fetch(`${API_BASE}/auth/simulation/status/${customerId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'approved') {
              setAuthStatus('approved');
              setActiveFeature('home');
              if (data.access_token) {
                localStorage.setItem('drishyam_auth', JSON.stringify({
                  token: data.access_token,
                  username: data.phone_number,
                  role: 'common'
                }));
              }
              toast.success("Security Clearance Granted");
            } else if (data.status === 'rejected') {
              setAuthStatus('login');
              toast.error("Access Request Denied by HQ");
            }
          }
        } catch (e) {
          console.error("Approval poll failed:", e);
        }
      };
      checkStatus();
      interval = setInterval(checkStatus, 5000);
    }
    return () => clearInterval(interval);
  }, [authStatus, customerId]);

  useEffect(() => {
    if (authStatus !== "approved") {
      setActiveFeature(null);
      return;
    }
    setActiveFeature((current) => current ?? "home");
  }, [authStatus]);

  const endSession = () => {
    localStorage.removeItem("drishyam_auth");
    clearApiCache();
    setAuthStatus("login");
    setCustomerId("");
    setActiveFeature(null);
    toast.success("Citizen session closed.");
  };

  const featureNodeLabel = activeFeature === "chat"
    ? "Voice_INT"
    : activeFeature === "deepfake"
      ? "Visual_DF"
      : activeFeature === "upi"
        ? "Fin_Sec"
        : activeFeature === "bharat"
          ? "Bharat_Lite"
          : activeFeature === "recovery"
            ? "Recovery_Ops"
            : activeFeature === "drills"
              ? "Resilience_Lab"
              : "Citizen_Core";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-boxbg overflow-x-hidden p-4 selection:bg-indblue/10 selection:text-indblue">
      <Toaster position="top-center" />

      {/* Auth Screen (Login & Pending) */}
      {(authStatus === "login" || authStatus === "pending") && (
        <AuthScreen 
            authStatus={authStatus} 
            setAuthStatus={setAuthStatus} 
            customerId={customerId} 
            setCustomerId={setCustomerId} 
        />
      )}

      {/* Citizen Home */}
      {authStatus === "approved" && activeFeature === "home" && (
        <CitizenHome
          customerId={customerId}
          setActiveFeature={setActiveFeature}
          endSession={endSession}
        />
      )}

      {/* Active Feature View */}
      {authStatus === "approved" && activeFeature && activeFeature !== "home" && (
        <div className="flex flex-col items-center w-full max-w-6xl h-full py-2 fade-in overflow-y-auto">
          {/* Module Header */}
          <div className="text-center mb-4 w-full relative shrink-0 px-2">
            <button
              onClick={() => setActiveFeature("home")}
              className="sm:absolute sm:left-0 sm:top-1/2 sm:-translate-y-1/2 mb-2 sm:mb-0 text-[10px] font-black text-indblue uppercase tracking-widest flex items-center gap-1 hover:text-saffron transition-colors"
            >
              <X size={14} /> Back to Safety Center
            </button>
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="relative w-8 h-8 overflow-hidden rounded-lg border border-saffron/30">
                <Image 
                    src="/logo.png" 
                    alt="Logo" 
                    fill
                    className="object-cover"
                />
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indblue/10 text-indblue rounded-full text-[10px] font-bold tracking-widest uppercase">
                <ShieldCheck size={12} /> Active Node: {featureNodeLabel}
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-indblue tracking-tight">
              {activeFeature === "chat" && "DRISHYAM Voice/Video Trace"}
              {activeFeature === "deepfake" && "DRISHYAM Deepfake Defense"}
              {activeFeature === "upi" && "DRISHYAM UPI Armor"}
              {activeFeature === "bharat" && "DRISHYAM Bharat Layer"}
              {activeFeature === "recovery" && "DRISHYAM Recovery Companion"}
              {activeFeature === "drills" && "DRISHYAM Drill Center"}
            </h2>
          </div>

          {/* Module Content */}
          {activeFeature === 'chat' && (
            <ChatModule 
                customerId={customerId} 
                selectedPersona={selectedPersona} 
                setActiveFeature={setActiveFeature} 
            />
          )}

          {activeFeature === 'deepfake' && (
            <DeepfakeModule 
                performAction={performAction} 
                setSelectedIncident={setSelectedIncident} 
                setIsModalOpen={setIsModalOpen} 
            />
          )}

          {activeFeature === 'upi' && (
            <UpiModule performAction={performAction} downloadSimulatedFile={downloadSimulatedFile} />
          )}

          {activeFeature === 'bharat' && (
            <BharatModule customerId={customerId} />
          )}

          {activeFeature === 'recovery' && (
            <RecoveryModule customerId={customerId} />
          )}

          {activeFeature === 'drills' && (
            <DrillModule customerId={customerId} />
          )}

          {/* Global Footer */}
          <footer className="w-full text-center pb-4 mt-8 shrink-0">
            <p className="text-[9px] font-black text-silver/40 uppercase tracking-[0.4em]">Integrated Anti-Fraud Ops | DRISHYAM Command</p>
          </footer>
        </div>
      )}

      {/* Shared Components */}
      <FeedModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        data={selectedIncident}
      />
    </div>
  );
}
