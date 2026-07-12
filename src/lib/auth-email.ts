import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";

export const AUTH_EMAIL_TOKEN_VERIFY = "verify_email";
export const AUTH_EMAIL_TOKEN_RESET = "reset_password";

const VERIFY_TTL_MINUTES = Number(process.env.EMAIL_VERIFY_TOKEN_TTL_MINUTES || "1440");
const RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || "30");

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getBaseUrl(): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return process.env.NODE_ENV === "production" ? "https://fairbook.hu" : "http://localhost:3000";
}

function buildAbsoluteUrl(path: string): string {
  return `${getBaseUrl()}${path}`;
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

async function createEmailToken(userId: string, type: string, ttlMinutes: number): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await prisma.$transaction([
    prisma.authEmailToken.deleteMany({ where: { userId, type, usedAt: null } }),
    prisma.authEmailToken.create({
      data: {
        userId,
        type,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  return rawToken;
}

export async function sendVerificationEmail(userId: string, email: string, name: string): Promise<void> {
  const token = await createEmailToken(userId, AUTH_EMAIL_TOKEN_VERIFY, VERIFY_TTL_MINUTES);
  const verifyUrl = buildAbsoluteUrl(`/verify-email?token=${encodeURIComponent(token)}`);

  await sendEmail({
    to: email,
    subject: "Fairbook email verification",
    text: [
      `Hi ${name},`,
      "",
      "Please verify your email address to activate your Fairbook account:",
      verifyUrl,
      "",
      `This link expires in ${VERIFY_TTL_MINUTES} minutes.`,
      "If you did not create this account, you can ignore this email.",
    ].join("\n"),
  });
}

export async function sendPasswordResetEmail(userId: string, email: string, name: string): Promise<void> {
  const token = await createEmailToken(userId, AUTH_EMAIL_TOKEN_RESET, RESET_TTL_MINUTES);
  const resetUrl = buildAbsoluteUrl(`/reset-password?token=${encodeURIComponent(token)}`);

  await sendEmail({
    to: email,
    subject: "Fairbook password reset",
    text: [
      `Hi ${name},`,
      "",
      "You requested a password reset for your Fairbook account.",
      "Use the link below to set a new password:",
      resetUrl,
      "",
      `This link expires in ${RESET_TTL_MINUTES} minutes.`,
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
  });
}

export async function consumeToken(type: string, rawToken: string) {
  const tokenHash = hashToken(rawToken);

  const token = await prisma.authEmailToken.findFirst({
    where: {
      type,
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          emailVerifiedAt: true,
        },
      },
    },
  });

  if (!token) {
    return null;
  }

  return token;
}

export async function verifyEmailWithToken(rawToken: string): Promise<{ ok: boolean; reason?: string }> {
  const token = await consumeToken(AUTH_EMAIL_TOKEN_VERIFY, rawToken);
  if (!token) {
    return { ok: false, reason: "invalid_or_expired" };
  }

  await prisma.$transaction([
    prisma.authEmailToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: token.userId },
      data: { emailVerifiedAt: token.user.emailVerifiedAt ?? new Date() },
    }),
  ]);

  return { ok: true };
}

export async function resetPasswordWithToken(rawToken: string, passwordHash: string): Promise<{ ok: boolean; reason?: string }> {
  const token = await consumeToken(AUTH_EMAIL_TOKEN_RESET, rawToken);
  if (!token) {
    return { ok: false, reason: "invalid_or_expired" };
  }

  await prisma.$transaction([
    prisma.authEmailToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
    prisma.authEmailToken.updateMany({
      where: {
        userId: token.userId,
        type: AUTH_EMAIL_TOKEN_RESET,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: token.userId },
      data: { passwordHash },
    }),
  ]);

  return { ok: true };
}
