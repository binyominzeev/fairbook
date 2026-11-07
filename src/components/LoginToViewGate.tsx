import Link from "next/link";
import PublicNavbar from "@/components/PublicNavbar";
import { t, type AppLocale } from "@/lib/i18n";
import { loginHref } from "@/lib/auth-redirect";

export default function LoginToViewGate({ locale, returnTo }: { locale: AppLocale; returnTo?: string }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNavbar returnTo={returnTo} />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">{t(locale, "gate.title")}</h1>
          <p className="mt-2 text-sm text-slate-600">{t(locale, "gate.description")}</p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Link
              href={loginHref(returnTo, true)}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              {t(locale, "gate.register")}
            </Link>
            <Link
              href={loginHref(returnTo)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400"
            >
              {t(locale, "gate.signIn")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
