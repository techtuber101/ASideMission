"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SendIcon, UserIcon, MessageSquareIcon, MonitorIcon, ShareIcon, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ElegantChatInput } from "@/components/elegant-chat-input";
import { BottomNavigation } from "@/components/bottom-navigation";
import { HistoryModal } from "@/components/history-modal";
import { ComputerView } from "@/components/computer-view";
import { IrisLogo } from "@/components/iris-logo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatTab {
  id: string;
  title: string;
  isActive: boolean;
}

export function IrisChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("1");
  const [showComputerView, setShowComputerView] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [tabs, setTabs] = useState<ChatTab[]>([
    { id: "1", title: "Welcome to Iris", isActive: true },
    { id: "2", title: "Getting Started", isActive: false },
  ]);

  // Keyboard shortcut for computer view toggle
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only trigger if Tab is pressed and no modifier keys
      if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        // Check if we're not in an input field
        const target = event.target as HTMLElement;
        const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';
        
        if (!isInputField) {
          event.preventDefault();
          setShowComputerView(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    // Create assistant message outside try block for error handling
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
    };

    try {
      // Connect to WebSocket for real-time streaming
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const wsUrl = apiUrl.replace('http', 'ws');
      const ws = new WebSocket(`${wsUrl}/ws/chat/${activeTab}`);

      // Add empty assistant message that we'll update
      setMessages(prev => [...prev, assistantMessage]);

      ws.onopen = () => {
        // Send the user message
        ws.send(JSON.stringify({ content: currentInput }));
        
        // Set a timeout to handle cases where no response is received
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        }, 10000); // 10 second timeout
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'text') {
            // Update the assistant message with streaming text
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, content: msg.content + data.content }
                : msg
            ));
            // Stop loading when we get the first text response
            setIsLoading(false);
          } else if (data.type === 'tool_call') {
            // Add tool execution indicator
            const toolMessage: Message = {
              id: `tool_${Date.now()}`,
              role: "assistant",
              content: `🔧 Executing ${data.name}...`,
            };
            setMessages(prev => [...prev, toolMessage]);
          } else if (data.type === 'tool_result') {
            // Update tool result
            setMessages(prev => prev.map(msg => 
              msg.content.includes(`🔧 Executing ${data.name}`)
                ? { ...msg, content: `✅ ${data.name} completed` }
                : msg
            ));
          } else if (data.type === 'error') {
            // Handle errors
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, content: `❌ Error: ${data.content}` }
                : msg
            ));
            setIsLoading(false);
          } else if (data.type === 'ack') {
            // Just acknowledgment, don't do anything
            return;
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        setIsLoading(false);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Remove the empty assistant message and show error
        setMessages(prev => prev.filter(msg => msg.id !== assistantMessage.id));
        
        // Add error message
        const errorMessage: Message = {
          id: `error_${Date.now()}`,
          role: "assistant",
          content: `❌ Connection error. Please try again.`,
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
      };

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      // Remove the empty assistant message
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessage.id));
      
      // Add error message
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: "assistant",
        content: `❌ Failed to connect. Please try again.`,
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTabClick = (tabId: string) => {
    setTabs(prev => prev.map(tab => ({
      ...tab,
      isActive: tab.id === tabId
    })));
    setActiveTab(tabId);
    setMessages([]); // Clear messages when switching tabs
  };

  const handleTabClose = (tabId: string) => {
    if (tabs.length <= 1) return; // Don't close the last tab
    
    setTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);
      if (tabId === activeTab) {
        // If closing active tab, switch to first remaining tab
        const firstTab = newTabs[0];
        if (firstTab) {
          setActiveTab(firstTab.id);
          firstTab.isActive = true;
        }
      }
      return newTabs;
    });
  };

  const handleNewTab = () => {
    const newTabId = Date.now().toString();
    const newTab: ChatTab = {
      id: newTabId,
      title: `Chat ${tabs.length + 1}`,
      isActive: true
    };
    
    setTabs(prev => prev.map(tab => ({ ...tab, isActive: false })).concat(newTab));
    setActiveTab(newTabId);
    setMessages([]);
  };

  const handleHistorySelect = (chatId: string) => {
    // Handle chat selection from history
    console.log("Selected chat:", chatId);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="glass-header">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center min-w-0 flex-1">
            <IrisLogo width={40} height={40} className="h-10 w-auto max-w-none" />
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="glass-button h-8 w-8 p-0 text-white/70 hover:text-white"
                    onClick={() => {/* TODO: Implement share functionality */}}
                  >
                    <ShareIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="glass-card text-white border-white/20 bg-black/80 backdrop-blur-sm">
                  <p>Share conversation</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="glass-button h-8 w-8 p-0 text-white/70 hover:text-white"
                    onClick={() => {/* TODO: Implement view files functionality */}}
                  >
                    <FileIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="glass-card text-white border-white/20 bg-black/80 backdrop-blur-sm">
                  <p>View files</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showComputerView ? "default" : "ghost"}
                    size="sm"
                    className="glass-button h-8 w-8 p-0 text-white/70 hover:text-white"
                    onClick={() => setShowComputerView(!showComputerView)}
                  >
                    <MonitorIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="glass-card text-white border-white/20 bg-black/80 backdrop-blur-sm">
                  <p>Computer view</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="glass-card flex items-center gap-2 rounded-full px-3 py-1 text-xs">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-green-400">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area */}
        <div className={`flex-1 overflow-y-auto ${showComputerView ? 'border-r' : ''}`}>
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-md mx-auto px-6"
              >
                <div className="mb-8 flex justify-center">
                  <div className="glass-card flex h-20 w-20 items-center justify-center rounded-full">
                    <MessageSquareIcon className="h-10 w-10 text-white/70" />
                  </div>
                </div>
                <div className="glass-card p-8">
                  <h2 className="mb-3 text-2xl font-medium text-white">Hello, I'm Iris</h2>
                  <p className="text-white/70 leading-relaxed">
                    I'm your AI assistant. I can help you with various tasks, answer questions, 
                    and provide assistance. What would you like to know?
                  </p>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl px-6 py-8">
              <div className="space-y-8">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col gap-2 ${message.role === "user" ? "items-end" : "items-start"}`}
                  >
                    {message.role === "assistant" && (
                      <div className="flex items-center">
                        <IrisLogo width={24} height={24} className="h-6 w-auto max-w-none" />
                      </div>
                    )}
                    <div
                      className={`glass-message max-w-[80%] px-6 py-4 ${
                        message.role === "user"
                          ? "bg-white/10 text-white ring-white/15"
                          : "bg-white/5 text-white ring-white/10"
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{message.content}</p>
                    </div>
                    {message.role === "user" && (
                      <div className="glass-card flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                        <UserIcon className="h-5 w-5 text-white" />
                      </div>
                    )}
                  </motion.div>
                ))}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-2 items-start"
                  >
                    <div className="flex items-center">
                      <IrisLogo width={24} height={24} className="h-6 w-auto max-w-none" />
                    </div>
                    <div className="glass-message px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="h-2 w-2 rounded-full bg-white/70 animate-bounce"></div>
                          <div className="h-2 w-2 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                          <div className="h-2 w-2 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                        </div>
                        <span className="text-sm text-white/70">Thinking...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Computer View */}
        <ComputerView
          isOpen={showComputerView}
          onClose={() => setShowComputerView(false)}
          agentName="Iris"
        />
      </div>

      {/* Elegant Chat Input */}
      <div className={`${showComputerView ? 'mr-96' : ''}`}>
        <ElegantChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
        />
      </div>

      {/* Bottom Navigation */}
      <div className={`${showComputerView ? 'mr-96' : ''}`}>
        <BottomNavigation
          tabs={tabs}
          onTabClick={handleTabClick}
          onTabClose={handleTabClose}
          onNewTab={handleNewTab}
          onHistoryClick={() => setShowHistoryModal(true)}
        />
      </div>

      {/* Modals */}
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        onSelectChat={handleHistorySelect}
      />
    </div>
  );
}
