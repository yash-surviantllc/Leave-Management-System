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
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_12%_12%,rgba(216,247,232,0.95),transparent_32%),linear-gradient(135deg,#f7fbff_0%,#eff8f3_46%,#f7f7f4_100%)] px-3 py-3 text-ink sm:px-5 sm:py-5 lg:px-8">
      <section className="mx-auto grid min-w-0 min-h-[calc(100vh-1.5rem)] w-full max-w-md overflow-hidden rounded-lg border border-white/90 bg-white/78 shadow-[0_28px_80px_rgba(23,33,29,0.14)] lg:min-h-[calc(100vh-2.5rem)]">
        <section className="flex min-h-[calc(100vh-1.5rem)] min-w-0 flex-col px-6 py-6 sm:px-10 sm:py-8 lg:min-h-0 lg:px-14 lg:py-9">
          <BrandMark />

          <div className="flex flex-1 items-center py-10 lg:py-8">
            <div className="w-full max-w-md min-w-0">
              <p className="text-sm font-semibold text-brand-700">Secure LMS access</p>
              <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-normal text-[#171717] sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">{subtitle}</p>
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
      <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#151515] text-white shadow-[0_12px_26px_rgba(23,23,23,0.16)]">
        <BriefcaseBusiness size={20} aria-hidden="true" />
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-600" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">LMS</p>
        <p className="truncate text-base font-semibold tracking-normal text-[#161616]">People Desk</p>
      </div>
    </div>
  );
}

