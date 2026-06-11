export async function POST() {
  const response = Response.json({ success: true });
  response.headers.append(
    "Set-Cookie",
    "fairbook_token=; HttpOnly; Path=/; Max-Age=0; SameSite=lax"
  );
  return response;
}
