'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Trash2,
  LogOut,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  icon?: 'trash' | 'logout' | 'alert' | 'help';
}

export interface AlertOptions {
  title: string;
  message: string;
  buttonText?: string;
  variant?: 'error' | 'success' | 'warning' | 'info';
}

interface NotificationContextType {
  toast: {
    success: (title: string, description?: string, duration?: number) => void;
    error: (title: string, description?: string, duration?: number) => void;
    warning: (title: string, description?: string, duration?: number) => void;
    info: (title: string, description?: string, duration?: number) => void;
  };
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  // Alert Modal state
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    options: AlertOptions;
    resolve: () => void;
  } | null>(null);

  // Auto-dismiss timers ref
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, title: string, description?: string, duration = 3500) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { id, type, title, description, duration };

      setToasts((prev) => [...prev.slice(-3), newToast]); // Keep up to 4 toasts

      if (duration > 0) {
        const timer = setTimeout(() => {
          removeToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }
    },
    [removeToast]
  );

  const toast = {
    success: useCallback(
      (title: string, description?: string, duration?: number) =>
        addToast('success', title, description, duration),
      [addToast]
    ),
    error: useCallback(
      (title: string, description?: string, duration?: number) =>
        addToast('error', title, description, duration),
      [addToast]
    ),
    warning: useCallback(
      (title: string, description?: string, duration?: number) =>
        addToast('warning', title, description, duration),
      [addToast]
    ),
    info: useCallback(
      (title: string, description?: string, duration?: number) =>
        addToast('info', title, description, duration),
      [addToast]
    ),
  };

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmModal({
        isOpen: true,
        options,
        resolve: (result: boolean) => {
          setConfirmModal(null);
          resolve(result);
        },
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions | string): Promise<void> => {
    const normalizedOptions: AlertOptions =
      typeof options === 'string'
        ? { title: 'Notice', message: options, variant: 'info' }
        : options;

    return new Promise((resolve) => {
      setAlertModal({
        isOpen: true,
        options: normalizedOptions,
        resolve: () => {
          setAlertModal(null);
          resolve();
        },
      });
    });
  }, []);

  return (
    <NotificationContext.Provider value={{ toast, confirm, alert }}>
      {children}

      {/* Floating Stacked Toast Notifications */}
      <div
        role="region"
        aria-label="Notifications"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const config = {
            success: {
              border: 'border-emerald-200/90',
              bg: 'bg-white/95 backdrop-blur-2xl',
              iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
              shadow: 'shadow-[0_12px_36px_rgba(16,185,129,0.12)]',
              Icon: CheckCircle2,
              titleColor: 'text-slate-900',
            },
            error: {
              border: 'border-rose-200/90',
              bg: 'bg-white/95 backdrop-blur-2xl',
              iconBg: 'bg-rose-50 text-rose-600 border border-rose-200',
              shadow: 'shadow-[0_12px_36px_rgba(244,63,94,0.12)]',
              Icon: AlertCircle,
              titleColor: 'text-slate-900',
            },
            warning: {
              border: 'border-amber-200/90',
              bg: 'bg-white/95 backdrop-blur-2xl',
              iconBg: 'bg-amber-50 text-amber-600 border border-amber-200',
              shadow: 'shadow-[0_12px_36px_rgba(245,158,11,0.12)]',
              Icon: AlertTriangle,
              titleColor: 'text-slate-900',
            },
            info: {
              border: 'border-blue-200/90',
              bg: 'bg-white/95 backdrop-blur-2xl',
              iconBg: 'bg-blue-50 text-blue-600 border border-blue-200',
              shadow: 'shadow-[0_12px_36px_rgba(37,99,235,0.12)]',
              Icon: Info,
              titleColor: 'text-slate-900',
            },
          }[t.type];

          const IconComponent = config.Icon;

          return (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-2xl border p-3.5 sm:p-4 flex items-start gap-3 transition-all duration-300 animate-toast ${config.border} ${config.bg} ${config.shadow}`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${config.iconBg}`}
              >
                <IconComponent className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0 pr-1">
                <p className={`text-xs sm:text-sm font-black tracking-tight ${config.titleColor}`}>
                  {t.title}
                </p>
                {t.description && (
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5 leading-snug">
                    {t.description}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white/95 backdrop-blur-2xl border border-blue-100/90 rounded-3xl p-6 sm:p-7 shadow-[0_25px_60px_rgba(15,23,42,0.18)] animate-modal relative"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmModal.options.variant === 'danger'
                    ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-xs'
                    : confirmModal.options.variant === 'warning'
                    ? 'bg-amber-50 text-amber-600 border border-amber-200 shadow-xs'
                    : 'bg-blue-50 text-blue-600 border border-blue-200 shadow-xs'
                }`}
              >
                {confirmModal.options.icon === 'trash' ||
                confirmModal.options.variant === 'danger' ? (
                  <Trash2 className="w-6 h-6" />
                ) : confirmModal.options.icon === 'logout' ? (
                  <LogOut className="w-6 h-6" />
                ) : confirmModal.options.variant === 'warning' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <HelpCircle className="w-6 h-6" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {confirmModal.options.title}
                </h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed mt-1.5">
                  {confirmModal.options.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                autoFocus
                onClick={() => confirmModal.resolve(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition active:scale-95 cursor-pointer"
              >
                {confirmModal.options.cancelText || 'Cancel'}
              </button>

              <button
                type="button"
                onClick={() => confirmModal.resolve(true)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white transition active:scale-95 cursor-pointer shadow-md ${
                  confirmModal.options.variant === 'danger'
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-500/25'
                    : confirmModal.options.variant === 'warning'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-amber-500/25'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25'
                }`}
              >
                {confirmModal.options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertModal && alertModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white/95 backdrop-blur-2xl border border-blue-100/90 rounded-3xl p-6 sm:p-7 shadow-[0_25px_60px_rgba(15,23,42,0.18)] animate-modal relative"
            role="alertdialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  alertModal.options.variant === 'error'
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : alertModal.options.variant === 'warning'
                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                    : alertModal.options.variant === 'success'
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-blue-50 text-blue-600 border border-blue-200'
                }`}
              >
                {alertModal.options.variant === 'error' ? (
                  <ShieldAlert className="w-6 h-6" />
                ) : alertModal.options.variant === 'warning' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : alertModal.options.variant === 'success' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <Info className="w-6 h-6" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {alertModal.options.title}
                </h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed mt-1.5">
                  {alertModal.options.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                autoFocus
                onClick={() => alertModal.resolve()}
                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 transition active:scale-95 cursor-pointer shadow-md shadow-blue-500/25"
              >
                {alertModal.options.buttonText || 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
