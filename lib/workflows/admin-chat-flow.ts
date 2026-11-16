import type { ModelCallStreamPart } from "@ai-sdk/workflow";
import { convertToModelMessages, isStepCount, type UIMessage } from "ai";
import { getWritable } from "workflow";
import { createAdminWorkflowAgent } from "@/lib/admin-agent";
import { readMemories } from "@/lib/sandbox";

/**
 * Durable chat workflow for the **store admin agent**.
 *
 * Mirrors the shopping chat flow (`lib/workflows/chat-flow.ts`): the whole
 * conversation runs in a `"use workflow"` orchestrator, every model call is
 * a durable step, and every tool whose `execute` is `"use step"`
 * (`lib/admin-tools.ts`) retries/caches independently.
 *
 * On start it loads the persistent sandbox memory (`memories.md`) and
 * injects it into the agent's instructions, so the agent's prior context
 * (preferences, business context, reusable scripts) is available from the
 * first turn. The agent must be recreated per run: the AI Gateway model
 * reference is only valid for the run (OIDC token rotation) and the
 * instructions include run-specific memory.
 */
export async function adminChatFlow(messages: UIMessage[]) {
  "use workflow";

  const modelMessages = await convertToModelMessages(messages);
  const memories = await readMemories();
  const agent = createAdminWorkflowAgent(memories);

  await agent.stream({
    messages: modelMessages,
    writable: getWritable<ModelCallStreamPart>(),
    stopWhen: isStepCount(10),
  });
}
