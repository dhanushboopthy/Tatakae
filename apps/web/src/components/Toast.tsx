import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CloseIcon } from "./icons";

// Calm, short toasts (aria-live polite). One at a time; a new one replaces the old.

interface ToastItem {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

type ToastFn = (message: string, opts?: { action?: ToastItem["action"]; durationMs?: number }) => void;

const ToastContext = createContext<ToastFn>(() => undefined);

export function useToast(): ToastFn {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const timer = useRef<number | null>(null);
  const seq = useRef(0);

  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setItem(null);
  }, []);

  const toast = useCallback<ToastFn>((message, opts) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    seq.current += 1;
    setItem({ id: seq.current, message, action: opts?.action });
    timer.current = window.setTimeout(() => setItem(null), opts?.durationMs ?? 4000);
  }, []);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        {item && (
          <div
            key={item.id}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-charcoal py-1.5 pl-5 pr-1.5 text-on-charcoal shadow-float"
          >
            <p className="flex-1 text-sm font-medium">{item.message}</p>
            {item.action && (
              <button
                type="button"
                className="btn min-h-0 bg-lime px-4 py-2 text-sm text-on-accent"
                onClick={() => {
                  item.action?.onClick();
                  clear();
                }}
              >
                {item.action.label}
              </button>
            )}
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-on-charcoal/10"
              aria-label="Dismiss"
              onClick={clear}
            >
              <CloseIcon size={18} />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
