"use client";

import { AgentChatShell } from "@/components/agent-chat-shell";
import { AgentToolPart } from "@/components/agent-tool-parts";
import type { ShoppingUIMessage } from "@/lib/agent";
import { Bot } from "lucide-react";

const SUGGESTIONS = [
  "What do you sell?",
  "Show me some hoodies",
  "Gift ideas under $30",
  "I need to return an order",
];

/** Customer-facing shopping assistant chat (opens from the header robot). */
export function AgentChat() {
  return (
    <AgentChatShell<ShoppingUIMessage>
      api="/api/chat"
      streamPath={(runId) => `/api/chat/${encodeURIComponent(runId)}/stream`}
      runStorageKey="active-workflow-run-id"
      suggestions={SUGGESTIONS}
      emptyTitle="Ship It Shop Agent"
      emptyDescription="Ask about products, get recommendations, or file a return."
      emptyIcon={<Bot className="size-10 text-muted-foreground" />}
      inputPlaceholder="Ask about products, returns, anything…"
      inputAriaLabel="Message the Ship It Shop agent"
      renderPart={(part, index) => <AgentToolPart key={index} part={part} />}
    />
  );
}
