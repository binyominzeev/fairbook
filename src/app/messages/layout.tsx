import Navbar from "@/components/Navbar";
import MessagesShell from "@/components/MessagesShell";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, slug: true, name: true, avatarUrl: true },
  });
  if (!user) redirect("/login");

  return (
    <>
      <Navbar user={user} />
      <MessagesShell currentUserId={user.id}>{children}</MessagesShell>
    </>
  );
}
