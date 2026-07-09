import Navbar from "@/components/Navbar";
import TextCardCreator from "@/components/TextCardCreator";
import { isAdminEmail } from "@/lib/admin";
import { getTextCardPresetVisibility } from "@/lib/app-config";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function TextCardsPage(props: {
  searchParams: Promise<{ text?: string }>;
}) {
  const { text } = await props.searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, slug: true, name: true, avatarUrl: true, email: true },
  });
  if (!user) redirect("/login");

  const admin = isAdminEmail(user.email);
  const presetVisibility = await getTextCardPresetVisibility();

  return (
    <>
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Text Card Creator</h1>
            <p className="mt-1 text-sm text-slate-600">
              Facebook-style simplicity with polished visual quality.
            </p>
          </div>
          <Link
            href="/feed"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
          >
            Back to feed
          </Link>
        </div>

        <TextCardCreator
          initialText={typeof text === "string" ? text.slice(0, 4000) : ""}
          isAdmin={admin}
          initialHiddenFontIds={presetVisibility.hiddenFontIds}
          initialHiddenBackgroundIds={presetVisibility.hiddenBackgroundIds}
        />
      </main>
    </>
  );
}
