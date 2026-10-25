import "server-only";

import type { ContentResult } from "./types";

// One JSON contract for the four read-only routes. Never return provider errors.
export function contentResponse<T>(result: ContentResult<T>): Response {
  const codes = {
    unauthenticated: 401, forbidden: 403, unavailable: 503, invalid: 400,
    not_found: 404, course_unavailable: 503, course_ambiguous: 409, error: 503,
  };
  return Response.json(result, {
    status: result.status === "ok" ? 200 : codes[result.status],
    headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
  });
}
