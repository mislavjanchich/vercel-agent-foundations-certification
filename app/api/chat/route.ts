import { createModelCallToUIChunkTransform } from "@ai-sdk/workflow";
import {
  createUIMessageStreamResponse,
  safeValidateUIMessages,
} from "ai";
import type { ShoppingUIMessage } from "@/lib/agent";
import { chatFlow } from "@/lib/workflows/chat-flow";
import { start } from "workflow/api";

/**
 * POST /api/chat
 *
 * Validates the incoming UI message history, then starts the durable chat
 * workflow (`chatFlow`) and streams its output to the client. The run id is
 * returned in the `x-workflow-run-id` response header so the client
 * (`WorkflowChatTransport`) can re-attach to the same run later via
 * GET /api/chat/[id]/stream if the connection drops or the page refreshes.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await safeValidateUIMessages<ShoppingUIMessage>({
    messages: (body as { messages?: unknown } | null)?.messages,
  });
  if (!result.success) {
    return Response.json(
      { error: "Invalid chat messages", detail: String(result.error) },
      { status: 400 },
    );
  }
  if (result.data.length === 0) {
    return Response.json({ error: "No messages provided" }, { status: 400 });
  }

  try {
    const run = await start(chatFlow, [result.data]);

    const stream = run.readable.pipeThrough(
      createModelCallToUIChunkTransform(),
    );

    return createUIMessageStreamResponse({
      stream,
      headers: {
        "x-workflow-run-id": run.runId,
      },
    });
  } catch (error) {
    console.error("[api/chat]", error);
    const message =
      error instanceof Error
        ? error.message
        : "The agent failed to respond. Please try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}
