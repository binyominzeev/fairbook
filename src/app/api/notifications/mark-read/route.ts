import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((value: unknown): value is string => typeof value === "string")
    : [];

  if (ids.length > 0) {
    await prisma.notification.updateMany({
      where: {
        recipientId: session.userId,
        id: { in: ids },
      },
      data: {
        isRead: true,
      },
    });
  } else {
    await prisma.notification.updateMany({
      where: {
        recipientId: session.userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  }

  const unreadCount = await prisma.notification.count({
    where: {
      recipientId: session.userId,
      isRead: false,
    },
  });

  return Response.json({ unreadCount });
}
