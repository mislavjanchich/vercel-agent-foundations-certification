import type { ModelCallStreamPart } from "@ai-sdk/workflow";
import { convertToModelMessages, isStepCount, type UIMessage } from "ai";
import { getWritable } from "workflow";
import { createShoppingWorkflowAgent } from "@/lib/agent";

/**
 * Durable chat workflow for the shopping agent.
 *
 * The whole conversation — model calls, tool execution, message history —
 * runs inside this `"use workflow"` orchestrator. Every model call is a
 * durable step, and every tool whose `execute` is marked `"use step"`
 * (`lib/tools.ts`) is retried and cached independently, so an interrupted
 * run resumes where it left off instead of starting over.
 *
 * The route handler starts this with `start(chatFlow, [messages])`; the
 * agent writes its output to the run's writable stream (`getWritable()`),
 * which the client consumes via WorkflowChatTransport. A client that
 * reconnects after a refresh re-attaches to the same run through
 * `/api/chat/[id]/stream`.
 */
export async function chatFlow(messages: UIMessage[]) {
  "use workflow";

  const modelMessages = await convertToModelMessages(messages);
  const agent = createShoppingWorkflowAgent();

  await agent.stream({
    messages: modelMessages,
    writable: getWritable<ModelCallStreamPart>(),
    stopWhen: isStepCount(10),
  });
}
