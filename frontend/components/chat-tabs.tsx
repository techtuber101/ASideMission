"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, MessageSquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatTab {
  id: string;
  title: string;
  isActive: boolean;
}

interface ChatTabsProps {
  tabs: ChatTab[];
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
}

export function ChatTabs({ tabs, onTabClick, onTabClose, onNewTab }: ChatTabsProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 border-t">
      <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <motion.div
            key={tab.id}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-t-md text-sm cursor-pointer transition-all duration-200 min-w-0 max-w-48",
              tab.isActive
                ? "bg-background border-t border-l border-r text-foreground shadow-sm"
                : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onTabClick(tab.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <MessageSquareIcon className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{tab.title}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 hover:bg-destructive/20 hover:text-destructive flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </motion.div>
        ))}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
        onClick={onNewTab}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
