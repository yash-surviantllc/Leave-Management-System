"use client";

import { Eye, EyeOff, LockKeyhole, LogIn, Mail, UserCircle, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthShell } from "@/components/auth-shell";
import { getApiErrorMessage, register as registerAccount } from "@/lib/api";
import { setAuthSession } from "@/lib/auth";

type RegisterFormValues = {
  name: string;
  email: string;
  password: string;
};

const inputClassName =
  "h-12 w-full rounded-2xl border border-white/80 bg-white px-12 text-sm text-slate-800 shadow-[0_14px_35px_rgba(20,48,39,0.06)] outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const {
    formState: { isSubmitting },
    handleSubmit,
    register
  } = useForm<RegisterFormValues>({
    defaultValues: {
      name: "",
      email: "",
      password: ""
    }
  });

  async function onSubmit(values: RegisterFormValues) {
    setError(null);
    const response = await registerAccount(values).catch(() => null);

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
      title="Create Account"
      subtitle="Start with your employee self-service access."
    >
      <form className="mt-9" onSubmit={handleSubmit(onSubmit)}>
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <label className="mt-5 block">
          <span className="sr-only">Name</span>
          <span className="relative block">
            <UserCircle
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
              aria-hidden="true"
            />
            <input
              className={inputClassName}
              type="text"
              autoComplete="name"
              placeholder="Name"
              {...register("name", { required: true })}
            />
          </span>
        </label>

        <label className="mt-4 block">
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
              autoComplete="new-password"
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

        <button
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111111] px-4 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(17,17,17,0.18)] transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          <UserPlus size={18} aria-hidden="true" />
          Create account
        </button>

        <div className="mt-7 flex items-center gap-4 text-xs text-slate-500">
          <span className="h-px flex-1 bg-line" />
          <span>or continue</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <Link
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-surface"
          href="/login"
        >
          <LogIn size={18} aria-hidden="true" />
          Sign in instead
        </Link>
      </form>
    </AuthShell>
  );
}
