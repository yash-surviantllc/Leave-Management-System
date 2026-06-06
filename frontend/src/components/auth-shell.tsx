"use client";

import type { ReactNode } from "react";
import {
  BriefcaseBusiness
} from "lucide-react";

type AuthShellProps = {
  children: ReactNode;
  subtitle: string;
  title: string;
};


export function AuthShell({ children, subtitle, title }: AuthShellProps) {

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-brand-50/30 px-4 py-8 text-ink sm:px-6 sm:py-12 lg:px-8">
      <section className="mx-auto grid min-w-0 min-h-[calc(100vh-4rem)] w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/60 bg-white/95 shadow-card backdrop-blur-sm lg:min-h-[calc(100vh-6rem)]">
        <section className="flex min-h-[calc(100vh-4rem)] min-w-0 flex-col px-6 py-8 sm:px-10 sm:py-10 lg:min-h-0 lg:px-12 lg:py-12">
          <BrandMark />

          <div className="flex flex-1 items-center py-8 lg:py-10">
            <div className="w-full max-w-md min-w-0 animate-fade-in">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Secure Access</p>
              <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{subtitle}</p>
              {children}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function BrandMark() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-soft">
        <BriefcaseBusiness size={20} aria-hidden="true" />
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500 shadow-sm" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">LMS Platform</p>
        <p className="truncate text-base font-bold tracking-tight text-slate-900">People Desk</p>
      </div>
    </div>
  );
}

