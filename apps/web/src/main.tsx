import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { initSync } from "./sync/engine";
import { setUnauthorizedHandler } from "./lib/api";
import { captureInstallPrompt } from "./lib/install";
import { forgetSession } from "./lib/session";
import { SESSION_QUERY_KEY } from "./components/AuthGate";
import "./index.css";

captureInstallPrompt(); // beforeinstallprompt fires early; keep it for the "Install app" button

const queryClient = new QueryClient({
  defaultOptions: {
    // Screens read from the local IndexedDB store, so queries must run offline too.
    queries: { networkMode: "always", staleTime: Infinity, refetchOnWindowFocus: false },
    mutations: { networkMode: "always" },
  },
});

// Any 401 (REST or sync): forget the session and go to /login. The outbox stays intact.
setUnauthorizedHandler(() => {
  forgetSession();
  queryClient.setQueryData(SESSION_QUERY_KEY, { state: "signed-out" });
  const { pathname, search } = window.location;
  if (pathname.startsWith("/login")) return;
  void router.navigate(`/login?next=${encodeURIComponent(pathname + search)}`, { replace: true });
});

initSync(queryClient);

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
