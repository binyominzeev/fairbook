import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { isAdminEmail } from "@/lib/admin";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildProfilePath } from "@/lib/profile-path";
import { getTrafficDashboard, type TrafficRange } from "@/lib/traffic-stats";

function formatInt(value: number) {
  return new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(value);
}

function formatDecimal(value: number, digits = 1) {
  return new Intl.NumberFormat("hu-HU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${formatDecimal(value, 1)}%`;
}

function formatDurationHours(value: number) {
  return `${formatDecimal(value, 1)} ora`;
}

type SearchParams = {
  range?: string;
};

export default async function StatsPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, slug: true, name: true, email: true, avatarUrl: true },
  });
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/feed");

  const { range } = await props.searchParams;
  const selectedRange: TrafficRange = range === "90d" ? "90d" : "30d";
  const dashboard = await getTrafficDashboard(selectedRange);

  const maxPageViews = Math.max(1, ...dashboard.timeseries.map((row) => row.pageViews));

  return (
    <>
      <Navbar user={user} />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Stats</h1>
              <p className="mt-1 text-sm text-slate-500">
                Elérés, visszatérés és figyelem alakulása a valós látogatási adatok alapján.
              </p>
            </div>
            <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
              <Link
                href="/stats?range=30d"
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  selectedRange === "30d"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                30 nap
              </Link>
              <Link
                href="/stats?range=90d"
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  selectedRange === "90d"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                90 nap
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Unique latogatok</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatInt(dashboard.overview.uniqueVisitors)}</p>
            <p className="mt-1 text-xs text-slate-500">elozo periodushoz: {formatPercent(dashboard.overview.uniqueVisitorsDelta)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Sessionok</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatInt(dashboard.overview.sessions)}</p>
            <p className="mt-1 text-xs text-slate-500">elozo periodushoz: {formatPercent(dashboard.overview.sessionsDelta)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Page view</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatInt(dashboard.overview.pageViews)}</p>
            <p className="mt-1 text-xs text-slate-500">elozo periodushoz: {formatPercent(dashboard.overview.pageViewsDelta)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Returning rate</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatDecimal(dashboard.overview.returningRate)}%</p>
            <p className="mt-1 text-xs text-slate-500">returning latogato: {formatInt(dashboard.overview.returningVisitors)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Atlag aktiv ido / session</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatDecimal(dashboard.overview.avgActiveMinutesPerSession)} perc</p>
            <p className="mt-1 text-xs text-slate-500">ossz aktiv ido: {formatDurationHours(dashboard.overview.totalActiveHours)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Engaged / Bounce</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {formatDecimal(dashboard.overview.engagedSessionRate)}% / {formatDecimal(dashboard.overview.bounceRate)}%
            </p>
            <p className="mt-1 text-xs text-slate-500">engaged {">="} 30 mp aktiv idovel</p>
          </article>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Napi trend (page view)</h2>
          <div className="mt-4 space-y-2">
            {dashboard.timeseries.map((row) => {
              const width = Math.max(2, Math.round((row.pageViews / maxPageViews) * 100));
              return (
                <div key={row.day} className="grid grid-cols-[88px_1fr_auto] items-center gap-3">
                  <span className="text-xs text-slate-500">{row.day.slice(5)}</span>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-slate-700"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-700">{formatInt(row.pageViews)}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">Top oldalak</h2>
            <div className="mt-3 space-y-2 text-sm">
              {dashboard.topPaths.length === 0 ? (
                <p className="text-slate-500">Meg nincs eleg adat.</p>
              ) : (
                dashboard.topPaths.map((row) => (
                  <div key={row.path} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2">
                    <span className="break-all text-slate-700">{row.path}</span>
                    <span className="font-medium text-slate-900">{formatInt(row.pageViews)}</span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">Top szekcio tipusok</h2>
            <div className="mt-3 space-y-2 text-sm">
              {dashboard.topRoutes.length === 0 ? (
                <p className="text-slate-500">Meg nincs eleg adat.</p>
              ) : (
                dashboard.topRoutes.map((row) => (
                  <div key={row.routeType} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                    <span className="text-slate-700">{row.routeType}</span>
                    <span className="font-medium text-slate-900">{formatInt(row.pageViews)}</span>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Top ismert latogatok (&quot;kik&quot;)</h2>
          <div className="mt-3 space-y-2 text-sm">
            {dashboard.topKnownVisitors.length === 0 ? (
              <p className="text-slate-500">Meg nincs bejelentkezett latogatoi minta ebben az idoszakban.</p>
            ) : (
              dashboard.topKnownVisitors.map((row) => (
                <div key={row.user.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                  <Link
                    href={buildProfilePath({ id: row.user.id, slug: row.user.slug, name: row.user.name })}
                    className="text-slate-700 hover:text-slate-900"
                  >
                    {row.user.name}
                  </Link>
                  <span className="text-slate-500">
                    {formatInt(row.sessions)} session • {formatDurationHours(row.activeHours)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}
