"use client";

import BrandLink from "@/components/BrandLink";
import IconNavLink from "@/components/IconNavLink";
import { isAdminEmail } from "@/lib/admin";
import { buildProfilePath } from "@/lib/profile-path";
import { BarChart3, Bell, FileText, Home, LayoutGrid, LogOut, UserRound, UserSearch } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { useAppLocale } from "@/components/AppLocaleProvider";

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
  const locale = useAppLocale();
  const [unreadCount, setUnreadCount] = useState(0);
  const [canViewStats, setCanViewStats] = useState(false);

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

    const loadAuthUser = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) return;
        const data = await response.json();
        setCanViewStats(isAdminEmail(data?.user?.email));
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
    void loadAuthUser();
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
    { href: "/feed", label: t(locale, "nav.feed"), icon: Home },
    { href: "/groups", label: t(locale, "nav.groups"), icon: LayoutGrid },
    { href: "/connections", label: t(locale, "nav.people"), icon: UserSearch },
    { href: "/pages", label: t(locale, "nav.pages"), icon: FileText },
    { href: "/notifications", label: t(locale, "nav.notifications"), icon: Bell },
    ...(canViewStats ? [{ href: "/stats", label: t(locale, "nav.stats"), icon: BarChart3 }] : []),
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
            label={t(locale, "nav.profile")}
            icon={UserRound}
            active={pathname.startsWith(profileHref)}
            className="ml-auto sm:ml-2"
          />
          <button
            onClick={logout}
            aria-label={t(locale, "nav.signOut")}
            title={t(locale, "nav.signOut")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
          >
            <LogOut aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
            <span className="sr-only">{t(locale, "nav.signOut")}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
