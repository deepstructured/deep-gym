import { cn } from "@/shared/lib/cn";
import { Spinner } from "./spinner";

export function DotValue({
  value,
  suffix,
  className,
  suffixClassName,
}: {
  value: string | number;
  suffix?: string;
  className?: string;
  suffixClassName?: string;
}) {
  return (
    <span className={cn("font-dot leading-none tracking-tight", className)}>
      {value}
      {suffix && (
        <span
          className={cn(
            "ml-1.5 font-sans text-sm font-normal opacity-60",
            suffixClassName,
          )}
        >
          {suffix}
        </span>
      )}
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <div className="dots-bg mb-2 h-16 w-16 rounded-full opacity-40" />
      <p className="font-medium text-text">{title}</p>
      {hint && <p className="max-w-60 text-sm text-muted">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex justify-center py-20 text-muted">
      <Spinner size={28} />
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-flame/30 bg-flame/10 px-4 py-3 text-sm text-[#ff8f73]">
      {message}
    </div>
  );
}

export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "lime" | "pink" | "onGradient";
  className?: string;
}) {
  const tones = {
    neutral: "bg-raised text-muted border border-line",
    lime: "bg-lime/15 text-lime border border-lime/25",
    pink: "bg-pink/15 text-pink border border-pink/25",
    onGradient: "bg-white/15 text-white border border-white/20",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
