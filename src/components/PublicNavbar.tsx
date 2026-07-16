import BrandLink from "@/components/BrandLink";
import Link from "next/link";

export default function PublicNavbar() {
  return (
    <header className="z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm sm:sticky sm:top-0">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-3 py-3 sm:h-16 sm:px-4 sm:py-0">
        <BrandLink href="/" size="sm" />
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
          >
            Sign in
          </Link>
          <Link
            href="/login?mode=register"
            className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
          >
            Register
          </Link>
        </div>
      </div>
    </header>
  );
}