import { Outlet } from "react-router-dom";
import { AuthGate } from "./AuthGate";
import { InstallBanner } from "./InstallBanner";

/** Laptop layout: auth gate + install offer. Sidebar and Cmd/Ctrl+K arrive with the v1 shell. */
export function Shell() {
  return (
    <AuthGate>
      <div className="mx-auto max-w-wide px-4 py-6">
        <InstallBanner />
        <Outlet />
      </div>
    </AuthGate>
  );
}
