import { X } from "lucide-react";
import Button from "../common/Button";

export default function AdminFormModal({
  open,
  isOpen,
  title,
  subtitle,
  children,
  onClose,
  onSubmit,
  submitLabel = "Save",
  loading = false,
  hideFooter = false,
}) {
  const isModalOpen = Boolean(open ?? isOpen);
  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-safar-ink/45 p-0 sm:items-center sm:p-4 backdrop-blur-sm animate-fade-in">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-soft sm:max-w-2xl sm:rounded-2xl dark:bg-slate-900 dark:border dark:border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-safar-ink dark:text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-safar-gray dark:text-slate-400">{subtitle}</p>}
          </div>
          <button
            className="focus-ring rounded-lg p-2 text-safar-gray hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            type="button"
            onClick={onClose}
            aria-label="Close form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {onSubmit ? (
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            {children}
            {!hideFooter && (
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button variant="secondary" type="button" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button loading={loading} type="submit">
                  {submitLabel}
                </Button>
              </div>
            )}
          </form>
        ) : (
          <div className="mt-5 space-y-4">{children}</div>
        )}
      </div>
    </div>
  );
}
