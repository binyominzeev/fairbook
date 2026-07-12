import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, sendPasswordResetEmail } from "@/lib/auth-email";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return Response.json({ error: "Email is required." }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user?.emailVerifiedAt) {
      await sendPasswordResetEmail(user.id, user.email, user.name);
    }

    return Response.json({
      success: true,
      message: "If an account with this email exists, password reset instructions were sent.",
    });
  } catch {
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}
