import { X } from "lucide-react";
import Button from "./Button";

export default function Modal({
  open,
  isOpen,
  title,
  description,
  children,
  onClose,
  onConfirm,
  confirmLabel = "Confirm",
  danger,
  loading = false,
}) {
  const isModalOpen = Boolean(open ?? isOpen);
  if (!isModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-white/20 animate-scale-in dark:bg-slate-900 dark:border dark:border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="modal-title" className="text-xl font-display font-bold text-safar-ink dark:text-white">
              {title}
            </h2>
            {description && (
              <p className="mt-2 text-sm leading-6 text-safar-gray dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
          <button
            className="focus-ring icon-button rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children && <div className="mt-4">{children}</div>}
        {onConfirm && (
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
              {confirmLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
