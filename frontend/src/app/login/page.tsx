"use client";

import { Eye, EyeOff, LockKeyhole, LogIn, Mail, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthShell } from "@/components/auth-shell";
import { getApiErrorMessage, login } from "@/lib/api";
import { setAuthSession } from "@/lib/auth";

type LoginFormValues = {
  email: string;
  password: string;
};

const inputClassName =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-11 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const {
    formState: { isSubmitting },
    handleSubmit,
    register
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: "admin@lms.local",
      password: "Admin@12345"
    }
  });

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    const response = await login(values).catch(() => null);

    if (!response) {
      setError("Unable to reach the API");
      return;
    }

    if (!response.success) {
      setError(getApiErrorMessage(response));
      return;
    }

    setAuthSession(response.data);
    router.push("/dashboard");
  }

  return (
    <AuthShell
      title="Welcome Back!"
      subtitle="Please enter your login details below."
    >
      <form className="mt-8" onSubmit={handleSubmit(onSubmit)}>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <label className="mt-6 block">
          <span className="sr-only">Email</span>
          <span className="relative block">
            <Mail
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
              aria-hidden="true"
            />
            <input
              className={inputClassName}
              type="email"
              autoComplete="email"
              placeholder="Email"
              {...register("email", { required: true })}
            />
          </span>
        </label>

        <label className="mt-4 block">
          <span className="sr-only">Password</span>
          <span className="relative block">
            <LockKeyhole
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
              aria-hidden="true"
            />
            <input
              className={inputClassName}
              type={isPasswordVisible ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Password"
              {...register("password", { required: true })}
            />
            <button
              className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-slate-500 transition hover:bg-surface hover:text-slate-700"
              type="button"
              onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
              aria-label={isPasswordVisible ? "Hide password" : "Show password"}
            >
              {isPasswordVisible ? (
                <EyeOff size={17} aria-hidden="true" />
              ) : (
                <Eye size={17} aria-hidden="true" />
              )}
            </button>
          </span>
        </label>

        <div className="mt-4 flex justify-end text-sm">
          <Link className="font-medium text-slate-600 hover:text-brand-600 transition" href="/forgot-password">
            Forgot password?
          </Link>
        </div>

        <button
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-slate-800 focus:ring-4 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          <LogIn size={18} aria-hidden="true" />
          Sign in
        </button>

        <div className="mt-6 flex items-center gap-4 text-xs font-medium text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          <span>or continue</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <Link
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 focus:ring-4 focus:ring-slate-200"
          href="/register"
        >
          <UserPlus size={18} aria-hidden="true" />
          Create account
        </Link>
      </form>
    </AuthShell>
  );
}
