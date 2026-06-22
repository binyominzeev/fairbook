import BrandLink from "@/components/BrandLink";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ChildSafetyPage() {
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
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-8 max-w-3xl space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">
              Child Safety / Gyermekbiztonság
            </p>
            <p className="text-base leading-7 text-slate-600">
              This page contains the platform's Child Safety policy.
            </p>
          </div>

          <hr className="my-8 border-slate-200" />

          <article className="prose prose-slate max-w-none space-y-6 text-slate-700 leading-relaxed">
            <header className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Child Safety / Gyermekbiztonság
              </h1>
              <p className="text-sm text-slate-500 italic">Effective: 2026-06-22</p>
            </header>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 pt-4">English</h2>
              <p>
                Fairbook is committed to protecting children. We enforce a zero-tolerance policy against child sexual abuse material (CSAM) and child sexual exploitation and abuse (CSAE). Any such content will be immediately removed, the offending accounts permanently banned, and the incident promptly reported to the relevant regional and national law enforcement authorities. If you encounter any child safety concerns, please use the in-app reporting tool or contact us immediately at szvbinjomin AT gmail DOT com.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 pt-4">Magyar</h2>
              <p>
                A Fairbook elkötelezett a gyermekek védelme mellett. Platformunkon zéró tolerancia érvényes a gyermekek szexuális bántalmazásával, kizsákmányolásával, valamint az ilyen jellegű tartalmakkal (CSAM/CSAE) szemben. Minden ilyen tartalmat azonnal eltávolítunk, a vétkes fiókokat véglegesen letiltjuk, és az esetet haladéktalanul jelentjük a hatóságok felé. Ha ilyen tartalmat észlel, kérjük, használja az alkalmazáson belüli jelentési funkciót, vagy vegye fel velünk a kapcsolatot a szvbinjomin KUKAC gmail PONT  com címen.
              </p>
            </section>
          </article>
        </div>
      </main>
    </>
  );
}
