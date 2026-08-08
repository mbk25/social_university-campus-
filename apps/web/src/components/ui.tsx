"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { CheckIcon, CloseIcon } from "./icons";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ------------------------------------------------------------------- Avatar
const AVATAR_COLORS = [
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-indigo-500 to-blue-500",
];

const SIZES = { xs: 24, sm: 32, md: 40, lg: 56, xl: 88 } as const;

export function Avatar({
  src,
  name,
  size = "md",
  ring = false,
  className,
  style,
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof SIZES;
  ring?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const px = SIZES[size];
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toLocaleUpperCase("tr") ?? "")
    .join("");
  const colorIndex =
    Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length;

  return (
    <span
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white select-none",
        !src && `bg-gradient-to-br ${AVATAR_COLORS[colorIndex]}`,
        ring && "ring-2 ring-offset-2",
        className,
      )}
      style={
        {
          width: px,
          height: px,
          fontSize: px * 0.38,
          "--tw-ring-color": "var(--brand)",
          "--tw-ring-offset-color": "var(--bg-elevated)",
          ...style,
        } as React.CSSProperties
      }
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        initials || "?"
      )}
    </span>
  );
}

// ------------------------------------------------------------------- Button
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--brand)] text-white hover:brightness-110 active:brightness-95 shadow-[0_6px_20px_-8px_var(--brand)]",
  secondary: "surface hover:bg-[var(--bg-subtle)] text-[var(--text)]",
  ghost: "hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]",
  outline:
    "border border-[var(--border-strong)] bg-transparent hover:bg-[var(--bg-subtle)] text-[var(--text)]",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
};

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, fullWidth, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center font-semibold transition-all focus-ring",
        "disabled:cursor-not-allowed disabled:opacity-55",
        VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={size === "sm" ? 14 : 16} /> : icon}
      {children}
    </button>
  );
});

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={cx("animate-spin", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// -------------------------------------------------------------------- Input
interface FieldProps {
  label?: string;
  hint?: string;
  error?: string | null;
  success?: string | null;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  function Input({ label, hint, error, success, className, id, ...rest }, ref) {
    const inputId = id ?? rest.name;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cx(
            "w-full rounded-xl border bg-[var(--bg-subtle)] px-3.5 py-2.5 text-[15px] transition-colors",
            "placeholder:text-[var(--text-faint)] focus-ring focus:border-[var(--brand)]",
            error ? "border-rose-500/70" : "border-[var(--border)]",
            className,
          )}
          {...rest}
        />
        {error ? (
          <p className="mt-1.5 text-[13px] text-rose-500">{error}</p>
        ) : success ? (
          <p className="mt-1.5 flex items-center gap-1 text-[13px] text-emerald-500">
            <CheckIcon width={14} height={14} /> {success}
          </p>
        ) : hint ? (
          <p className="mt-1.5 text-[13px] text-faint">{hint}</p>
        ) : null}
      </div>
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps
>(function Textarea({ label, hint, error, className, id, ...rest }, ref) {
  const inputId = id ?? rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-muted">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={cx(
          "w-full resize-none rounded-xl border bg-[var(--bg-subtle)] px-3.5 py-2.5 text-[15px] leading-relaxed transition-colors",
          "placeholder:text-[var(--text-faint)] focus-ring focus:border-[var(--brand)]",
          error ? "border-rose-500/70" : "border-[var(--border)]",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p className="mt-1.5 text-[13px] text-rose-500">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-faint">{hint}</p>
      ) : null}
    </div>
  );
});

export function Select({
  label,
  error,
  hint,
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  return (
    <div className="w-full">
      {label && <label className="mb-1.5 block text-[13px] font-medium text-muted">{label}</label>}
      <select
        className={cx(
          "w-full appearance-none rounded-xl border bg-[var(--bg-subtle)] px-3.5 py-2.5 text-[15px] transition-colors focus-ring focus:border-[var(--brand)]",
          error ? "border-rose-500/70" : "border-[var(--border)]",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p className="mt-1.5 text-[13px] text-rose-500">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

// --------------------------------------------------------------------- Chip
export function Chip({
  children,
  active,
  onClick,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const Component = onClick ? "button" : "span";
  return (
    <Component
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
        active
          ? "bg-[var(--brand)] text-white"
          : "surface-subtle text-muted hover:text-[var(--text)]",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </Component>
  );
}

// -------------------------------------------------------------------- Modal
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          "surface animate-fade-up relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-3xl sm:rounded-3xl",
          widths[size],
        )}
      >
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-4">
            <h2 className="text-[17px] font-bold">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
              aria-label="Kapat"
            >
              <CloseIcon width={18} height={18} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
    ,
    document.body,
  );
}

// ---------------------------------------------------------------- Skeleton
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-lg", className)} />;
}

export function PostSkeleton() {
  return (
    <div className="surface rounded-[var(--radius-card)] p-4">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    </div>
  );
}

// -------------------------------------------------------------- EmptyState
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl brand-soft-bg brand-text">
          {icon}
        </div>
      )}
      <h3 className="text-[17px] font-bold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// -------------------------------------------------------------------- Toast
type Toast = { id: number; message: string; type: "success" | "error" | "info" };

const ToastContext = createContext<{ show: (message: string, type?: Toast["type"]) => void } | null>(
  null,
);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cx(
              "animate-fade-up pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lg",
              toast.type === "success" && "bg-emerald-600 text-white",
              toast.type === "error" && "bg-rose-600 text-white",
              toast.type === "info" && "surface",
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) return { show: (m: string) => console.log(m) };
  return context;
}

// ------------------------------------------------------------------ zaman
export function timeAgo(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return "şimdi";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dk`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} sa`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} g`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)} hf`;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(".0", "")}B`;
  return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
}

export function formatDate(input: string | Date, withTime = false): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
