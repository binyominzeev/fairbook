import Navbar from "@/components/Navbar";
import TextCardCreator from "@/components/TextCardCreator";
import { isAdminEmail } from "@/lib/admin";
import { getTextCardPresetVisibility } from "@/lib/app-config";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function TextCardsPage(props: {
  searchParams: Promise<{ text?: string; communityId?: string; returnTo?: string }>;
}) {
  const { text, communityId, returnTo } = await props.searchParams;
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
        <TextCardCreator
          initialText={typeof text === "string" ? text.slice(0, 4000) : ""}
          communityId={typeof communityId === "string" && communityId.trim() ? communityId : null}
          returnToPath={
            typeof returnTo === "string" && returnTo.startsWith("/") ? returnTo : null
          }
          isAdmin={admin}
          initialHiddenFontIds={presetVisibility.hiddenFontIds}
        />
      </main>
    </>
  );
}
