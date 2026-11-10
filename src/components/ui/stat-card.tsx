import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </>
  );

  const className = cn(
    "block rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
    href && "transition-colors hover:border-slate-300 hover:bg-slate-50",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
