import { createModelCallToUIChunkTransform } from "@ai-sdk/workflow";
import { createUIMessageStreamResponse } from "ai";
import { getRun } from "workflow/api";

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
    console.error("[api/chat/[id]/stream]", error);
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
