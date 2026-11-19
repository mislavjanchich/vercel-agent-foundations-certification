"use client"

import { Bot } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"

export function AgentButton() {
  const { open, openMobile, isMobile, toggleSidebar } = useSidebar()
  const isOpen = isMobile ? openMobile : open

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label="Toggle agent panel"
      aria-expanded={isOpen}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Bot className="h-4 w-4" />
      <span className="hidden sm:inline">Ask AI</span>
    </button>
  )
}
