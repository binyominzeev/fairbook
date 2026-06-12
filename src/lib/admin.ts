const ADMIN_EMAIL = "szvbinjomin@gmail.com";

export function isAdminEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}

export { ADMIN_EMAIL };