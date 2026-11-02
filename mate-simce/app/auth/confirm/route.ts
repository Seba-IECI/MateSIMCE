import { NextResponse, type NextRequest } from "next/server";

import { getStudentAccess } from "@/lib/auth/student";
import { clearSessionCookies, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const tokenHash = params.get("token_hash");
  // Relative, fixed destinations preserve the current origin and discard all token/next parameters.
  const finish = (location: string) => new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
  if (!tokenHash || tokenHash.length > 2048 || params.get("type") !== "email") {
    return finish("/login?motivo=confirmacion-invalida");
  }

  try {
    const supabase = await createClient({ writableCookies: true });
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (error) return finish("/login?motivo=confirmacion-invalida");
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
