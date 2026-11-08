import { NextResponse, type NextRequest } from "next/server";

import { getLoginAccess, getStudentAccess } from "@/lib/auth/student";
import { clearSessionCookies, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const tokenHash = params.get("token_hash");
  const code = params.get("code");
  const type = params.get("type");
  const recovery = type === "recovery" || (code !== null && type === null);
  const invalid = recovery ? "/login?modo=recuperar&motivo=recuperacion-invalida" : "/login?motivo=confirmacion-invalida";
  // Relative, fixed destinations preserve the current origin and discard all token/next parameters.
  const finish = (location: string) => new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
  if (code !== null ? (!recovery || !code || code.length > 2048 || tokenHash !== null)
    : (!tokenHash || tokenHash.length > 2048 || (type !== "email" && type !== "recovery"))) {
    return finish(invalid);
  }

  try {
    const supabase = await createClient({ writableCookies: true });
    // El correo predeterminado devuelve un código PKCE; la plantilla propia envía token_hash.
    // Ambos formatos se validaron arriba. El SDK comprueba el verificador PKCE de las cookies.
    const { data, error } = code !== null
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type as "email" | "recovery" });
    if (error) return finish(invalid);
    if (recovery) {
      // El tipo de recuperación PKCE procede del verificador del SDK, no del parámetro type.
      const verifiedRecovery = code === null || ("redirectType" in data && data.redirectType === "recovery");
      if (verifiedRecovery && data?.session) {
        const access = await getLoginAccess(supabase);
        if (access.status === "authorized" && data.user?.id === access.user.id) return finish("/reset-password");
      }
      try { await supabase.auth.signOut({ scope: "local" }); } finally { await clearSessionCookies(); }
      return finish(invalid);
    }
    const access = await getStudentAccess(supabase);
    if (access.status === "authorized") return finish("/");
    try { await supabase.auth.signOut({ scope: "local" }); }
    finally { await clearSessionCookies(); }
    return finish("/login?motivo=perfil-no-disponible");
  } catch {
    try { await clearSessionCookies(); } catch { /* No sensitive provider details in redirects. */ }
    return finish("/login?motivo=servicio-no-disponible");
  }
}
