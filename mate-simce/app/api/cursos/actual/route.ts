import { getCurrentCourse } from "@/lib/exercises/queries";
import { contentResponse } from "@/lib/exercises/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return contentResponse(await getCurrentCourse());
}
