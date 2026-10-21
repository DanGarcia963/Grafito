"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type FloatingModalProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  size?: "md" | "lg" | "xl" | "full";
  theme?: "light" | "dark";
};

const sizes = {
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-[min(96vw,1440px)]",
};

export default function FloatingModal({
  title,
  description,
  children,
  onClose,
  closeDisabled = false,
  size = "lg",
  theme = "light",
}: FloatingModalProps) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    setMounted(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeDisabled]);

  if (!mounted) return null;

  const dark = theme === "dark";
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`my-auto flex max-h-[94vh] w-full ${sizes[size]} flex-col overflow-hidden rounded-2xl border shadow-2xl ${dark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={`flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 sm:px-6 ${dark ? "border-slate-700" : "border-slate-200"}`}>
          <div>
            <h2 id={titleId} className="text-lg font-semibold sm:text-xl">{title}</h2>
            {description && <p id={descriptionId} className={`mt-1 text-sm ${dark ? "text-slate-400" : "text-slate-600"}`}>{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Cerrar ventana"
            disabled={closeDisabled}
            onClick={onClose}
            className={`rounded-lg border p-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${dark ? "border-slate-600 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-600 hover:bg-slate-100"}`}
          >
            <X size={17} />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
