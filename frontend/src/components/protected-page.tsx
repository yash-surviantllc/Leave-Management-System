"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { QueryProvider } from "@/providers/query-provider";
import { getMe } from "@/lib/api";
import {
  clearAuthSession,
  getAuthSession,
  getCachedAuthSession,
  updateAuthUser
} from "@/lib/auth";
import { hasAnyPermission, hasEveryPermission } from "@/lib/permissions";
import type { AuthSession, AuthUser } from "@/types";

type ProtectedPageProps = {
  requiredPermissions: string[];
  permissionMode?: "all" | "any";
  children: (context: { user: AuthUser; token: string }) => React.ReactNode;
};

export function ProtectedPage({
  permissionMode = "all",
  requiredPermissions,
  children
}: ProtectedPageProps) {
  return (
    <QueryProvider>
      <ProtectedPageContent
        permissionMode={permissionMode}
        requiredPermissions={requiredPermissions}
      >
        {children}
      </ProtectedPageContent>
    </QueryProvider>
  );
}

function ProtectedPageContent({
  permissionMode = "all",
  requiredPermissions,
  children
}: ProtectedPageProps) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(getCachedAuthSession);
  const [sessionChecked, setSessionChecked] = useState(() =>
    Boolean(getCachedAuthSession())
  );

  useEffect(() => {
    const storedSession = getAuthSession();

    if (!storedSession) {
      router.replace("/login");
      return;
    }

    setSession(storedSession);
    setSessionChecked(true);
  }, [router]);

  const me = useQuery({
    queryKey: ["me", session?.token],
    queryFn: () => getMe(session!.token),
    gcTime: 30 * 60_000,
    staleTime: 5 * 60_000,
    refetchOnMount: false,
    retry: false,
    enabled: Boolean(session?.token)
  });

  useEffect(() => {
    if (me.isError) {
      clearAuthSession();
      router.replace("/login");
      return;
    }

    if (!me.data) {
      return;
    }

    if (!me.data.success) {
      clearAuthSession();
      router.replace("/login");
      return;
    }

    const nextSession = updateAuthUser(me.data.data.user);

    if (nextSession) {
      setSession(nextSession);
    }
  }, [me.data, me.isError, router]);

  const user = me.data?.success ? me.data.data.user : session?.user;
  const validationFailed = me.isError || me.data?.success === false;
  const isAuthorized = useMemo(() => {
    if (!user) {
      return false;
    }

    if (permissionMode === "any") {
      return hasAnyPermission(user, requiredPermissions);
    }

    return hasEveryPermission(user, requiredPermissions);
  }, [permissionMode, requiredPermissions, user]);
  const isCheckingUpdatedPermissions = Boolean(user && !isAuthorized && me.isLoading);

  useEffect(() => {
    if (sessionChecked && user && !isAuthorized && !me.isLoading) {
      router.replace("/not-authorized");
    }
  }, [isAuthorized, me.isLoading, router, sessionChecked, user]);

  if (
    !sessionChecked ||
    !session ||
    !user ||
    validationFailed ||
    isCheckingUpdatedPermissions ||
    !isAuthorized
  ) {
    return (
      <main className="grid min-h-screen place-items-center bg-surface">
        <div className="h-10 w-10 animate-pulse rounded-md bg-brand-100" />
      </main>
    );
  }

  return <>{children({ user, token: session.token })}</>;
}
