"use client";

import { useActionState } from "react";

import { changePublication } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function PublicationForm({ exerciseId, title, published }: { exerciseId: string; title: string; published: boolean }) {
  const [state, action, pending] = useActionState(changePublication, { success: false, message: null });
  return (
    <form action={action} aria-busy={pending}>
      <input type="hidden" name="exerciseId" value={exerciseId} />
      <input type="hidden" name="published" value={String(!published)} />
      <Button type="submit" variant="outline" disabled={pending}
        aria-label={`${published ? "Despublicar" : "Publicar"} ${title}`}
        className="min-w-28 border-[var(--ms-border)] text-[var(--ms-primary-hover)]">
        {pending ? "Guardando…" : published ? "Despublicar" : "Publicar"}
      </Button>
      <p role={state.success ? "status" : "alert"} aria-live="polite"
        className={`mt-2 max-w-xs text-xs ${state.success ? "text-[var(--ms-primary-hover)]" : "text-[#8c3f34]"}`}>
        {state.message}
      </p>
    </form>
  );
}
