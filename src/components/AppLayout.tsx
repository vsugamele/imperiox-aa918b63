import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { PushOptIn } from "@/components/PushOptIn";
import { CopilotFab } from "@/components/copilot/CopilotFab";
import { ActionInbox } from "@/components/imperius/ActionInbox";

const SIDEBAR_LS_KEY = "imphq:sidebar:open";

export function AppLayout() {
  // Persist sidebar open state in localStorage so it survives reloads
  // (Shadcn's cookie-based persistence is unreliable in iframe/preview contexts).
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(SIDEBAR_LS_KEY);
    return v === null ? true : v === "true";
  });

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_LS_KEY, String(open)); } catch {}
  }, [open]);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border px-4 shrink-0 bg-background/80 backdrop-blur-sm sticky top-0 z-10 gap-3">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <GlobalSearch />
            <div className="ml-auto flex items-center gap-1">
              <ActionInbox />
              <PushOptIn />
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
        <CopilotFab />
      </div>
    </SidebarProvider>
  );
}
