export interface StoredAuthSession {
  token: string;
  username?: string;
  role?: string;
}

const AUTH_STORAGE_KEY = "drishyam_auth";

export function getStoredAuth(): StoredAuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredAuthSession;
  } catch {
    return null;
  }
}

export function saveStoredAuth(session: StoredAuthSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredAuth() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getAuthHeaders(extraHeaders: HeadersInit = {}): HeadersInit {
  const token = getStoredAuth()?.token;
  return token
    ? {
        Authorization: `Bearer ${token}`,
        ...extraHeaders,
      }
    : extraHeaders;
}
