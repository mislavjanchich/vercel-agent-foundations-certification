"use client";

import { Bot } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { AGENT_ASK_DRAFT_KEY } from "@/components/agent-chat-shell";

/**
 * "Ask about this product" button on product detail pages.
 *
 * Opens the agent panel (same panel as the header button / floating
 * launcher) and immediately sends a question about the product to the
 * agent. The message is carried to the chat shell via sessionStorage (cold
 * path — panel was closed) and a live `agent:ask` event (warm path — shell
 * already mounted). If the agent is already busy, the question is staged
 * as a draft instead of being dropped.
 */
export function AskAboutProduct({
  productName,
  productId,
}: {
  productName: string;
  productId: string;
}) {
  const { setOpen, setOpenMobile } = useSidebar();

  const handleClick = () => {
    setOpen(true);
    setOpenMobile(true);
    const message = `Can you tell me about product ${productId} (${productName})? Materials, fit/sizing, and current stock.`;
    sessionStorage.setItem(
      AGENT_ASK_DRAFT_KEY,
      JSON.stringify({ text: message, autoSend: true }),
    );
    // Live path for when the chat shell is already mounted.
    window.dispatchEvent(
      new CustomEvent("agent:ask", {
        detail: { message, autoSend: true },
      }),
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mt-6 inline-flex items-center justify-center gap-2 self-start rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
    >
      <Bot className="h-4 w-4" />
      Ask about this product
    </button>
  );
}
