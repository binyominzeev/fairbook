"use client";

import BrandLink from "@/components/BrandLink";
import { buildProfilePath } from "@/lib/profile-path";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface User {
  id: string;
  slug?: string | null;
  name: string;
  avatarUrl?: string | null;
}

interface Props {
  user: User;
}

export default function Navbar({ user }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadUnreadCount = async () => {
      try {
        const response = await fetch("/api/notifications/unread-count");
        if (!response.ok) return;

        const data = await response.json();
        if (!cancelled) {
          setUnreadCount(Number(data.unreadCount ?? 0));
        }
      } catch {
        // Ignore transient fetch errors in navbar.
      }
    };

    const handleUnreadCountChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ unreadCount?: number }>;
      if (typeof customEvent.detail?.unreadCount === "number") {
        setUnreadCount(customEvent.detail.unreadCount);
      }
    };

    void loadUnreadCount();
    window.addEventListener(
      "fairbook:notifications-unread-changed",
      handleUnreadCountChanged
    );

    return () => {
      cancelled = true;
      window.removeEventListener(
        "fairbook:notifications-unread-changed",
        handleUnreadCountChanged
      );
    };
  }, [pathname]);

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
    { href: "/notifications", label: "Notifications" },
  ];
  const profileHref = buildProfilePath(user);

  return (
    <header className="z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm sm:sticky sm:top-0">
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
              {link.href === "/notifications" ? (
                <span className="inline-flex items-center gap-1.5">
                  {link.label}
                  {unreadCount > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>
              ) : (
                link.label
              )}
            </Link>
          ))}
          <Link
            href={profileHref}
            className={`ml-auto flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors sm:ml-2 ${pathname.startsWith(profileHref) ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
          >Profile
          </Link>
          <button
            onClick={logout}
            className="px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
