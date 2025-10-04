"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SendIcon, UserIcon, MessageSquareIcon, MonitorIcon, ShareIcon, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ElegantChatInput } from "@/components/elegant-chat-input";
import { BottomNavigation } from "@/components/bottom-navigation";
import { HistoryModal } from "@/components/history-modal";
import { ComputerView } from "@/components/computer-view";
import { IrisLogo } from "@/components/iris-logo";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  artifacts?: Array<{
    path: string;
    size: number;
  }>;
}

interface ToolCall {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'error';
  cached?: boolean;
}

interface Phase {
  name: string;
  status: 'start' | 'end';
}

export function IrisChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [showComputerView, setShowComputerView] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [activeToolCalls, setActiveToolCalls] = useState<Map<string, ToolCall>>(new Map());
  const [deliveredArtifacts, setDeliveredArtifacts] = useState<Array<{path: string; size: number}>>([]);
  
  // Tab management
  const [tabs, setTabs] = useState([{ id: "1", title: "New Chat", isActive: true }]);
  const [currentTabId, setCurrentTabId] = useState("1");

  const apiUrl = 'http://localhost:8000';
  const wsUrl = 'ws://localhost:8000';

  useEffect(() => {
    const threadId = currentTabId; // Use current tab as thread ID
    const websocket = new WebSocket(`${wsUrl}/ws/chat/${threadId}`);
    
    websocket.onopen = () => {
      console.log("WebSocket connected");
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "phase") {
          setCurrentPhase(data.phase);
          if (data.status === "end") {
            setTimeout(() => setCurrentPhase(null), 1000);
          }
        } else if (data.type === "tool_call") {
          const toolCall: ToolCall = {
            id: data.id,
            name: data.name,
            status: 'running',
            cached: data.cached || false
          };
          setActiveToolCalls(prev => new Map(prev).set(data.id, toolCall));
        } else if (data.type === "tool_result") {
          setActiveToolCalls(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(data.id);
            if (existing) {
              newMap.set(data.id, { ...existing, status: data.success ? 'completed' : 'error' });
            }
            return newMap;
          });
          
          // Remove completed tool calls after a delay
          setTimeout(() => {
            setActiveToolCalls(prev => {
              const newMap = new Map(prev);
              newMap.delete(data.id);
              return newMap;
            });
          }, 3000);
        } else if (data.type === "text") {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            
            if (lastMessage && lastMessage.role === "assistant") {
              lastMessage.content += data.content;
            } else {
              newMessages.push({
                id: Date.now().toString(),
                role: "assistant",
                content: data.content
              });
            }
            
            return newMessages;
          });
        } else if (data.type === "deliver") {
          setDeliveredArtifacts(data.artifacts || []);
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            
            if (lastMessage && lastMessage.role === "assistant") {
              lastMessage.artifacts = data.artifacts || [];
            }
            
            return newMessages;
          });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    websocket.onclose = () => {
      console.log("WebSocket disconnected");
      setWs(null);
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      // Don't show error to user for WebSocket issues, just log it
    };

    return () => {
      websocket.close();
    };
  }, [currentTabId]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Generate title for first message (non-blocking)
    if (messages.length === 0) {
      generateTitle(userMessage.content).catch(() => {
        // Ignore title generation errors
      });
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "message",
        content: userMessage.content,
        conversation_history: messages
      }));
    }

    // Simulate loading completion
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  };

  const generateTitle = async (firstMessage: string) => {
    try {
      const response = await fetch(`${apiUrl}/chat/title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: firstMessage }),
      });

      if (!response.ok) {
        console.warn('Title generation failed, using default title');
        return; // Just return without throwing error
      }

      const data = await response.json();
      const newTitle = data.title || "New Chat";
      
      setTabs(prev => prev.map(tab => 
        tab.id === currentTabId 
          ? { ...tab, title: newTitle }
          : tab
      ));
    } catch (error) {
      console.warn('Title generation failed:', error);
      // Don't throw error, just use default title
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTabClick = (tabId: string) => {
    setCurrentTabId(tabId);
    setTabs(prev => prev.map(tab => ({ ...tab, isActive: tab.id === tabId })));
  };

  const handleTabClose = (tabId: string) => {
    if (tabs.length === 1) return; // Don't close the last tab
    
    setTabs(prev => prev.filter(tab => tab.id !== tabId));
    
    if (tabId === currentTabId) {
      const remainingTabs = tabs.filter(tab => tab.id !== tabId);
      const newActiveTab = remainingTabs[remainingTabs.length - 1];
      setCurrentTabId(newActiveTab.id);
    }
  };

  const handleNewTab = () => {
    const newTabId = (Date.now() + Math.random()).toString();
    const newTab = { id: newTabId, title: "New Chat", isActive: true };
    
    setTabs(prev => prev.map(tab => ({ ...tab, isActive: false })));
    setTabs(prev => [...prev, newTab]);
    setCurrentTabId(newTabId);
    setMessages([]);
    setCurrentPhase(null);
    setActiveToolCalls(new Map());
    setDeliveredArtifacts([]);
  };

  const handleHistorySelect = (chatId: string) => {
    // TODO: Load chat history
    setShowHistoryModal(false);
  };

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header - Full Width */}
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
                  <p>Toggle computer view</p>
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
        {/* Chat Messages Container */}
        <div className={`flex flex-col transition-all duration-300 ${showComputerView ? 'w-[60%]' : 'w-full'}`}>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
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
                {/* Phase Indicator */}
                {currentPhase && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4"
                  >
                    <div className="glass-card flex items-center gap-3 px-4 py-2">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                      </div>
                      <span className="text-sm text-white/80 capitalize">
                        {currentPhase} Phase
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Active Tool Calls */}
                {activeToolCalls.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4"
                  >
                    <div className="glass-card p-4">
                      <div className="flex flex-wrap gap-2">
                        {Array.from(activeToolCalls.values()).map((toolCall) => (
                          <div key={toolCall.id} className="glass-card flex items-center gap-2 px-3 py-1 text-sm">
                            <div className={`h-2 w-2 rounded-full ${
                              toolCall.status === 'running' ? 'bg-yellow-500 animate-pulse' :
                              toolCall.status === 'completed' ? 'bg-green-500' :
                              'bg-red-500'
                            }`}></div>
                            <span className="text-white/80">
                              {toolCall.name}
                              {toolCall.cached && <span className="text-xs text-blue-400 ml-1">(cached)</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Messages */}
                <div className="space-y-6">
                  {messages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className={`${message.role === "user" ? "flex justify-end" : "flex flex-col gap-2"}`}
                    >
                      {message.role === "assistant" && (
                        <div className="flex items-center mb-2">
                          <IrisLogo width={24} height={24} className="h-6 w-auto max-w-none" />
                        </div>
                      )}
                      
                      {message.role === "assistant" ? (
                        <div className="px-6 py-4">
                          <MarkdownRenderer content={message.content} />
                          
                          {/* Artifacts */}
                          {message.artifacts && message.artifacts.length > 0 && (
                            <div className="mt-4 border-t border-white/10 pt-4">
                              <div className="text-sm text-white/70 mb-2">Created files:</div>
                              <div className="space-y-1">
                                {message.artifacts.map((artifact, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-sm text-white/60">
                                    <FileIcon className="h-4 w-4" />
                                    <div>
                                      <span>{artifact.path}</span>
                                      <span className="text-white/50">({artifact.size} bytes)</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="glass-message px-6 py-4 bg-blue-500/20">
                          <div className="prose prose-invert max-w-none">
                            <div className="whitespace-pre-wrap text-white">{message.content}</div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                  
                  {/* Typing Indicator */}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center mb-2">
                        <IrisLogo width={24} height={24} className="h-6 w-auto max-w-none" />
                      </div>
                      <div className="px-6 py-4">
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

          {/* Chat Input */}
          <div className="p-6">
            <ElegantChatInput
              value={input}
              onChange={setInput}
              onSend={handleSend}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Computer View */}
        <AnimatePresence>
          <ComputerView
            isOpen={showComputerView}
            onClose={() => setShowComputerView(false)}
            agentName="Iris"
          />
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <div>
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