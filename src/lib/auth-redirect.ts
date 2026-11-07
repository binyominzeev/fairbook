export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") ||
      /[\\\u0000-\u001f\u007f]/.test(value)) {
    return null;
  }
  const parsed = new URL(value, "https://fairbook.invalid");
  return parsed.origin === "https://fairbook.invalid" && !parsed.pathname.startsWith("//")
    ? `${parsed.pathname}${parsed.search}${parsed.hash}`
    : null;
}

export function loginHref(returnTo?: string | null, register = false): string {
  const params = new URLSearchParams();
  if (register) params.set("mode", "register");
  const safePath = safeReturnTo(returnTo);
  if (safePath) params.set("returnTo", safePath);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}
