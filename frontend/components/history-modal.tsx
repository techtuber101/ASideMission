"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  SearchIcon, 
  MessageSquareIcon, 
  CalendarIcon,
  ClockIcon,
  FilterIcon,
  HistoryIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChatHistoryItem {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  date: string;
}

interface Chat {
  id: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
  }>;
  createdAt: number;
  updatedAt: number;
  isLocal?: boolean;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
  chats?: Chat[];
}

export function HistoryModal({ isOpen, onClose, onSelectChat, chats = [] }: HistoryModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");

  // Convert chats to history items
  const chatHistory: ChatHistoryItem[] = chats
    .filter(chat => chat.messages.length > 0) // Only show chats with messages
    .map(chat => {
      const firstUserMessage = chat.messages.find(msg => msg.role === 'user');
      const preview = firstUserMessage?.content || 'No messages yet';
      const lastMessage = chat.messages[chat.messages.length - 1];
      const lastUpdate = new Date(chat.updatedAt);
      const now = new Date();
      const diffInHours = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
      
      let date: string;
      if (diffInHours < 24) {
        date = "Today";
      } else if (diffInHours < 48) {
        date = "Yesterday";
      } else if (diffInHours < 168) { // 7 days
        date = `${Math.floor(diffInHours / 24)} days ago`;
      } else {
        date = lastUpdate.toLocaleDateString();
      }

      return {
        id: chat.id,
        title: chat.title,
        preview: preview.length > 100 ? preview.substring(0, 100) + '...' : preview,
        timestamp: lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date
      };
    })
    .sort((a, b) => {
      // Sort by most recent first
      const chatA = chats.find(c => c.id === a.id);
      const chatB = chats.find(c => c.id === b.id);
      return (chatB?.updatedAt || 0) - (chatA?.updatedAt || 0);
    });

  const filteredHistory = chatHistory.filter(chat => 
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleChatSelect = (chatId: string) => {
    onSelectChat(chatId);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="absolute inset-4 mx-auto max-w-4xl h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-full glass-alt-surface rounded-3xl overflow-hidden">
              {/* Header */}
              <div className="glass-alt-header flex items-center justify-between p-6">
                <div className="flex items-center gap-3">
                  <div className="glass-alt-chip flex h-12 w-12 items-center justify-center rounded-full">
                    <HistoryIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Chat History</h2>
                    <p className="text-sm text-muted-foreground">Browse and search your conversations</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="glass-alt-chip h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive"
                  onClick={onClose}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Search and Filters */}
              <div className="glass-alt-header p-6">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search conversations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 glass-alt-chip focus:border-primary/50"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="glass-alt-chip hover:bg-primary/10"
                  >
                    <FilterIcon className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </div>
              </div>

              {/* Chat List */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-3">
                  {filteredHistory.map((chat, index) => (
                    <motion.div
                      key={chat.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group cursor-pointer glass-alt-item rounded-xl p-4 hover:border-primary/20 transition-all duration-200"
                      onClick={() => handleChatSelect(chat.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="glass-alt-chip flex h-10 w-10 items-center justify-center rounded-lg group-hover:bg-primary/10 transition-colors">
                          <MessageSquareIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-medium text-sm truncate">{chat.title}</h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <ClockIcon className="h-3 w-3" />
                              <span>{chat.timestamp}</span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {chat.preview}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CalendarIcon className="h-3 w-3" />
                            <span>{chat.date}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {filteredHistory.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
                      <SearchIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No conversations found</h3>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your search terms or filters
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-white/10 bg-muted/20">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{filteredHistory.length} conversation{filteredHistory.length !== 1 ? 's' : ''} found</span>
                  <span>Press Esc to close</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
