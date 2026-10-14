import { NextResponse, type NextRequest } from "next/server";

import { clearSessionCookies, createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Native POST navigation discards browser state; require same-origin logout.
  // NextURL normalizes loopback IPs to localhost; use the received Host instead.
  const host = request.headers.get("host");
  const expectedOrigin = host ? new URL(`${request.nextUrl.protocol}//${host}`).origin : null;
  if (!expectedOrigin || request.headers.get("origin") !== expectedOrigin) {
    return new NextResponse("Solicitud no permitida.", {
      status: 403,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  let remoteSignOutFailed = false;
  try {
    const supabase = await createClient({ writableCookies: true });
    const { error } = await supabase.auth.signOut({ scope: "local" });
    remoteSignOutFailed = Boolean(error);
  } catch {
    remoteSignOutFailed = true;
  } finally {
    // Remove this project's cookies even if remote revocation is unavailable.
    await clearSessionCookies();
  }

  const destination = new URL("/login", expectedOrigin);
  destination.searchParams.set("motivo", remoteSignOutFailed ? "salida-local" : "sesion-cerrada");
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  return response;
}
