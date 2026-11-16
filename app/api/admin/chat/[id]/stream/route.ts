import {
  hasAdminCookie,
  parseStartIndex,
  resumeRunStreamResponse,
} from "@/lib/chat-routes";

/**
 * GET /api/admin/chat/[id]/stream
 *
 * Admin-only re-attach to a running admin chat workflow — same mechanics as
 * the shopping agent's resume route, but behind the same cookie check as the
 * POST route (the `proxy.ts` matcher only covers `/admin/:path*`, not API
 * routes).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasAdminCookie(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = parseStartIndex(request.url);
  if (!parsed.ok) return parsed.response;

  return resumeRunStreamResponse(id, parsed.startIndex);
}
