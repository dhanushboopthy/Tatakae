import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";

/**
 * Native <dialog> modal: focus trap, Esc to close and focus restore come from the browser.
 * Children mount only while open so forms start fresh each time.
 */
export function Modal(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (props.open && !d.open) d.showModal();
    else if (!props.open && d.open) d.close();
  }, [props.open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={props.description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        props.onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose(); // backdrop click
      }}
      className={`m-auto w-[calc(100%-2rem)] ${props.wide ? "max-w-2xl" : "max-w-lg"} rounded-card bg-surface p-0 text-ink shadow-float`}
    >
      {props.open && (
        <div className="p-6">
          <div className="mb-5 flex items-start gap-4">
            <div className="flex-1 pt-1">
              <h2 id={titleId} className="text-xl font-semibold">
                {props.title}
              </h2>
              {props.description && (
                <p id={descId} className="mt-1 text-sm text-ink-2">
                  {props.description}
                </p>
              )}
            </div>
            <button type="button" className="icon-btn-sm -mr-1 -mt-1" aria-label="Close" onClick={props.onClose}>
              <CloseIcon />
            </button>
          </div>
          {props.children}
        </div>
      )}
    </dialog>
  );
}
