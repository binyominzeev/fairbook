import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type TrafficRange = "30d" | "90d";

type DailySessionsRow = {
  day: string;
  sessions: bigint | number;
  uniqueVisitors: bigint | number;
  activeMs: bigint | number | null;
};

type DailyPageViewsRow = {
  day: string;
  pageViews: bigint | number;
};

type TopPathRow = {
  path: string;
  pageViews: bigint | number;
};

type TopRouteRow = {
  routeType: string;
  pageViews: bigint | number;
};

type ReturningRow = {
  returningCount: bigint | number;
};

type UniqueVisitorsRow = {
  uniqueVisitors: bigint | number;
};

function asNumber(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") return Number(value);
  return Number(value ?? 0);
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function rangeDays(range: TrafficRange) {
  return range === "90d" ? 90 : 30;
}

function pctChange(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

function buildDayKeys(start: Date, days: number) {
  const keys: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const day = addDays(start, i);
    keys.push(day.toISOString().slice(0, 10));
  }
  return keys;
}

async function loadOverview(start: Date, end: Date) {
  const [
    uniqueVisitors,
    sessionCount,
    pageViews,
    totals,
    bounceCount,
    engagedCount,
    returningRows,
  ] = await Promise.all([
    prisma.$queryRaw<UniqueVisitorsRow[]>(Prisma.sql`
      SELECT COUNT(DISTINCT "visitorKeyHash") as uniqueVisitors
      FROM "TrafficSession"
      WHERE "startedAt" >= ${start} AND "startedAt" < ${end}
    `),
    prisma.trafficSession.count({
      where: { startedAt: { gte: start, lt: end } },
    }),
    prisma.trafficEvent.count({
      where: {
        createdAt: { gte: start, lt: end },
        eventType: "page_view",
      },
    }),
    prisma.trafficSession.aggregate({
      where: { startedAt: { gte: start, lt: end } },
      _sum: { activeMsTotal: true },
      _avg: { activeMsTotal: true },
    }),
    prisma.trafficSession.count({
      where: {
        startedAt: { gte: start, lt: end },
        pageViewCount: { lte: 1 },
        activeMsTotal: { lt: 10_000 },
      },
    }),
    prisma.trafficSession.count({
      where: {
        startedAt: { gte: start, lt: end },
        activeMsTotal: { gte: 30_000 },
      },
    }),
    prisma.$queryRaw<ReturningRow[]>(Prisma.sql`
      SELECT COUNT(*) as returningCount
      FROM (
        SELECT "visitorKeyHash"
        FROM "TrafficSession"
        WHERE "startedAt" >= ${start} AND "startedAt" < ${end}
        GROUP BY "visitorKeyHash"
        HAVING COUNT(*) > 1
      ) returning_visitors
    `),
  ]);

  return {
    uniqueVisitors: asNumber(uniqueVisitors[0]?.uniqueVisitors ?? 0),
    sessionCount,
    pageViews,
    activeMsTotal: asNumber(totals._sum.activeMsTotal),
    avgActiveMsPerSession: asNumber(totals._avg.activeMsTotal),
    bounceCount,
    engagedCount,
    returningVisitors: asNumber(returningRows[0]?.returningCount ?? 0),
  };
}

export async function getTrafficDashboard(range: TrafficRange) {
  const days = rangeDays(range);
  const today = startOfDay(new Date());
  const currentStart = addDays(today, -days + 1);
  const currentEnd = addDays(today, 1);
  const previousStart = addDays(currentStart, -days);
  const previousEnd = currentStart;

  const [current, previous, dailySessions, dailyPageViews, topPaths, topRoutes, topKnownVisitorsRaw] =
    await Promise.all([
      loadOverview(currentStart, currentEnd),
      loadOverview(previousStart, previousEnd),
      prisma.$queryRaw<DailySessionsRow[]>(Prisma.sql`
        SELECT
          DATE("startedAt") as day,
          COUNT(*) as sessions,
          COUNT(DISTINCT "visitorKeyHash") as uniqueVisitors,
          COALESCE(SUM("activeMsTotal"), 0) as activeMs
        FROM "TrafficSession"
        WHERE "startedAt" >= ${currentStart} AND "startedAt" < ${currentEnd}
        GROUP BY DATE("startedAt")
        ORDER BY day ASC
      `),
      prisma.$queryRaw<DailyPageViewsRow[]>(Prisma.sql`
        SELECT
          DATE("createdAt") as day,
          COUNT(*) as pageViews
        FROM "TrafficEvent"
        WHERE "createdAt" >= ${currentStart}
          AND "createdAt" < ${currentEnd}
          AND "eventType" = 'page_view'
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
      `),
      prisma.$queryRaw<TopPathRow[]>(Prisma.sql`
        SELECT
          "path" as path,
          COUNT(*) as pageViews
        FROM "TrafficEvent"
        WHERE "createdAt" >= ${currentStart}
          AND "createdAt" < ${currentEnd}
          AND "eventType" = 'page_view'
        GROUP BY "path"
        ORDER BY pageViews DESC
        LIMIT 10
      `),
      prisma.$queryRaw<TopRouteRow[]>(Prisma.sql`
        SELECT
          "routeType" as routeType,
          COUNT(*) as pageViews
        FROM "TrafficEvent"
        WHERE "createdAt" >= ${currentStart}
          AND "createdAt" < ${currentEnd}
          AND "eventType" = 'page_view'
        GROUP BY "routeType"
        ORDER BY pageViews DESC
        LIMIT 10
      `),
      prisma.trafficSession.groupBy({
        by: ["userId"],
        where: {
          startedAt: { gte: currentStart, lt: currentEnd },
          userId: { not: null },
        },
        _count: { _all: true },
        _sum: { activeMsTotal: true },
        _max: { lastSeenAt: true },
        orderBy: { _sum: { activeMsTotal: "desc" } },
        take: 10,
      }),
    ]);

  const dayKeys = buildDayKeys(currentStart, days);
  const sessionsByDay = new Map(
    dailySessions.map((row) => [row.day, {
      sessions: asNumber(row.sessions),
      uniqueVisitors: asNumber(row.uniqueVisitors),
      activeMs: asNumber(row.activeMs),
    }])
  );
  const pageViewsByDay = new Map(
    dailyPageViews.map((row) => [row.day, asNumber(row.pageViews)])
  );

  const timeseries = dayKeys.map((day) => {
    const session = sessionsByDay.get(day);
    const pageViews = pageViewsByDay.get(day) ?? 0;
    return {
      day,
      uniqueVisitors: session?.uniqueVisitors ?? 0,
      sessions: session?.sessions ?? 0,
      pageViews,
      activeHours: (session?.activeMs ?? 0) / 3_600_000,
    };
  });

  const knownUserIds = topKnownVisitorsRaw
    .map((row) => row.userId)
    .filter((value): value is string => typeof value === "string");

  const knownUsers = knownUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: knownUserIds } },
        select: { id: true, slug: true, name: true, avatarUrl: true },
      })
    : [];
  const knownUsersById = new Map(knownUsers.map((user) => [user.id, user]));

  const topKnownVisitors = topKnownVisitorsRaw
    .map((row) => {
      if (!row.userId) return null;
      const user = knownUsersById.get(row.userId);
      if (!user) return null;
      return {
        user,
        sessions: row._count._all,
        activeHours: asNumber(row._sum.activeMsTotal) / 3_600_000,
        lastSeenAt: row._max.lastSeenAt?.toISOString() ?? null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return {
    range,
    rangeDays: days,
    overview: {
      uniqueVisitors: current.uniqueVisitors,
      uniqueVisitorsDelta: pctChange(current.uniqueVisitors, previous.uniqueVisitors),
      sessions: current.sessionCount,
      sessionsDelta: pctChange(current.sessionCount, previous.sessionCount),
      pageViews: current.pageViews,
      pageViewsDelta: pctChange(current.pageViews, previous.pageViews),
      returningVisitors: current.returningVisitors,
      returningRate: current.uniqueVisitors > 0
        ? (current.returningVisitors / current.uniqueVisitors) * 100
        : 0,
      avgActiveMinutesPerSession: current.avgActiveMsPerSession / 60_000,
      totalActiveHours: current.activeMsTotal / 3_600_000,
      bounceRate:
        current.sessionCount > 0 ? (current.bounceCount / current.sessionCount) * 100 : 0,
      engagedSessionRate:
        current.sessionCount > 0 ? (current.engagedCount / current.sessionCount) * 100 : 0,
    },
    timeseries,
    topPaths: topPaths.map((row) => ({
      path: row.path,
      pageViews: asNumber(row.pageViews),
    })),
    topRoutes: topRoutes.map((row) => ({
      routeType: row.routeType,
      pageViews: asNumber(row.pageViews),
    })),
    topKnownVisitors,
  };
}
