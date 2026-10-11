import { Outlet } from "react-router-dom";

/** Laptop layout: left sidebar (Today, Ritual, Inbox, Review, Cycle, Notes, Settings) + CommandPalette. Narrow screens must not break but are not a target. */
export function Shell() {
  // TODO(v1)
  return <Outlet />;
}
