import { listExercises } from "@/lib/exercises/queries";
import { contentResponse } from "@/lib/exercises/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const page = params.get("page") ?? "1";
  if (params.getAll("temaId").length !== 1 || params.getAll("page").length > 1
    || !/^[1-9][0-9]*$/.test(page)) {
    return contentResponse({ status: "invalid" });
  }
  return contentResponse(await listExercises(params.get("temaId") ?? "", Number(page)));
}
