import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken, sessionCookieOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return Response.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return Response.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

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
