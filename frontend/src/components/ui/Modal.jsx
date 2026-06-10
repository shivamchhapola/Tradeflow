import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

/**
 * Accessible modal:
 *   - portal'd to <body>
 *   - focus trap (Tab cycles inside)
 *   - Escape to close
 *   - returns focus to opener on close
 *   - aria-modal + aria-labelledby
 *   - respects prefers-reduced-motion
 */
export default function Modal({ open, onClose, title, children, labelledBy = "modal-title" }) {
  const cardRef = useRef(null);
  const openerRef = useRef(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;
    const card = cardRef.current;
    const focusables = card?.querySelectorAll(
      'a,button,select,input,textarea,[tabindex]:not([tabindex="-1"])'
    );
    focusables?.[0]?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener && typeof opener.focus === "function") opener.focus();
    };
  }, [open]);

  const handleKey = useCallback(
    (e) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key === "Tab") {
        const focusables = cardRef.current?.querySelectorAll(
          'a,button,select,input,textarea,[tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const list = Array.from(focusables).filter((n) => !n.disabled);
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [open, onClose]
  );

  useEffect(() => {
    if (!open) return undefined;
    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, handleKey]);

  const dur = reduceMotion ? 0 : 0.18;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        >
          <motion.div
            ref={cardRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: dur }}
          >
            <div className="modal-header">
              <span className="modal-title" id={labelledBy}>
                {title}
              </span>
              <button
                type="button"
                className="modal-close"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
