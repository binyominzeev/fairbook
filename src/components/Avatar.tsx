interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  sizeClassName?: string;
  textClassName?: string;
  className?: string;
}

export default function Avatar({
  name,
  avatarUrl,
  sizeClassName = "h-9 w-9",
  textClassName = "text-sm font-semibold",
  className = "",
}: AvatarProps) {
  const initial = name[0]?.toUpperCase() ?? "?";

  return (
    <div
      className={`${sizeClassName} ${textClassName} ${className} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-slate-600`}
      aria-hidden="true"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}