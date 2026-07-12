import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateUniqueUserSlug } from "@/lib/user-slugs";
import { normalizeEmail, sendVerificationEmail } from "@/lib/auth-email";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return Response.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    if (String(password).length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      if (!existing.emailVerifiedAt) {
        await sendVerificationEmail(existing.id, existing.email, existing.name);
        return Response.json({
          success: true,
          message: "A verification email was sent. Please check your inbox.",
          needsVerification: true,
        });
      }

      return Response.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const slug = await generateUniqueUserSlug(name);
    const user = await prisma.user.create({
      data: { name, slug, email: normalizedEmail, passwordHash },
    });

    await sendVerificationEmail(user.id, user.email, user.name);

    return Response.json({
      success: true,
      message: "Registration successful. Please verify your email to sign in.",
      needsVerification: true,
    });
  } catch {
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}
