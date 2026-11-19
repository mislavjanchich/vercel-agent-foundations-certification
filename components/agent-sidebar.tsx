"use client";

import { X } from "lucide-react";
import { AgentChat } from "@/components/agent-chat";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

export function AgentSidebar() {
  const { setOpen, setOpenMobile } = useSidebar();

  const closePanel = () => {
    setOpen(false);
    setOpenMobile(false);
    // AgentPanelSync reflects the state back into the ?chat=open URL param.
  };

  return (
    <Sidebar side="right" collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="text-sm font-semibold">Ship It Shop Agent</div>
          <button
            type="button"
            onClick={closePanel}
            aria-label="Close agent panel"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </SidebarHeader>
      <SidebarContent className="overflow-hidden p-0">
        <AgentChat />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
