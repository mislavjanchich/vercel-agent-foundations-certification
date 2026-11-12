import { createAgentUIStreamResponse, safeValidateUIMessages } from "ai";
import { getShoppingAgent, type ShoppingUIMessage } from "@/lib/agent";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate the incoming message history before it reaches the agent.
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
    return await createAgentUIStreamResponse({
      agent: await getShoppingAgent(),
      uiMessages: result.data,
      onError: (error) => {
        // The message is streamed to the client, so surface something honest
        // but safe: provider/gateway errors carry user-actionable text.
        console.error("[api/chat] stream error:", error);
        return error instanceof Error
          ? error.message
          : "The agent failed to respond. Please try again.";
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
