import { start } from "workflow/api";
import { parseChatBody, startRunStreamResponse } from "@/lib/chat-routes";
import type { ShoppingUIMessage } from "@/lib/agent";
import { chatFlow } from "@/lib/workflows/chat-flow";

/**
 * POST /api/chat
 *
 * Validates the incoming UI message history, then starts the durable chat
 * workflow (`chatFlow`) and streams its output to the client. The run id is
 * returned in the `x-workflow-run-id` response header so the client
 * (`WorkflowChatTransport`) can re-attach to the same run later via
 * GET /api/chat/[id]/stream if the connection drops or the page refreshes.
 */
export async function POST(request: Request) {
  const parsed = await parseChatBody(request);
  if (!parsed.ok) return parsed.response;

  try {
    const run = await start(chatFlow, [parsed.messages as ShoppingUIMessage[]]);
    return startRunStreamResponse({ readable: run.readable, runId: run.runId });
  } catch (error) {
    console.error("[api/chat]", error);
    const message =
      error instanceof Error
        ? error.message
        : "The agent failed to respond. Please try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}
