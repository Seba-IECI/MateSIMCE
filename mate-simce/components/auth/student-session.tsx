"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { createClient } from "@/lib/supabase/client";

export function StudentSession({ userId, children }: { userId: string; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const leave = () => {
      if (rootRef.current) rootRef.current.style.visibility = "hidden";
      window.location.replace("/login");
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== userId)) leave();
    });

    // Do not restore a protected DOM snapshot from the back/forward cache.
    const hide = () => {
      if (rootRef.current) rootRef.current.style.visibility = "hidden";
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    const checkIdentity = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user || user.id !== userId) leave();
      } catch {
        leave();
      }
    };

    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", restore);
    window.addEventListener("focus", checkIdentity);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("focus", checkIdentity);
    };
  }, [userId]);

  return <div ref={rootRef}>{children}</div>;
}
