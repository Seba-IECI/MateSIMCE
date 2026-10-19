import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getStudentAccess } from "@/lib/auth/student";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Acceso de estudiantes | MateSIMCE" };
export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const access = await getStudentAccess(await createClient());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status === "forbidden") redirect("/login?motivo=sin-acceso");
  if (access.status === "unavailable") redirect("/login?motivo=servicio-no-disponible");
  if (access.status !== "authorized") redirect("/login");

  redirect("/");
}
