import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { sendVerificationEmail } from "@/lib/auth-email";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: Context) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!isAdminEmail(session.email)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;
  const userId = typeof id === "string" ? id.trim() : "";

  if (!userId) {
    return Response.json({ error: "Invalid user id." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      isPage: true,
      emailVerifiedAt: true,
    },
  });

  if (!user || user.isPage) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  if (user.emailVerifiedAt) {
    return Response.json({ error: "User is already verified." }, { status: 409 });
  }

  await sendVerificationEmail(user.id, user.email, user.name);

  return Response.json({
    success: true,
    message: "Verification email sent.",
  });
}
