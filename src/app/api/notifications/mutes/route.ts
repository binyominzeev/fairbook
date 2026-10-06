import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const rows = await prisma.userNotificationMute.findMany({
    where: { userId: session.userId },
    select: { mutedUserId: true },
  });

  return Response.json({ mutedUserIds: rows.map((row) => row.mutedUserId) });
}
