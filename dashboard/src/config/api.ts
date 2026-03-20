// Production Railway URL as default fallback
const PRODUCTION_API_URL = "https://drishyam-1930-production.up.railway.app/api/v1";

let API_BASE_RAW = (process.env.NEXT_PUBLIC_API_BASE || PRODUCTION_API_URL).trim();

// Ensure protocol exists, otherwise browser treats it as a relative path
if (!API_BASE_RAW.startsWith("http://") && !API_BASE_RAW.startsWith("https://")) {
    API_BASE_RAW = `https://${API_BASE_RAW}`;
}

// Ensure no trailing slash
export const API_BASE = API_BASE_RAW.endsWith("/") ? API_BASE_RAW.slice(0, -1) : API_BASE_RAW;

if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    
    if (API_BASE.includes("localhost") && !isLocalhost) {
        console.error("[DRISHYAM] CRITICAL: Frontend is at", window.location.hostname, "but API_BASE is localhost. This will FAIL.");
        console.warn("[DRISHYAM] Attempting to use production fallback...");
    }
    console.log("[DRISHYAM] API Gateway initialized at:", API_BASE);
}
