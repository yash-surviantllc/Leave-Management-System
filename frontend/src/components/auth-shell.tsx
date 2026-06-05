"use client";

import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  Users
} from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import hrHeroOne from "@/assets/hr1.jpg";
import hrHeroTwo from "@/assets/hr2.jpg";
import hrHeroThree from "@/assets/hr3.jpg";

type AuthShellProps = {
  children: ReactNode;
  subtitle: string;
  title: string;
};

type HeroMetric = {
  icon: typeof Users;
  label: string;
  value: string;
};

type HeroImage = {
  alt: string;
  image: StaticImageData;
};

const imageChangeDurationInMs = 2000;

const heroImages: HeroImage[] = [
  {
    alt: "HR workspace illustration",
    image: hrHeroOne
  },
  {
    alt: "Employee management illustration",
    image: hrHeroTwo
  },
  {
    alt: "People operations illustration",
    image: hrHeroThree
  }
];

const heroMetrics: HeroMetric[] = [
  {
    icon: Users,
    label: "Teams",
    value: "124"
  },
  {
    icon: Clock3,
    label: "On time",
    value: "96%"
  },
  {
    icon: CalendarDays,
    label: "Leave",
    value: "18"
  }
];

export function AuthShell({ children, subtitle, title }: AuthShellProps) {

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_12%_12%,rgba(216,247,232,0.95),transparent_32%),linear-gradient(135deg,#f7fbff_0%,#eff8f3_46%,#f7f7f4_100%)] px-3 py-3 text-ink sm:px-5 sm:py-5 lg:px-8">
      <section className="mx-auto grid min-w-0 min-h-[calc(100vh-1.5rem)] w-full max-w-6xl overflow-hidden rounded-lg border border-white/90 bg-white/78 shadow-[0_28px_80px_rgba(23,33,29,0.14)] lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[minmax(360px,0.88fr)_minmax(460px,1fr)]">
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

        <AuthHero />
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

function AuthHero() {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveImageIndex((currentIndex) => (currentIndex + 1) % heroImages.length);
    }, imageChangeDurationInMs);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <aside className="relative m-3 hidden overflow-hidden rounded-lg bg-[#101011] text-white lg:flex">
      <Image
        key={heroImages[activeImageIndex].alt}
        src={heroImages[activeImageIndex].image}
        alt={heroImages[activeImageIndex].alt}
        fill
        priority={activeImageIndex === 0}
        sizes="(min-width: 1024px) 50vw, 0px"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,9,0.12)_0%,rgba(8,8,9,0.28)_42%,rgba(8,8,9,0.84)_100%)]" />

      <div className="relative z-10 flex min-h-full w-full flex-col justify-end px-8 py-8">
        <div className="mx-auto w-full max-w-md text-center">
          <h2 className="text-2xl font-semibold tracking-normal">
            Manage your people anywhere
          </h2>
          <p className="mx-auto mt-4 max-w-xs text-sm leading-6 text-white/72">
            Track attendance, hiring, and leave from one secure workspace.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3">
          {heroMetrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <div
                className="min-w-0 rounded-lg border border-white/12 bg-black/24 px-3 py-3 backdrop-blur-md"
                key={metric.label}
              >
                <div className="flex min-w-0 items-center gap-2 text-white/72">
                  <Icon size={15} aria-hidden="true" />
                  <span className="min-w-0 truncate text-xs">{metric.label}</span>
                </div>
                <p className="mt-2 text-xl font-semibold tracking-normal text-white">
                  {metric.value}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-7 flex h-6 items-center gap-2 rounded-full bg-black/28 px-2 backdrop-blur-md">
          {heroImages.map((heroImage, index) => (
            <span
              className={`h-1.5 rounded-full transition-all ${
                index === activeImageIndex ? "w-5 bg-brand-100" : "w-1.5 bg-white/55"
              }`}
              key={heroImage.alt}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
