"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, MessageSquareIcon, HistoryIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AccountButton } from "@/components/account-button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface ChatTab {
  id: string;
  title: string;
  isActive: boolean;
}

interface BottomNavigationProps {
  tabs: ChatTab[];
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  onHistoryClick: () => void;
}

export function BottomNavigation({ 
  tabs, 
  onTabClick, 
  onTabClose, 
  onNewTab, 
  onHistoryClick 
}: BottomNavigationProps) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between px-4 py-3 backdrop-blur-sm bg-background/30">
      {/* Left: Avatar */}
      <div className="flex-shrink-0">
        <AccountButton />
      </div>

      {/* Center: Scrollable Chat Tabs */}
      <div className="flex-1 mx-4 overflow-hidden">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <motion.div
              key={tab.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors min-w-0 max-w-48 flex-shrink-0 rounded-lg border",
                tab.isActive
                  ? "bg-primary/10 text-primary border-primary/40"
                  : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground border-border"
              )}
              title={tab.title}
              onClick={() => {
                onTabClick(tab.id);
                router.push(`/chat/${tab.id}`);
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <MessageSquareIcon className={cn("h-4 w-4 flex-shrink-0",
                tab.isActive ? "text-primary" : "text-muted-foreground"
              )} />
              <span className="truncate">{tab.title}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </motion.div>
          ))}
          
          {/* New Tab Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onNewTab}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Right: History Button */}
      <div className="flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
          onClick={onHistoryClick}
        >
          <HistoryIcon className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
