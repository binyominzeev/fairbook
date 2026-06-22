import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import DeleteProfileForm from "@/components/DeleteProfileForm";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildProfilePath } from "@/lib/profile-path";

export default async function RemoveProfilePage() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-16">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Profil törlése</h1>
          <p className="mt-2 text-sm text-slate-600">
            Profil törléséhez jelentkezz be a fiókodba.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Bejelentkezés
          </Link>
        </section>
      </main>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, slug: true, name: true, email: true, avatarUrl: true },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <DeleteProfileForm profilePath={buildProfilePath(user)} />
      </main>
    </>
  );
}