import Link from "next/link";
import { verifyEmailWithToken } from "@/lib/auth-email";

export default async function VerifyEmailPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await props.searchParams;

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Invalid verification link</h1>
          <p className="mt-2 text-sm text-slate-600">
            This verification link is missing a token.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  const result = await verifyEmailWithToken(token);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {result.ok ? (
          <>
            <h1 className="text-xl font-semibold text-slate-900">Email verified</h1>
            <p className="mt-2 text-sm text-slate-600">
              Your account is now active. You can sign in.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Continue to login
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-slate-900">Verification link expired</h1>
            <p className="mt-2 text-sm text-slate-600">
              This link is invalid or has expired. Request a new verification email from the login page.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Go to login
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
