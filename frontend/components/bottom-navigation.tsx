"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, MessageSquareIcon, HistoryIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AccountButton } from "@/components/account-button";
import { cn } from "@/lib/utils";

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
  return (
    <div className="glass-header flex items-center justify-between px-4 py-3">
      {/* Left: Avatar */}
      <div className="flex-shrink-0">
        <AccountButton />
      </div>

      {/* Center: Scrollable Chat Tabs */}
      <div className="flex-1 mx-4 overflow-hidden">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <motion.div
              key={tab.id}
              className={cn(
                "glass-button flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-all duration-200 min-w-0 max-w-48 flex-shrink-0",
                tab.isActive
                  ? "bg-white/10 text-white ring-white/20"
                  : "hover:bg-white/5 text-white/70 hover:text-white"
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
                className="glass-button h-4 w-4 hover:bg-destructive/20 hover:text-destructive flex-shrink-0"
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
            className="glass-button h-8 w-8 hover:bg-white/10 hover:text-white flex-shrink-0 text-white/70"
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
          className="glass-button h-10 w-10 rounded-full hover:bg-white/10 hover:text-white text-white/70"
          onClick={onHistoryClick}
        >
          <HistoryIcon className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
