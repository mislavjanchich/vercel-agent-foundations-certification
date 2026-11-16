import { start } from "workflow/api";
import {
  hasAdminCookie,
  parseChatBody,
  startRunStreamResponse,
} from "@/lib/chat-routes";
import type { AdminUIMessage } from "@/lib/admin-agent";
import { adminChatFlow } from "@/lib/workflows/admin-chat-flow";

/**
 * POST /api/admin/chat
 *
 * Admin-only. `proxy.ts` only guards `/admin/:path*` pages — this API route
 * must authenticate itself (same cookie rule as the proxy, applied by
 * `hasAdminCookie` in `lib/chat-routes.ts`). The tool surface itself is
 * admin-only, so an unauthenticated caller gets nothing here.
 *
 * Validates the UI message history, then starts the durable admin chat
 * workflow and streams its output. `x-workflow-run-id` lets the client
 * re-attach via GET /api/admin/chat/[id]/stream after a refresh.
 */
export async function POST(request: Request) {
  if (!hasAdminCookie(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseChatBody(request);
  if (!parsed.ok) return parsed.response;

  try {
    const run = await start(adminChatFlow, [
      parsed.messages as AdminUIMessage[],
    ]);
    return startRunStreamResponse({ readable: run.readable, runId: run.runId });
  } catch (error) {
    console.error("[api/admin/chat]", error);
    const message =
      error instanceof Error
        ? error.message
        : "The admin agent failed to respond. Please try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}
