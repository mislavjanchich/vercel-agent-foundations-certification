import { createModelCallToUIChunkTransform } from "@ai-sdk/workflow";
import {
  createUIMessageStreamResponse,
  safeValidateUIMessages,
} from "ai";
import { getRun } from "workflow/api";
import { ADMIN_COOKIE_NAME, ADMIN_PASSWORD } from "@/lib/admin-auth";

/**
 * Shared request/response plumbing for the two chat API surfaces
 * (`/api/chat` shopping agent and `/api/admin/chat` admin agent).
 *
 * Both agents use the same pattern: validate the UI message history, start
 * the durable workflow run, stream `ModelCallStreamPart` chunks through
 * `createModelCallToUIChunkTransform` to UI chunks, and expose a resume
 * endpoint (`/api/chat/[id]/stream`, `/api/admin/chat/[id]/stream`) that
 * re-attaches to the run and replays from the client's cursor.
 */

export type ParseChatBodyResult =
  | { ok: true; messages: unknown[] }
  | { ok: false; response: Response };

/** JSON-parse + validate the UI message array shared by both POST routes. */
export async function parseChatBody(
  request: Request,
): Promise<ParseChatBodyResult> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }

  const result = await safeValidateUIMessages({
    messages: (body as { messages?: unknown } | null)?.messages,
  });
  if (!result.success) {
    return {
      ok: false,
      response: Response.json(
        { error: "Invalid chat messages", detail: String(result.error) },
        { status: 400 },
      ),
    };
  }
  if (result.data.length === 0) {
    return {
      ok: false,
      response: Response.json({ error: "No messages provided" }, { status: 400 }),
    };
  }

  return { ok: true, messages: result.data };
}

/**
 * Admin gate for the `/api/admin/chat*` routes. `proxy.ts` only guards
 * `/admin/:path*` pages, so these route handlers authenticate themselves:
 * the `admin_auth` cookie must equal the server-side password constant.
 */
export function hasAdminCookie(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((pair) => pair.trim())
    .some((pair) => pair === `${ADMIN_COOKIE_NAME}=${ADMIN_PASSWORD}`);
}

export type ParseStartIndexResult =
  | { ok: true; startIndex: number }
  | { ok: false; response: Response };

/** Read + validate the `startIndex` resume cursor shared by both GET routes. */
export function parseStartIndex(requestUrl: string): ParseStartIndexResult {
  try {
    const { searchParams } = new URL(requestUrl);
    const startIndexParam = searchParams.get("startIndex");
    const startIndex = startIndexParam === null ? 0 : Number(startIndexParam);
    if (!Number.isSafeInteger(startIndex) || startIndex < 0) {
      return {
        ok: false,
        response: Response.json(
          { error: "startIndex must be a non-negative safe integer" },
          { status: 400 },
        ),
      };
    }
    return { ok: true, startIndex };
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Invalid request URL" }, { status: 400 }),
    };
  }
}

/** Wrap a freshly started run's readable stream into a UI message stream. */
export function startRunStreamResponse(run: {
  readable: ReadableStream;
  runId: string;
}): Response {
  return createUIMessageStreamResponse({
    stream: run.readable.pipeThrough(createModelCallToUIChunkTransform()),
    headers: {
      "x-workflow-run-id": run.runId,
    },
  });
}

/**
 * Re-attach to a run by id and replay its durable stream from the client's
 * cursor. Returns a 404 response if the run id is unknown.
 */
export async function resumeRunStreamResponse(runId: string, startIndex: number) {
  let run;
  try {
    run = getRun(runId);
  } catch (error) {
    console.error("[chat-stream]", runId, error);
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  const source = run.getReadable({ startIndex: 0 });
  const tailIndex = await source.getTailIndex();

  return createUIMessageStreamResponse({
    stream: source.pipeThrough(
      createModelCallToUIChunkTransform({ uiStartIndex: startIndex }),
    ),
    headers: {
      "x-workflow-run-id": runId,
      "x-workflow-stream-tail-index": String(tailIndex),
    },
  });
}
