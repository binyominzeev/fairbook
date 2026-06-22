import BrandLink from "@/components/BrandLink";
import ChildSafetyReportForm from "@/components/ChildSafetyReportForm";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ChildSafetyReportPage(props: {
  searchParams: Promise<{ postId?: string; targetUrl?: string }>;
}) {
  const { postId, targetUrl } = await props.searchParams;
  const session = await getSession();
  const user = session
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, slug: true, name: true, email: true, avatarUrl: true },
      })
    : null;

  return (
    <>
      {user ? (
        <Navbar user={user} />
      ) : (
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
            <BrandLink href="/" size="sm" subtitle="Manifesto" />
            <Link
              href="/login"
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950"
            >
              Sign in
            </Link>
          </div>
        </header>
      )}

      <main className="flex-1 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.16),_transparent_28%),linear-gradient(180deg,_#fffef8_0%,_#f8fafc_38%,_#f8fafc_100%)]">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-6 max-w-2xl space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">
              Child Safety Report
            </p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Jelentés / Report
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Use this form to report child safety concerns. You do not need to report comments individually.
            </p>
          </div>

          <ChildSafetyReportForm initialPostId={postId} initialTargetUrl={targetUrl} />
        </div>
      </main>
    </>
  );
}
