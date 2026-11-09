type AuthUser = { id?: string; email?: string; email_confirmed_at?: string };

export async function verifySupabaseLogin(email: string, password: string) {
  // Local installations and isolated tests continue using their local administrator.
  if (process.env.DATABASE_URL?.startsWith("file:")) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const allowed = (process.env.SUPABASE_PRUMO_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!url || !key || !allowed.length) return null;

  let response: Response;
  try {
    response = await fetch(new URL("/auth/v1/token?grant_type=password", url), {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw Error(
      "Não foi possível validar o acesso. Tente novamente em instantes.",
    );
  }
  if (
    response.status === 400 ||
    response.status === 401 ||
    response.status === 403
  )
    return null;
  if (!response.ok)
    throw Error(
      "Não foi possível validar o acesso. Tente novamente em instantes.",
    );
  const session: { user?: AuthUser; access_token?: string } =
    await response.json();
  const user = session.user;
  const authorized = !!(
    session.access_token &&
    user?.id &&
    allowed.includes(user.id) &&
    user.email?.toLowerCase() === email.toLowerCase() &&
    user.email_confirmed_at
  );
  // Prumo creates its own HttpOnly session. Do not keep an unused Supabase session.
  if (session.access_token) {
    try {
      await fetch(new URL("/auth/v1/logout?scope=local", url), {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      /* The provider token is never persisted or sent to the browser. */
    }
  }
  return authorized ? (user?.id ?? null) : null;
}
