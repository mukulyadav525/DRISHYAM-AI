let API_BASE_RAW = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1").trim();

// Ensure protocol exists, otherwise browser treats it as a relative path
if (!API_BASE_RAW.startsWith("http://") && !API_BASE_RAW.startsWith("https://")) {
    API_BASE_RAW = `https://${API_BASE_RAW}`;
}

// Ensure no trailing slash
export const API_BASE = API_BASE_RAW.endsWith("/") ? API_BASE_RAW.slice(0, -1) : API_BASE_RAW;

if (typeof window !== 'undefined') {
    console.log("[SENTINEL] API Gateway initialized at:", API_BASE);
}
