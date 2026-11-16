import { createModelCallToUIChunkTransform } from "@ai-sdk/workflow";
import { createUIMessageStreamResponse } from "ai";
import { getRun } from "workflow/api";
import { ADMIN_COOKIE_NAME, ADMIN_PASSWORD } from "@/lib/admin-auth";

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
  const cookie = request.headers.get("cookie") ?? "";
  const hasAdminCookie = cookie
    .split(";")
    .map((pair) => pair.trim())
    .some((pair) => pair === `${ADMIN_COOKIE_NAME}=${ADMIN_PASSWORD}`);
  if (!hasAdminCookie) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let startIndex = 0;
  try {
    const { searchParams } = new URL(request.url);
    const startIndexParam = searchParams.get("startIndex");
    startIndex = startIndexParam === null ? 0 : Number(startIndexParam);
    if (!Number.isSafeInteger(startIndex) || startIndex < 0) {
      return Response.json(
        { error: "startIndex must be a non-negative safe integer" },
        { status: 400 },
      );
    }
  } catch {
    return Response.json({ error: "Invalid request URL" }, { status: 400 });
  }

  let run;
  try {
    run = getRun(id);
  } catch (error) {
    console.error("[api/admin/chat/[id]/stream]", error);
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  const source = run.getReadable({ startIndex: 0 });
  const tailIndex = await source.getTailIndex();
  const readable = source.pipeThrough(
    createModelCallToUIChunkTransform({ uiStartIndex: startIndex }),
  );

  return createUIMessageStreamResponse({
    stream: readable,
    headers: {
      "x-workflow-run-id": id,
      "x-workflow-stream-tail-index": String(tailIndex),
    },
  });
}
