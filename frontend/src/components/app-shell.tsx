"use client";

import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UserCircle,
  Users,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { RealtimeNotifications } from "@/components/realtime-notifications";
import { listNotifications, logout } from "@/lib/api";
import { clearAuthSession } from "@/lib/auth";
import { prefetchNavData } from "@/lib/nav-prefetch";
import {
  notificationUnreadCountEventName,
  type NotificationUnreadCountEventDetail
} from "@/lib/optimistic-cache";
import { hasAnyPermission, hasEveryPermission, roleLabels } from "@/lib/permissions";
import type { AuthUser } from "@/types";

type AppShellProps = {
  user: AuthUser;
  token: string;
  children: React.ReactNode;
};

type NavItem = {
  label: string;
  icon: LucideIcon;
  permissions: string[];
  permissionMode?: "all" | "any";
  section: string;
  href?: string;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    section: "Home",
    permissions: ["dashboard:read"]
  },
  {
    label: "Reports",
    icon: BarChart3,
    href: "/reports",
    section: "Analyze",
    permissions: ["reports:read"]
  },
  {
    label: "Notifications",
    icon: Bell,
    href: "/notifications",
    section: "Home",
    permissions: ["notifications:read"]
  },
      {
    label: "Profile",
    icon: UserCircle,
    href: "/profile",
    section: "Home",
    permissions: ["profile:read"]
  },
  {
    label: "Employees",
    icon: Users,
    href: "/employees",
    section: "Teams",
    permissions: ["employees:manage"]
  },
  {
    label: "Departments",
    icon: Building2,
    href: "/departments",
    section: "Teams",
    permissions: ["employees:manage"]
  },
  {
    label: "Designations",
    icon: BriefcaseBusiness,
    href: "/designations",
    section: "Teams",
    permissions: ["employees:manage"]
  },
  {
    label: "My Attendance",
    icon: Clock3,
    href: "/attendance",
    section: "Time",
    permissions: ["attendance:write"]
  },
  {
    label: "Attendance Report",
    icon: ClipboardList,
    href: "/attendance/report",
    section: "Time",
    permissions: ["attendance:read"]
  },
  {
    label: "Shift Settings",
    icon: Settings,
    href: "/shifts",
    section: "Time",
    permissions: ["attendance:manage"]
  },
  {
    label: "Holidays",
    icon: CalendarCheck,
    href: "/holidays",
    section: "Time",
    permissions: [
      "attendance:manage",
      "attendance:read",
      "attendance:write",
      "leave:request",
      "leave:approve",
      "leave:manage"
    ],
    permissionMode: "any"
  },
  {
    label: "Apply Leave",
    icon: CalendarDays,
    href: "/leaves/apply",
    section: "Leave",
    permissions: ["leave:request"]
  },
  {
    label: "My Leaves",
    icon: CalendarDays,
    href: "/leaves/me",
    section: "Leave",
    permissions: ["leave:request"]
  },
  {
    label: "Leave Approvals",
    icon: CalendarDays,
    href: "/leaves/approvals",
    section: "Leave",
    permissions: ["leave:approve"]
  },
  {
    label: "Leave Balances",
    icon: ClipboardList,
    href: "/leaves/balances",
    section: "Leave",
    permissions: ["leave:request"]
  },
  {
    label: "Leave Settings",
    icon: Settings,
    href: "/leave-types",
    section: "Leave",
    permissions: ["leave:manage"]
  },
];

const navSectionOrder = [
  "Home",
  "Analyze",
  "Teams",
  "Time",
  "Leave",
  "Recruitment",
  "Manage"
];

const navDataPrefetchKeys = new Set<string>();
const navScrollStorageKey = "lms-nav-scroll-top";
const notificationBadgePageSize = 25;

function getNavDataPrefetchKey(token: string, href: string): string {
  return `${token}:${href}`;
}

function prefetchNavTargetData(
  queryClient: QueryClient,
  token: string,
  href: string
): void {
  const key = getNavDataPrefetchKey(token, href);

  if (navDataPrefetchKeys.has(key)) {
    return;
  }

  navDataPrefetchKeys.add(key);
  prefetchNavData(queryClient, token, href);
}

