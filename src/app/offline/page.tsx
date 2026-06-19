import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Offline
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">No internet connection</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          You can still open previously cached public pages, but live feed updates,
          posting, and image uploads require an active connection.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Go to home
          </Link>
          <Link
            href="/about"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            About fairbook
          </Link>
        </div>
      </div>
    </main>
  );
}