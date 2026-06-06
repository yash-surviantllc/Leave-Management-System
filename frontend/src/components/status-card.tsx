import type { LucideIcon } from "lucide-react";

type StatusCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: "brand" | "blue" | "amber" | "slate";
};

const toneClasses: Record<StatusCardProps["tone"], string> = {
  brand: "bg-brand-50 text-brand-600",
  blue: "bg-sky-50 text-sky-600",
  amber: "bg-amber-50 text-amber-600",
  slate: "bg-slate-100 text-slate-600"
};

export function StatusCard({
  label,
  value,
  detail,
  icon: Icon,
  tone
}: StatusCardProps) {
  return (
    <article className="group min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-card transition hover:shadow-hover">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition group-hover:scale-110 ${toneClasses[tone]}`}>
          <Icon size={20} aria-hidden="true" />
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-600">{detail}</p>
    </article>
  );
}
