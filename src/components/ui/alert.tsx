import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, { wrapper: string; icon: string }> = {
  info: {
    wrapper: "border-blue-200 bg-blue-50 text-blue-900",
    icon: "text-blue-600",
  },
  success: {
    wrapper: "border-emerald-200 bg-emerald-50 text-emerald-900",
    icon: "text-emerald-600",
  },
  warning: {
    wrapper: "border-amber-200 bg-amber-50 text-amber-900",
    icon: "text-amber-600",
  },
  danger: {
    wrapper: "border-red-200 bg-red-50 text-red-900",
    icon: "text-red-600",
  },
};

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: ShieldAlert,
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = ICONS[tone];
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3 text-sm",
        TONES[tone].wrapper,
        className,
      )}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", TONES[tone].icon)} aria-hidden="true" />
      <div className="space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="space-y-1 leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}
