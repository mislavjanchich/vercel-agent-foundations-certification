"use client";

import { Bot } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * Floating launcher for the AI shopping assistant.
 *
 * A persistent, always-visible entry point (bottom-right) that opens the
 * same right-hand agent panel as the header's agent button. Hidden while
 * the panel is open, so it never sits on top of the drawer.
 */
export function AgentLauncher() {
  const { open, openMobile, isMobile, toggleSidebar } = useSidebar();
  const isOpen = isMobile ? openMobile : open;

  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label="Open AI shopping assistant"
      className="group fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Bot className="h-5 w-5" />
      <span>Ask AI</span>
    </button>
  );
}
