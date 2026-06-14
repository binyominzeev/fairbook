import Image from "next/image";
import Link from "next/link";

interface BrandLinkProps {
  href: string;
  size?: "sm" | "md";
  subtitle?: string;
}

const sizeClasses = {
  sm: {
    frame: "h-10 w-10 rounded-2xl",
    title: "text-lg",
    subtitle: "text-[11px]",
    image: 40,
  },
  md: {
    frame: "h-14 w-14 rounded-[1.35rem]",
    title: "text-2xl",
    subtitle: "text-xs",
    image: 56,
  },
} as const;

export default function BrandLink({
  href,
  size = "sm",
  subtitle,
}: BrandLinkProps) {
  const config = sizeClasses[size];

  return (
    <Link href={href} className="group inline-flex items-center gap-3">
      <span
        className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-white/70 bg-white/80 shadow-[0_10px_30px_rgba(15,23,42,0.10)] ring-1 ring-slate-200/80 backdrop-blur-sm ${config.frame}`}
      >
        <Image
          src="/apple-touch-icon.png"
          alt="Fairbook logo"
          width={config.image}
          height={config.image}
          className="h-full w-full object-cover"
          priority={size === "md"}
        />
      </span>
      <span className="min-w-0">
        <span className={`block font-semibold tracking-tight text-slate-950 ${config.title}`}>
          fairbook
        </span>
        {subtitle && (
          <span
            className={`mt-0.5 block font-medium uppercase tracking-[0.24em] text-slate-500 ${config.subtitle}`}
          >
            {subtitle}
          </span>
        )}
      </span>
    </Link>
  );
}