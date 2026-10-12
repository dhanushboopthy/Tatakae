import type { ReactNode } from "react";
import { openCommandPalette } from "./CommandPalette";
import { openCapture } from "./CaptureDialog";
import { PlusIcon, SearchIcon } from "./icons";

/**
 * Page header (ref 05): small eyebrow line, a large title, and circle actions on the right — search
 * (command palette) and a charcoal "+" for capture, plus any page-specific actions before them.
 */
export function PageHeader(props: { eyebrow?: ReactNode; title: ReactNode; actions?: ReactNode; quiet?: boolean }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1">
        {props.eyebrow && <p className="eyebrow">{props.eyebrow}</p>}
        <h1 className={props.quiet ? "text-title-sm" : "text-title-sm md:text-title"}>{props.title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {props.actions}
        <button type="button" className="icon-btn hidden md:inline-flex" aria-label="Search or capture" onClick={openCommandPalette}>
          <SearchIcon />
        </button>
        <button type="button" className="icon-btn-primary" aria-label="Capture to inbox" aria-keyshortcuts="c" onClick={openCapture}>
          <PlusIcon />
        </button>
      </div>
    </header>
  );
}
