import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_REASONS = new Set([
  "csam",
  "child-exploitation",
  "grooming",
  "minor-sexualization",
  "other",
]);

export async function POST(req: Request) {
  const session = await getSession();
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }

  const payload = body as {
    reason?: unknown;
    details?: unknown;
    postId?: unknown;
    targetUrl?: unknown;
  };

  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  const details = typeof payload.details === "string" ? payload.details.trim() : "";
  const postId = typeof payload.postId === "string" ? payload.postId.trim() : "";
  const targetUrl =
    typeof payload.targetUrl === "string" ? payload.targetUrl.trim().slice(0, 1000) : "";

  if (!ALLOWED_REASONS.has(reason)) {
    return Response.json({ error: "Invalid reason." }, { status: 400 });
  }

  if (details.length < 10 || details.length > 4000) {
    return Response.json(
      { error: "Please provide 10-4000 characters in details." },
      { status: 400 }
    );
  }

  let safePostId: string | null = null;
  if (postId) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (post) {
      safePostId = post.id;
    }
  }

  const report = await prisma.childSafetyReport.create({
    data: {
      reporterId: session?.userId ?? null,
      postId: safePostId,
      targetUrl: targetUrl || null,
      reason,
      details,
      status: "open",
    },
    select: { id: true, createdAt: true },
  });

  return Response.json({
    ok: true,
    reportId: report.id,
    createdAt: report.createdAt.toISOString(),
  });
}