export function AppShell({ user, token, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const desktopNavRef = useRef<HTMLElement | null>(null);
  const mobileNavRef = useRef<HTMLElement | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
    const [liveUnreadNotificationCount, setLiveUnreadNotificationCount] = useState<
    number | null
  >(null);
  const primaryRole = user.roles[0];
  const canReadNotifications = hasEveryPermission(user, ["notifications:read"]);
  const visibleNavItems = useMemo(
    () =>
      navItems.filter((item) =>
        item.permissionMode === "any"
          ? hasAnyPermission(user, item.permissions)
          : hasEveryPermission(user, item.permissions)
      ),
    [user]
  );
  const notificationsQuery = useQuery({
    queryKey: ["notifications", token, 1],
    queryFn: () =>
      listNotifications(token, {
        page: 1,
        pageSize: notificationBadgePageSize
      }),
    enabled: canReadNotifications,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnMount: false
  });
  const queryUnreadNotificationCount = notificationsQuery.data?.success
    ? notificationsQuery.data.data.unreadCount
    : 0;
  const unreadNotificationCount =
    liveUnreadNotificationCount ?? queryUnreadNotificationCount;
  const hasUnreadNotifications = unreadNotificationCount > 0;
  const unreadNotificationLabel =
    unreadNotificationCount > 99 ? "99+" : String(unreadNotificationCount);
  const visibleNavSections = useMemo<NavSection[]>(
    () =>
      navSectionOrder
        .map((section) => ({
          label: section,
          items: visibleNavItems.filter((item) => item.section === section)
        }))
        .filter((section) => section.items.length > 0),
    [visibleNavItems]
  );

  
  useEffect(() => {
    if (notificationsQuery.data?.success) {
      setLiveUnreadNotificationCount(notificationsQuery.data.data.unreadCount);
    }
  }, [notificationsQuery.data]);

  useEffect(() => {
    function handleUnreadCountUpdate(event: Event) {
      const detail = (event as CustomEvent<NotificationUnreadCountEventDetail>).detail;

      if (detail?.token !== token) {
        return;
      }

      setLiveUnreadNotificationCount(detail.unreadCount);
    }

    window.addEventListener(
      notificationUnreadCountEventName,
      handleUnreadCountUpdate
    );

    return () => {
      window.removeEventListener(
        notificationUnreadCountEventName,
        handleUnreadCountUpdate
      );
    };
  }, [token]);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    const storedScrollTop = window.sessionStorage.getItem(navScrollStorageKey);

    if (!storedScrollTop) {
      return;
    }

    const scrollTop = Number(storedScrollTop);

    if (!Number.isFinite(scrollTop)) {
      return;
    }

    window.requestAnimationFrame(() => {
      desktopNavRef.current?.scrollTo({ top: scrollTop });
      mobileNavRef.current?.scrollTo({ top: scrollTop });
    });
  }, [pathname, isMobileNavOpen]);

  
  function prefetchRoute(href: string) {
    router.prefetch(href);
    prefetchNavTargetData(queryClient, token, href);
  }

  function rememberNavScroll() {
    const scrollTop = desktopNavRef.current?.scrollTop ?? mobileNavRef.current?.scrollTop ?? 0;

    window.sessionStorage.setItem(navScrollStorageKey, String(scrollTop));
  }

  async function signOut() {
    setIsSigningOut(true);
    await logout(token).catch((error: unknown) => {
      console.error(error);
    });
    clearAuthSession();
    queryClient.clear();
    router.push("/login");
  }

  function renderNavItems(items: NavItem[]) {
    const activePathname = pendingHref ?? pathname;

    return items.map((item) => {
      const Icon = item.icon;
      const active = item.href
        ? activePathname === item.href || activePathname.startsWith(`${item.href}/`)
        : false;
      const className = `flex min-h-10 w-full min-w-0 items-center gap-3 rounded-md border px-3 text-sm transition ${
        active
          ? "border-slate-200 bg-white font-semibold text-slate-950 shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
          : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white"
      }`;

      const href = item.href;

      if (href) {
        return (
          <Link
            key={item.label}
            className={className}
            href={href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            onFocus={() => prefetchRoute(href)}
            onPointerDown={() => prefetchRoute(href)}
            onPointerEnter={() => prefetchRoute(href)}
            onClick={() => {
              rememberNavScroll();
              setPendingHref(href);
              prefetchRoute(href);
              setIsMobileNavOpen(false);
            }}
          >
            <Icon className="shrink-0" size={18} aria-hidden="true" />
          <span className="min-w-0 truncate">{item.label}</span>
          </Link>
        );
      }

      return (
        <button key={item.label} className={className} type="button" disabled>
          <Icon className="shrink-0" size={18} aria-hidden="true" />
          <span className="min-w-0 truncate">{item.label}</span>
        </button>
      );
    });
  }

  function renderNavSections() {
    return visibleNavSections.map((section) => {
      return (
        <div className="space-y-1.5" key={section.label}>
          <p className="px-3 text-xs font-medium text-slate-400">{section.label}</p>
          <div className="space-y-1">{renderNavItems(section.items)}</div>
        </div>
      );
    });
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6f8] text-slate-950">
      <aside className="fixed inset-y-3 left-3 hidden w-[232px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-[#f8fafc] shadow-[0_18px_45px_rgba(15,23,42,0.08)] lg:flex">
        <Link
          href="/dashboard"
          className="m-2 flex h-12 min-w-0 items-center gap-3 rounded-lg bg-[#020617] px-3 text-white transition hover:bg-[#111827]"
          prefetch={false}
          onFocus={() => prefetchRoute("/dashboard")}
          onPointerDown={() => prefetchRoute("/dashboard")}
          onPointerEnter={() => prefetchRoute("/dashboard")}
          onClick={() => {
            rememberNavScroll();
            setPendingHref("/dashboard");
          }}
          aria-label="Go to dashboard"
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#ffffff] text-[#020617]">
            <LayoutDashboard size={19} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">LMS</p>
            <p className="truncate text-xs text-white/60">Organization</p>
          </div>
        </Link>

        <nav ref={desktopNavRef} className="flex-1 space-y-5 overflow-y-auto px-2 pb-4 pt-2">
          {renderNavSections()}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <Link
            href="/profile"
            className="flex min-w-0 items-center gap-3 rounded-md px-2 py-2 transition hover:bg-white"
            prefetch={false}
            onFocus={() => prefetchRoute("/profile")}
            onPointerDown={() => prefetchRoute("/profile")}
            onPointerEnter={() => prefetchRoute("/profile")}
            onClick={() => {
              rememberNavScroll();
              setPendingHref("/profile");
            }}
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
              <UserCircle size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </Link>
        </div>
      </aside>

      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-ink/30"
            type="button"
            onClick={() => setIsMobileNavOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="relative flex h-full w-[min(20rem,calc(100vw-1rem))] max-w-[92vw] flex-col border-r border-slate-200 bg-[#f8fafc] shadow-soft">
            <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 px-4">
              <Link
                href="/dashboard"
                className="flex min-w-0 items-center gap-3 rounded-md"
                prefetch={false}
                onFocus={() => prefetchRoute("/dashboard")}
                onPointerDown={() => prefetchRoute("/dashboard")}
                onPointerEnter={() => prefetchRoute("/dashboard")}
                onClick={() => {
                  rememberNavScroll();
                  setPendingHref("/dashboard");
                  setIsMobileNavOpen(false);
                }}
                aria-label="Go to dashboard"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#020617] text-white">
                  <LayoutDashboard size={19} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold">LMS</p>
                  <p className="text-xs text-slate-500">Organization</p>
                </div>
              </Link>
              <button
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-600"
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                aria-label="Close navigation"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <nav ref={mobileNavRef} className="space-y-5 overflow-y-auto p-3">{renderNavSections()}</nav>
          </aside>
        </div>
      ) : null}

      <section className="min-w-0 lg:pl-[252px]">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-[#f4f6f8]/92 px-3 py-2 backdrop-blur sm:px-5 sm:py-3">
          <div className="flex min-h-12 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-[0_8px_26px_rgba(15,23,42,0.04)] sm:gap-3 sm:px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <button
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-600 lg:hidden"
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                aria-label="Open navigation"
              >
                <Menu size={18} aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">
                  <span className="sm:hidden">LMS</span>
                  <span className="hidden sm:inline">Company Workspace</span>
                </p>
                <p className="hidden break-all text-xs text-slate-500 sm:block sm:truncate">
                  {primaryRole ? roleLabels[primaryRole] : "User"} | {user.email}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Link
                href="/notifications"
                className="relative grid h-10 w-10 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition-transform hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 sm:h-9 sm:w-9"
                aria-label={
                  hasUnreadNotifications
                    ? `${unreadNotificationCount} unread notifications`
                    : "Notifications"
                }
                prefetch={false}
                onFocus={() => prefetchRoute("/notifications")}
                onPointerDown={() => prefetchRoute("/notifications")}
                onPointerEnter={() => prefetchRoute("/notifications")}
                onClick={() => {
                  rememberNavScroll();
                  setPendingHref("/notifications");
                }}
              >
                <Bell size={18} aria-hidden="true" />
                <span
                  className={`absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white shadow-sm transition-all duration-150 ${
                    hasUnreadNotifications
                      ? "scale-100 opacity-100"
                      : "pointer-events-none scale-50 opacity-0"
                  }`}
                  aria-hidden={!hasUnreadNotifications}
                  aria-live="polite"
                >
                  {hasUnreadNotifications ? unreadNotificationLabel : null}
                </span>
              </Link>
              <button
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-0 text-sm font-semibold text-slate-700 shadow-sm transition-transform hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:w-auto sm:px-3"
                type="button"
                aria-label="Sign out"
                onClick={signOut}
                disabled={isSigningOut}
              >
                <LogOut size={16} aria-hidden="true" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl px-3 pb-6 pt-3 sm:px-5">
          {children}
        </div>
      </section>

      <RealtimeNotifications token={token} />
    </main>
  );
}
