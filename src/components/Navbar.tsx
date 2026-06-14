"use client";

import BrandLink from "@/components/BrandLink";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";

interface User {
  id: string;
  name: string;
}

interface Props {
  user: User;
}

export default function Navbar({ user }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const logout = async () => {
    // Clear cookie by setting max-age=0
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const navLinks = [
    { href: "/feed", label: "Feed" },
    { href: "/connections", label: "People" },
    { href: "/pages", label: "Pages" },
    { href: "/communities", label: "Communities" },
    { href: `/profile/${user.id}`, label: "Profile" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl flex-col items-start gap-3 px-3 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-0">
        <BrandLink href="/feed" size="sm" subtitle="Discourse" />
        <nav className="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:justify-end">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                pathname.startsWith(link.href)
                  ? "bg-slate-100 text-slate-900 font-medium"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={logout}
            className="px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors sm:ml-2"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
