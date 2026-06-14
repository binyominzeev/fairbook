import BrandLink from "@/components/BrandLink";
import Link from "next/link";
import { redirect } from "next/navigation";
import ManifestoContent from "@/components/ManifestoContent";
import { getSession } from "@/lib/auth";

export default async function RootPage() {
  const session = await getSession();
  if (session) {
    redirect("/feed");
  }

  return (
    <main className="flex-1 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.08),_transparent_22%),linear-gradient(180deg,_#fffef8_0%,_#f8fafc_42%,_#f8fafc_100%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-10 flex items-center justify-between border-b border-slate-200/80 pb-6">
          <BrandLink href="/" size="md" subtitle="Discourse with dignity" />
          <Link
            href="/login"
            className="rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:text-slate-950"
          >
            Sign in
          </Link>
        </header>

        <section className="grid flex-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-8">
            <ManifestoContent showSummary={false} />
          </div>

          <aside className="lg:sticky lg:top-8">
            <div className="rounded-[2rem] border border-slate-200 bg-slate-950 px-6 py-8 text-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.16)] sm:px-8">
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/90">
                    Join when ready
                  </p>
                  <p className="text-2xl font-semibold leading-tight">
                    Előbb olvass, aztán dönts.
                  </p>
                </div>

                <div className="space-y-4 text-sm leading-7 text-slate-300">
                  <p>
                    A Fairbook nem mindenkihez akar szólni, hanem azokhoz, akik a
                    nyilvános beszédben normákat, pontosságot és felelősséget keresnek.
                  </p>
                  <p>
                    Ha ezek a feltételek számodra is értékek, innen egy lépés a
                    belépés.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <Link
                    href="/login"
                    className="inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-950 transition-colors hover:bg-amber-50"
                  >
                    Sign in or register
                  </Link>
                  <p className="text-xs leading-6 text-slate-400">
                    A teljes manifesztó az About oldalon is elérhető belépés után.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
