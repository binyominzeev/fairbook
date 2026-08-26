import { getSession } from "@/lib/auth";
import { getEligibleContacts } from "@/lib/messaging-eligibility";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? undefined;

  const contacts = await getEligibleContacts(session.userId, query);
  return Response.json({ contacts });
}
