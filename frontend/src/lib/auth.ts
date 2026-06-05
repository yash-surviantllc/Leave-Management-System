import type { AuthSession, AuthUser } from "@/types";

const SESSION_KEY = "lms_auth_session";

let authSessionCache: AuthSession | null | undefined;

export function setAuthSession(session: AuthSession): void {
  authSessionCache = session;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getCachedAuthSession(): AuthSession | null {
  return authSessionCache ?? null;
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return getCachedAuthSession();
  }

  const rawSession = window.localStorage.getItem(SESSION_KEY);

  if (!rawSession) {
    authSessionCache = null;
    return null;
  }

  try {
    authSessionCache = JSON.parse(rawSession) as AuthSession;
    return authSessionCache;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function updateAuthUser(user: AuthUser): AuthSession | null {
  const session = getAuthSession();

  if (!session) {
    return null;
  }

  const nextSession = {
    ...session,
    user
  };

  setAuthSession(nextSession);
  return nextSession;
}

export function clearAuthSession(): void {
  authSessionCache = null;

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
  }
}
