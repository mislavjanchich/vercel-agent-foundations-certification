import { createModelCallToUIChunkTransform } from "@ai-sdk/workflow";
import {
  createUIMessageStreamResponse,
  safeValidateUIMessages,
} from "ai";
import { start } from "workflow/api";
import { ADMIN_COOKIE_NAME, ADMIN_PASSWORD } from "@/lib/admin-auth";
import type { AdminUIMessage } from "@/lib/admin-agent";
import { adminChatFlow } from "@/lib/workflows/admin-chat-flow";

/**
 * POST /api/admin/chat
 *
 * Admin-only. `proxy.ts` only guards `/admin/:path*` pages — this API route
 * must authenticate itself. The admin cookie is compared against the
 * server-side password constant (`lib/admin-auth.ts`); same rule as the
 * proxy, and the tool surface itself is admin-only so an unauthenticated
 * caller gets nothing here.
 *
 * Validates the UI message history, then starts the durable admin chat
 * workflow and streams its output. `x-workflow-run-id` lets the client
 * re-attach via GET /api/admin/chat/[id]/stream after a refresh.
 */
export async function POST(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  const hasAdminCookie = cookie
    .split(";")
    .map((pair) => pair.trim())
    .some((pair) => pair === `${ADMIN_COOKIE_NAME}=${ADMIN_PASSWORD}`);
  if (!hasAdminCookie) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await safeValidateUIMessages<AdminUIMessage>({
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
    const run = await start(adminChatFlow, [result.data]);

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
    console.error("[api/admin/chat]", error);
    const message =
      error instanceof Error
        ? error.message
        : "The admin agent failed to respond. Please try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}
