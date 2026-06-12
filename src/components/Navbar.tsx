"use client";

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
    { href: "/communities", label: "Communities" },
    { href: `/profile/${user.id}`, label: "Profile" },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/feed" className="font-bold text-slate-900 text-lg">
          fairbook
        </Link>
        <nav className="flex items-center gap-1">
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
            className="ml-2 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
