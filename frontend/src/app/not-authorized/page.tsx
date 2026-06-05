import Link from "next/link";
import { LockKeyhole } from "lucide-react";

export default function NotAuthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-5">
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 text-center shadow-soft">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-brand-50 text-brand-700">
          <LockKeyhole size={24} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-normal">
          Not authorized
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Your current role does not have access to this page.
        </p>
        <Link
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
          href="/dashboard"
        >
          Go to dashboard
        </Link>
      </section>
    </main>
  );
}
