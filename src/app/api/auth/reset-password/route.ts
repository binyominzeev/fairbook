import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { resetPasswordWithToken } from "@/lib/auth-email";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return Response.json(
        { error: "Token and new password are required." },
        { status: 400 }
      );
    }

    if (String(password).length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await resetPasswordWithToken(String(token), passwordHash);

    if (!result.ok) {
      return Response.json(
        { error: "The password reset link is invalid or has expired." },
        { status: 400 }
      );
    }

    return Response.json({ success: true, message: "Password updated successfully." });
  } catch {
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}
