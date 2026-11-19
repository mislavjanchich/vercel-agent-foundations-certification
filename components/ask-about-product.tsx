"use client";

import { Bot } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { AGENT_ASK_DRAFT_KEY } from "@/components/agent-chat-shell";

/**
 * "Ask about this product" button on product detail pages.
 *
 * Opens the agent panel (same panel as the header button / floating
 * launcher) and pre-fills the chat input with a draft question about the
 * product. The draft is stored in sessionStorage so it also reaches the
 * chat when the sidebar is closed (its content may be unmounted); the chat
 * shell consumes + clears it. Nothing is auto-sent — the user reviews and
 * hits send, so no surprise model calls.
 */
export function AskAboutProduct({ productName }: { productName: string }) {
  const { setOpen, setOpenMobile } = useSidebar();

  const handleClick = () => {
    setOpen(true);
    setOpenMobile(true);
    sessionStorage.setItem(
      AGENT_ASK_DRAFT_KEY,
      `Tell me about the ${productName} — materials, fit/sizing, and current stock.`,
    );
    // Live path for when the chat shell is already mounted.
    window.dispatchEvent(
      new CustomEvent("agent:ask", {
        detail: {
          message: `Tell me about the ${productName} — materials, fit/sizing, and current stock.`,
        },
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
