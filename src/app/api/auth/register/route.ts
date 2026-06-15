import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken, sessionCookieOptions } from "@/lib/auth";
import { generateUniqueUserSlug } from "@/lib/user-slugs";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return Response.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const slug = await generateUniqueUserSlug(name);
    const user = await prisma.user.create({
      data: { name, slug, email, passwordHash },
    });

    const token = await signToken({ userId: user.id, email: user.email });
    const opts = sessionCookieOptions();

    const response = Response.json({
      user: { id: user.id, name: user.name, email: user.email },
    });
    response.headers.append(
      "Set-Cookie",
      `${opts.name}=${token}; HttpOnly; Path=${opts.path}; Max-Age=${opts.maxAge}; SameSite=${opts.sameSite}${opts.secure ? "; Secure" : ""}`
    );
    return response;
  } catch {
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}
