import { NavLink } from "react-router-dom";

// Sub-navigation for the v3 "library" screens, which share the Notes rail item:
// Notes · Applications · Stories · Japanese.

export const LIBRARY: readonly { to: string; label: string }[] = [
  { to: "/notes", label: "Notes" },
  { to: "/applications", label: "Applications" },
  { to: "/stories", label: "Stories" },
  { to: "/japanese", label: "Japanese" },
];

export function LibraryTabs() {
  return (
    <nav aria-label="Library" className="flex flex-wrap gap-1.5">
      {LIBRARY.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `chip px-4 text-[13px] ${isActive ? "bg-lime text-on-accent" : "bg-surface font-medium text-ink hover:bg-surface-2"}`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
