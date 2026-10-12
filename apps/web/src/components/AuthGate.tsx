import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { checkSession, readCachedMe, type SessionCheck } from "../lib/session";

export const SESSION_QUERY_KEY = ["session"] as const;

/** GET /api/session/me, cached. Never throws: offline + previously logged in → { state: "offline" }. */
export function useSession() {
  return useQuery<SessionCheck>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: checkSession,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: true,
    networkMode: "always", // run even when the browser says offline, so we fall back to the cache
  });
}

/**
 * Auth gate for everything inside the Shell. With a cached session the app renders immediately
 * (offline-first) while /me confirms in the background; a 401 sends the user to /login.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const session = useSession();
  const cached = readCachedMe();

  if (session.data?.state === "signed-out") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (!session.data && !cached) {
    return (
      <main className="flex min-h-screen items-center justify-center" aria-busy="true">
        <p className="text-ink-2">Opening…</p>
      </main>
    );
  }
  return <>{children}</>;
}
