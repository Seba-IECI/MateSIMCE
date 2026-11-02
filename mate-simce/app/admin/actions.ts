"use server";

import { revalidatePath } from "next/cache";

import { setExercisePublication } from "@/lib/admin/catalog";

export type PublicationState = { success: boolean; message: string | null };

export async function changePublication(_previous: PublicationState, formData: FormData): Promise<PublicationState> {
  const id = formData.get("exerciseId");
  const published = formData.get("published");
  if (typeof id !== "string" || (published !== "true" && published !== "false")) {
    return { success: false, message: "La solicitud no es válida." };
  }
  const result = await setExercisePublication(id, published === "true");
  if (result.status === "ok") {
    revalidatePath("/admin");
    return { success: true, message: "Estado de publicación actualizado." };
  }
  return { success: false, message:
    result.status === "unauthenticated" ? "Tu sesión expiró. Vuelve a iniciar sesión."
    : result.status === "forbidden" ? "No tienes autorización para administrar ejercicios."
    : result.status === "not_found" ? "El ejercicio no está disponible."
    : result.status === "invalid" ? "La solicitud no es válida."
    : "No pudimos cambiar la publicación. Inténtalo nuevamente." };
}
