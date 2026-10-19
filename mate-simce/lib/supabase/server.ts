import "server-only";

import { clearAuthCookiesAtScopes, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { authCookieOptions, getSupabaseConfig } from "@/lib/supabase/config";

export async function createClient({ writableCookies = false } = {}) {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseConfig();

  return createServerClient(url, key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        if (!writableCookies) return;
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

export async function clearSessionCookies() {
  const cookieStore = await cookies();
  const { url } = getSupabaseConfig();
  const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;

  await clearAuthCookiesAtScopes({
    storageKey,
    scopes: [authCookieOptions],
    getAll: () => cookieStore.getAll(),
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options);
      });
    },
  });
}
