import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!isAdminEmail(session.email)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  return Response.json(
    { error: "Re-run is no longer supported. Preview moderation, then accept or reject the appeal." },
    { status: 410 }
  );
}