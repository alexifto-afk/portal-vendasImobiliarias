import React, { useEffect, useRef, useId } from "react";
import { X } from "lucide-react";
export default function Dialog({ title, children, onClose, busy = false }) {
  const root = useRef(null),
    titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const focusable = () => [
      ...root.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      ),
    ];
    (
      focusable().find((e) => e.tagName === "INPUT") ||
      focusable()[0] ||
      root.current
    ).focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose();
      if (e.key === "Tab") {
        const list = focusable(),
          first = list[0],
          last = list.at(-1);
        if (!first) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [busy]);
  return (
    <div className="modal-shade" onClick={() => !busy && onClose()}>
      <section
        className="modal workspace-dialog"
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="close"
          aria-label="Fechar janela"
          disabled={busy}
          onClick={onClose}
        >
          <X />
        </button>
        <h2 id={titleId}>{title}</h2>
        {children}
      </section>
    </div>
  );
}
