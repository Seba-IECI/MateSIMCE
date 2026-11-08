import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getLoginAccess } from "@/lib/auth/student";
import { createClient } from "@/lib/supabase/server";
import { RecoveryForm } from "@/components/auth/recovery-form";
import { updatePassword } from "@/app/login/recovery-actions";

export const metadata: Metadata = { title: "Restablecer contraseña | MateSIMCE", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const access = await getLoginAccess(await createClient());
  return <main className="matesimce-view flex min-h-screen items-center justify-center px-6 py-10">
    <section className="ms-card w-full max-w-md p-8" aria-labelledby="reset-title">
      <div className="mb-6 flex items-center gap-3"><Image src="/icon.svg" width={40} height={40} alt="" /><span className="text-xl font-semibold">MateSIMCE</span></div>
      <h1 id="reset-title" className="text-2xl font-semibold">Restablecer contraseña</h1>
      {access.status === "authorized" ? <>
        <p className="mt-3 text-sm leading-6 text-[var(--ms-muted)]">Elige una contraseña de al menos 8 caracteres. El servicio comprobará también su política de seguridad.</p>
        <RecoveryForm reset action={updatePassword.bind(null, access.user.id)} />
      </> : <div className="mt-5 space-y-4 text-sm leading-6">
        <p role="alert">El enlace o la sesión no están disponibles. El enlace puede haber expirado o ya haberse utilizado.</p>
        <Link href="/login?modo=recuperar" className="text-[var(--ms-primary)] underline">Solicitar un nuevo enlace</Link>
      </div>}
    </section>
  </main>;
}
