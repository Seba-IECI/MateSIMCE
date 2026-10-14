"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  return (
    <form action="/auth/logout" method="post" onSubmit={() => setPending(true)}>
      <Button type="submit" variant="outline" disabled={pending}
        className="h-10 rounded-xl border-[#d9e2dc] text-[#245a54]">
        <LogOut aria-hidden="true" />{pending ? "Cerrando sesión…" : "Cerrar sesión"}
      </Button>
    </form>
  );
}
