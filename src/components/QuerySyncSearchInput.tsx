"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function QuerySyncSearchInput({
  name = "q",
  initialValue = "",
  debounceMs = 300,
  placeholder,
  className,
}: {
  name?: string;
  initialValue?: string;
  debounceMs?: number;
  placeholder: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);

  const currentSearchString = useMemo(() => searchParams.toString(), [searchParams]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextValue = value.trim();
      const params = new URLSearchParams(currentSearchString);

      if (nextValue) {
        params.set(name, nextValue);
      } else {
        params.delete(name);
      }

      const nextQuery = params.toString();
      const nextHref = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      const currentHref = currentSearchString ? `${pathname}?${currentSearchString}` : pathname;

      if (nextHref !== currentHref) {
        router.replace(nextHref);
      }
    }, debounceMs);

    return () => window.clearTimeout(timeoutId);
  }, [currentSearchString, debounceMs, name, pathname, router, value]);

  return (
    <input
      type="search"
      name={name}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}
