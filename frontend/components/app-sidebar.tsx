"use client";

import Link from "next/link";
import { BotIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar className="glass-sidebar group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row items-center justify-center">
            <Link
              className="flex flex-row items-center gap-3"
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
            >
              <div className="glass-card flex h-10 w-10 items-center justify-center rounded-lg">
                <BotIcon className="h-5 w-5 text-primary" />
              </div>
              <span className="cursor-pointer glass-button rounded-md px-2 font-medium text-lg hover:bg-accent text-foreground">
                Iris
              </span>
            </Link>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="glass-card text-center p-6 rounded-xl">
            <div className="text-sm text-foreground">AI Assistant</div>
            <div className="text-xs mt-1 text-muted-foreground">Ready to help</div>
          </div>
        </div>
      </SidebarContent>
      <SidebarFooter>
        <div className="p-2 text-xs text-muted-foreground text-center">
          <div className="glass-card flex items-center justify-center gap-2 p-2 rounded-lg">
            <span className="text-green-600 dark:text-green-400">●</span>
            <span className="text-foreground">Online</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}