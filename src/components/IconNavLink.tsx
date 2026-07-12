import type { LucideIcon } from "lucide-react";
import Link from "next/link";

interface IconNavLinkProps {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: number;
  className?: string;
}

export default function IconNavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
  className = "",
}: IconNavLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`group relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400/40 ${
        active
          ? "border-slate-300 bg-slate-100 text-slate-900"
          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
      } ${className}`}
    >
      <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
      <span className="sr-only">{label}</span>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        {label}
      </span>
      {typeof badge === "number" && badge > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}