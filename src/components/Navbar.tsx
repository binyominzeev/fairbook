"use client";

import BrandLink from "@/components/BrandLink";
import IconNavLink from "@/components/IconNavLink";
import { isAdminEmail } from "@/lib/admin";
import { buildProfilePath } from "@/lib/profile-path";
import {
  BarChart3,
  Bell,
  FileText,
  Home,
  LayoutGrid,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  UserRound,
  UserSearch,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [canViewStats, setCanViewStats] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDetailsElement | null>(null);

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

    const loadUnreadMessagesCount = async () => {
      try {
        const response = await fetch("/api/conversations/unread-count");
        if (!response.ok) return;

        const data = await response.json();
        if (!cancelled) {
          setUnreadMessagesCount(Number(data.unreadCount ?? 0));
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

    const handleUnreadMessagesCountChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ unreadCount?: number }>;
      if (typeof customEvent.detail?.unreadCount === "number") {
        setUnreadMessagesCount(customEvent.detail.unreadCount);
      }
    };

    void loadUnreadCount();
    void loadUnreadMessagesCount();
    void loadAuthUser();
    window.addEventListener(
      "fairbook:notifications-unread-changed",
      handleUnreadCountChanged
    );
    window.addEventListener(
      "fairbook:messages-unread-changed",
      handleUnreadMessagesCountChanged
    );
    const messagesPollInterval = window.setInterval(loadUnreadMessagesCount, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(messagesPollInterval);
      window.removeEventListener(
        "fairbook:notifications-unread-changed",
        handleUnreadCountChanged
      );
      window.removeEventListener(
        "fairbook:messages-unread-changed",
        handleUnreadMessagesCountChanged
      );
    };
  }, [pathname]);

  useEffect(() => {
    if (!isMoreMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const menu = moreMenuRef.current;
      if (!menu) return;

      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menu.contains(target)) return;

      menu.removeAttribute("open");
      setIsMoreMenuOpen(false);
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      moreMenuRef.current?.removeAttribute("open");
      setIsMoreMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [isMoreMenuOpen]);

  const logout = async () => {
    // Clear cookie by setting max-age=0
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const navLinks = [
    { href: "/feed", label: t(locale, "nav.feed"), icon: Home, badge: undefined as number | undefined },
    { href: "/groups", label: t(locale, "nav.groups"), icon: LayoutGrid, badge: undefined as number | undefined },
    { href: "/messages", label: t(locale, "nav.messages"), icon: MessageCircle, badge: unreadMessagesCount },
    { href: "/notifications", label: t(locale, "nav.notifications"), icon: Bell, badge: unreadCount },
  ];
  const moreMenuLinks = [
    { href: "/connections", label: t(locale, "nav.people"), icon: UserSearch },
    { href: "/pages", label: t(locale, "nav.pages"), icon: FileText },
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
              badge={link.badge}
            />
          ))}
          <IconNavLink
            href={profileHref}
            label={t(locale, "nav.profile")}
            icon={UserRound}
            active={pathname.startsWith(profileHref)}
          />
          <details
            ref={moreMenuRef}
            className="relative ml-auto sm:ml-2"
            onToggle={(event) => {
              setIsMoreMenuOpen(event.currentTarget.open);
            }}
          >
            <summary
              aria-label={t(locale, "nav.more")}
              title={t(locale, "nav.more")}
              className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
            >
              <MoreHorizontal aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
              <span className="sr-only">{t(locale, "nav.more")}</span>
            </summary>
            <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
              {moreMenuLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <link.icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                  {link.label}
                </Link>
              ))}
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                {t(locale, "nav.signOut")}
              </button>
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
}

