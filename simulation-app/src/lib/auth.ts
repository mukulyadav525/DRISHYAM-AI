export interface StoredAuthSession {
  token: string;
  username?: string;
  role?: string;
}

export function getStoredAuth(): StoredAuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem("drishyam_auth");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredAuthSession;
  } catch {
    return null;
  }
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
