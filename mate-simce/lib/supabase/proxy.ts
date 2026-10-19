import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getStudentAccess } from "@/lib/auth/student";
import { authCookieOptions, getSupabaseConfig } from "@/lib/supabase/config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseConfig();

  const supabase = createServerClient(url, key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        const previousCookies = response.cookies.getAll();
        response = NextResponse.next({ request });
        previousCookies.forEach((cookie) => response.cookies.set(cookie));
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  try {
    await supabase.auth.getClaims();
  } catch {
  }

  if (request.nextUrl.pathname === "/") {
    const access = await getStudentAccess(supabase);
    if (access.status !== "authorized") {
      const destination = request.nextUrl.clone();
      destination.pathname = "/login";
      destination.search = "";
      if (access.status === "forbidden") destination.searchParams.set("motivo", "sin-acceso");
      if (access.status === "unavailable") destination.searchParams.set("motivo", "servicio-no-disponible");
      const redirect = NextResponse.redirect(destination);
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      response = redirect;
    }
  }

  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
