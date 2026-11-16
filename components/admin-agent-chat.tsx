"use client";

import { AgentChatShell } from "@/components/agent-chat-shell";
import { AdminToolPart } from "@/components/admin-tool-parts";
import type { AdminUIMessage } from "@/lib/admin-agent";
import { ShieldCheckIcon } from "lucide-react";

const SUGGESTIONS = [
  "Show me low-stock items",
  "What were yesterday's top sellers?",
  "Summarize this week's revenue",
  "How many open urgent support tickets do we have?",
];

/** Store admin chat, mounted inside the password-gated `/admin` page. */
export function AdminAgentChat() {
  return (
    <AgentChatShell<AdminUIMessage>
      api="/api/admin/chat"
      streamPath={(runId) => `/api/admin/chat/${encodeURIComponent(runId)}/stream`}
      runStorageKey="admin-active-workflow-run-id"
      suggestions={SUGGESTIONS}
      emptyTitle="Store Admin Agent"
      emptyDescription="Back-office help: returns, inventory, sales, support tickets, and sandboxed computation."
      emptyIcon={<ShieldCheckIcon className="size-10 text-muted-foreground" />}
      inputPlaceholder="Ask about returns, inventory, sales, support…"
      inputAriaLabel="Message the store admin agent"
      renderPart={(part, index) => <AdminToolPart key={index} part={part} />}
    />
  );
}
