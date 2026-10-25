import { getExercise } from "@/lib/exercises/queries";
import { contentResponse } from "@/lib/exercises/http";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return contentResponse(await getExercise(id));
}
