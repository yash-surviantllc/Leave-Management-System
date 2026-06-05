import type { LucideIcon } from "lucide-react";

type StatusCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: "brand" | "blue" | "amber" | "slate";
};

const toneClasses: Record<StatusCardProps["tone"], string> = {
  brand: "bg-brand-50 text-brand-700",
  blue: "bg-sky-50 text-sky-700",
  amber: "bg-amber-50 text-amber-700",
  slate: "bg-slate-100 text-slate-700"
};

export function StatusCard({
  label,
  value,
  detail,
  icon: Icon,
  tone
}: StatusCardProps) {
  return (
    <article className="min-w-0 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-normal text-ink">
            {value}
          </p>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${toneClasses[tone]}`}>
          <Icon size={20} aria-hidden="true" />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-500">{detail}</p>
    </article>
  );
}
