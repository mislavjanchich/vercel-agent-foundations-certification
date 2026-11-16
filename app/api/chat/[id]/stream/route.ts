import { parseStartIndex, resumeRunStreamResponse } from "@/lib/chat-routes";

/**
 * GET /api/chat/[id]/stream
 *
 * Re-attaches to a chat workflow run by id and replays its durable stream
 * from where the client left off. Used by `WorkflowChatTransport` after a
 * connection drop or page refresh, so an interrupted agent response continues
 * instead of starting over (no duplicate output, no duplicate work).
 *
 * `startIndex` is the UI chunk cursor the client already consumed. The
 * workflow stores raw `ModelCallStreamPart` chunks, so we replay from
 * index 0 and let the transform skip `uiStartIndex` UI chunks.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = parseStartIndex(request.url);
  if (!parsed.ok) return parsed.response;

  return resumeRunStreamResponse(id, parsed.startIndex);
}
