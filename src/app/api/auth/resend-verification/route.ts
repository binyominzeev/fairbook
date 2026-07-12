import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, sendVerificationEmail } from "@/lib/auth-email";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return Response.json({ error: "Email is required." }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user && !user.emailVerifiedAt) {
      await sendVerificationEmail(user.id, user.email, user.name);
    }

    return Response.json({
      success: true,
      message: "If the account exists and is not yet verified, a verification email was sent.",
    });
  } catch {
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}
