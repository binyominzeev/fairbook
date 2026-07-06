"use client";

import BrandLink from "@/components/BrandLink";
import IconNavLink from "@/components/IconNavLink";
import { buildProfilePath } from "@/lib/profile-path";
import { Bell, FileText, Home, LogOut, UserRound, Users } from "lucide-react";
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
    { href: "/feed", label: "Feed", icon: Home },
    { href: "/connections", label: "People", icon: Users },
    { href: "/pages", label: "Pages", icon: FileText },
    { href: "/notifications", label: "Notifications", icon: Bell },
  ];
  const profileHref = buildProfilePath(user);

  return (
    <header className="z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm sm:sticky sm:top-0">
      <div className="mx-auto flex max-w-2xl flex-col items-start gap-3 px-3 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-0">
        <BrandLink href="/feed" size="sm" subtitle="Discourse" />
        <nav className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {navLinks.map((link) => (
            <IconNavLink
              key={link.href}
              href={link.href}
              label={link.label}
              icon={link.icon}
              active={pathname.startsWith(link.href)}
              badge={link.href === "/notifications" ? unreadCount : undefined}
            />
          ))}
          <IconNavLink
            href={profileHref}
            label="Profile"
            icon={UserRound}
            active={pathname.startsWith(profileHref)}
            className="ml-auto sm:ml-2"
          />
          <button
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
          >
            <LogOut aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
            <span className="sr-only">Sign out</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
