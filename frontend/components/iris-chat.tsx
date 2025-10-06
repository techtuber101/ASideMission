"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SendIcon, UserIcon, MessageSquareIcon, MonitorIcon, ShareIcon, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ElegantChatInput } from "@/components/elegant-chat-input";
import { BottomNavigation } from "@/components/bottom-navigation";
import { HistoryModal } from "@/components/history-modal";
import { ComputerView } from "@/components/computer-view";
import { FileUpload } from "@/components/file-upload";
import { IrisLogo } from "@/components/iris-logo";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useSimpleChatManager, ChatMessage } from "@/hooks/use-simple-chat-manager";

// Using ChatMessage from useChatManager hook

interface ToolCall {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'error';
  cached?: boolean;
}

interface ToolCallViewModel {
  id: string;
  name: string;
  args: Record<string, any>;
  status: 'running' | 'completed' | 'error';
  result?: any;
  startTime: number;
  endTime?: number;
  cached?: boolean;
}

// Removed Phase interface - no longer using phases

interface IrisChatProps {
  chatId?: string;
}

export function IrisChat({ chatId }: IrisChatProps) {
  const router = useRouter();
  
  // Use the simple chat manager
  const {
    chats,
    tabs,
    currentChatId,
    isLoading: chatManagerLoading,
    tabsContainerRef,
    createChatFromNew,
    createNewChat,
    switchToChat,
    closeChat,
    addMessage,
    getCurrentChat,
    scrollToRightmost,
  } = useSimpleChatManager();
  
  // Local state for UI
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showComputerView, setShowComputerView] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [activeToolCalls, setActiveToolCalls] = useState<Map<string, ToolCall>>(new Map());
  const [toolCalls, setToolCalls] = useState<ToolCallViewModel[]>([]);
  const [deliveredArtifacts, setDeliveredArtifacts] = useState<Array<{path: string; size: number}>>([]);
  const [processedMessageIds, setProcessedMessageIds] = useState<Set<string>>(new Set());
  const [lastMessageContent, setLastMessageContent] = useState<string>("");
  const [lastMessageTimestamp, setLastMessageTimestamp] = useState<number>(0);
  const [hasReceivedResponse, setHasReceivedResponse] = useState<boolean>(false);
  const [streamingTextContent, setStreamingTextContent] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const finalizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // WebSocket connection ref for cleanup
  const websocketRef = useRef<WebSocket | null>(null);
  
  // Get current chat and messages
  const currentChat = getCurrentChat();
  const messages = currentChat?.messages || [];
  
  // Helper function to generate unique IDs
  const generateUniqueId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Helper function to derive tool type from tool name
  const getToolType = (toolName: string): 'command' | 'browser' | 'file' | 'search' => {
    if (toolName.includes('web_search') || toolName.includes('search')) return 'search';
    if (toolName.includes('browser') || toolName.includes('navigate')) return 'browser';
    if (toolName.includes('file') || toolName.includes('read') || toolName.includes('write')) return 'file';
    if (toolName.includes('command') || toolName.includes('shell') || toolName.includes('execute')) return 'command';
    return 'command'; // default
  };

  // Comprehensive duplicate detection
  const isDuplicateMessage = (content: string, timestamp: number, messageId?: string): boolean => {
    const now = Date.now();
    
    // Check if we've already processed this exact message ID
    if (messageId && processedMessageIds.has(messageId)) {
      console.log("🚫 Duplicate detected: Same message ID", messageId);
      return true;
    }
    
    // For individual tokens, be less aggressive with duplicate detection
    // Only check for exact content matches within 100ms (for rapid tokens)
    if (content === lastMessageContent && (timestamp - lastMessageTimestamp) < 100) {
      console.log("🚫 Duplicate detected: Same content within 100ms");
      return true;
    }
    
    // Check if message is too close in time (less than 10ms apart for tokens)
    if (lastMessageTimestamp && (timestamp - lastMessageTimestamp) < 10) {
      console.log("🚫 Duplicate detected: Too close in time");
      return true;
    }
    
    return false;
  };

  // Simple similarity calculation
  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  // Levenshtein distance calculation
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  // Safe message addition with duplicate prevention
  const addMessageSafely = async (message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<boolean> => {
    const activeChatId = tabs.find(tab => tab.isActive)?.chatId || currentChatId;
    if (!activeChatId) return false;
    
    const content = message.content;
    const timestamp = Date.now();
    
    // Check for duplicates
    if (isDuplicateMessage(content, timestamp)) {
      console.log("🚫 Blocked duplicate message:", content.substring(0, 50) + "...");
      return false;
    }
    
    // Update last message tracking
    setLastMessageContent(content);
    setLastMessageTimestamp(timestamp);
    
    try {
      // Add the message using the chat manager
      const result = await addMessage(message);
      console.log("✅ Added message:", content.substring(0, 50) + "...");
      return true;
    } catch (error) {
      console.error("❌ Failed to add message:", error);
      return false;
    }
  };


  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

  // Initialize WebSocket connection when currentChatId changes
  useEffect(() => {
    const activeChatId = tabs.find(tab => tab.isActive)?.chatId || currentChatId;
    
    console.log("🔄 useEffect triggered - currentChatId:", currentChatId);
    console.log("🔄 useEffect triggered - activeChatId:", activeChatId);
    console.log("🔄 useEffect triggered - tabs:", tabs);
    
    if (!activeChatId || activeChatId === 'new-chat' || activeChatId.startsWith('new-')) {
      console.log("❌ useEffect early return - no valid chat ID");
      return; // Don't connect for new/unsaved chats
    }
    
    console.log("🔄 Initializing WebSocket connection for chat:", activeChatId);
    
    const initializeConnection = async () => {
      try {
        // Close any existing WebSocket connection
        if (websocketRef.current) {
          console.log("🔌 Closing existing WebSocket connection");
          websocketRef.current.close();
          websocketRef.current = null;
        }
        
        // Get authentication token from Supabase (optional)
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        
        console.log("🔑 Initial session data:", session ? 'exists' : 'null');
        console.log("🔑 Initial auth token:", authToken ? `${authToken.substring(0, 20)}...` : 'null');
        
        console.log("🔗 Creating WebSocket connection for thread:", activeChatId);
        
        // Connect WebSocket with thread ID and optional auth token
        const wsUrlWithAuth = authToken 
          ? `${wsUrl}/ws/chat/${activeChatId}?token=${encodeURIComponent(authToken)}`
          : `${wsUrl}/ws/chat/${activeChatId}`;
        
        console.log("🔗 WebSocket URL:", wsUrlWithAuth);
        const websocket = new WebSocket(wsUrlWithAuth);
        
        websocket.onopen = () => {
          console.log("✅ WebSocket connected to thread:", activeChatId);
          console.log("🔗 WebSocket readyState:", websocket.readyState);
          websocketRef.current = websocket;
        };

        websocket.onmessage = async (event) => {
          try {
            console.log("🔍 Raw WebSocket data:", event.data);
            console.log("🔍 Data type:", typeof event.data);
            console.log("🔍 Data length:", event.data.length);
            
            if (!event.data || event.data.trim() === '') {
              console.log("❌ Empty WebSocket data received");
              return;
            }
            
            const data = JSON.parse(event.data);
            console.log("🔍 Parsed WebSocket message:", data);
            
            if (data.type === "tool_call") {
              const toolCall: ToolCall = {
                id: data.id,
                name: data.name,
                status: 'running',
                cached: data.cached || false
              };
              setActiveToolCalls(prev => new Map(prev).set(data.id, toolCall));
              
              // Mark that we've received a response (agent is working)
              if (!hasReceivedResponse) {
                setHasReceivedResponse(true);
                setIsLoading(false); // Hide thinking indicator
              }
              
              // Add to toolCalls array for ComputerView
              const toolCallViewModel: ToolCallViewModel = {
                id: data.id,
                name: data.name,
                args: data.args || {},
                status: 'running',
                startTime: data.ts || Date.now()
              };
              setToolCalls(prev => [...prev, toolCallViewModel]);
              
              // Auto-open Computer View on first tool call
              if (toolCalls.length === 0) {
                setShowComputerView(true);
              }
              
              // Add compact tool call chip instead of system message
              // Tool calls will be displayed as chips in the UI, not as messages
              
            } else if (data.type === "tool_result") {
              setActiveToolCalls(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(data.id);
                if (existing) {
                  newMap.set(data.id, { ...existing, status: data.success ? 'completed' : 'error' });
                }
                return newMap;
              });
              
              // Update toolCalls array for ComputerView
              setToolCalls(prev => prev.map(tool => 
                tool.id === data.id 
                  ? { 
                      ...tool, 
                      status: data.success ? 'completed' : 'error',
                      success: data.success,
                      cached: data.cached,
                      output: JSON.stringify(data.result)
                    }
                  : tool
              ));
              
              // Tool results will be displayed as updated chips, not as system messages
              
              // Remove completed tool calls after a delay
              setTimeout(() => {
                setActiveToolCalls(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(data.id);
                  return newMap;
                });
              }, 3000);
              
            } else if (data.type === "text") {
              console.log("📝 Received text token:", data.content);
              
              // Mark that we've received a response
              if (!hasReceivedResponse) {
                setHasReceivedResponse(true);
                setIsLoading(false); // Hide thinking indicator
                setIsStreaming(true); // Start streaming mode
                setStreamingTextContent(""); // Reset streaming content
                
                // Create initial assistant message
                const lastMessage = messages[messages.length - 1];
                if (!lastMessage || lastMessage.role === "user") {
                  await addMessageSafely({
                    role: "assistant",
                    content: data.content, // Start with the first token
                  });
                }
              } else {
                // Update the last assistant message with new content
                const lastMessage = messages[messages.length - 1];
                if (lastMessage && lastMessage.role === "assistant") {
                  // For streaming updates, we need to handle this differently
                  // This is a simplified approach - in a real implementation,
                  // you'd want to handle streaming updates more elegantly
                  console.log("📝 Streaming update:", data.content);
                }
              }
              
              // Clear existing finalize timeout
              if (finalizeTimeoutRef.current) {
                clearTimeout(finalizeTimeoutRef.current);
              }
              
              // Set new timeout to finalize message (200ms after last token)
              finalizeTimeoutRef.current = setTimeout(() => {
                setIsStreaming(false);
                finalizeTimeoutRef.current = null;
              }, 200);
              
            } else if (data.type === "deliver") {
              setDeliveredArtifacts(data.artifacts || []);
              
              // Add system message for delivery
              await addMessageSafely({
                role: "system",
                content: `📦 Delivered ${data.artifacts?.length || 0} file(s): ${data.summary || 'Files created'}`,
              });
              console.log("📝 Added deliver message");
            } else if (data.type === "ack") {
              console.log("✅ Received acknowledgment");
            } else if (data.type === "error") {
              console.log("❌ Received error:", data.content);
            } else if (data.type === "file_upload_success") {
              console.log("✅ File uploaded successfully:", data);
              // Show subtle notification, no tool call chip
              // File is now available in sandbox for agent to use
            } else if (data.type === "file_upload_error") {
              console.error("❌ File upload failed:", data);
              // Show error notification
            } else if (data.type === "file_download_success") {
              console.log("✅ File downloaded successfully:", data);
              // Trigger file download in browser
              downloadFile(data.file_name, data.content);
            } else if (data.type === "file_download_error") {
              console.error("❌ File download failed:", data);
              // Show error notification
            } else if (data.type === "list_files_success") {
              console.log("📁 Files listed successfully:", data);
              // Update file list in UI if needed
            } else if (data.type === "list_files_error") {
              console.error("❌ List files failed:", data);
              // Show error notification
            } else {
              console.log("❓ Unknown message type:", data.type);
            }
          } catch (error) {
            console.error("❌ Error parsing WebSocket message:", error);
            console.error("❌ Raw data that failed to parse:", event.data);
            console.error("❌ Error details:", error instanceof Error ? error.message : String(error));
            
            // Try to send an error message to the UI
            await addMessageSafely({
              role: "system",
              content: `❌ WebSocket parsing error: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        };

        websocket.onclose = (event) => {
          console.log("🔌 WebSocket disconnected:", event.code, event.reason);
          console.log("🔌 WebSocket wasClean:", event.wasClean);
          websocketRef.current = null;
        };

        websocket.onerror = (error) => {
          console.error("WebSocket error:", error);
        };

      } catch (error) {
        console.error("Failed to initialize connection:", error);
      }
    };

    initializeConnection();
    
    // Cleanup function for useEffect
    return () => {
      console.log("🧹 Component unmounting, cleaning up...");
      
      // Close WebSocket connection
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
      
      console.log("✅ Cleanup completed");
    };
    }, [currentChatId, tabs]); // Include currentChatId and tabs in dependency array

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewChat = () => {
    createNewChat();
  };

  const initializeWebSocketConnection = async (threadId: string, authToken?: string, initialMessage?: string) => {
    console.log("🔗 initializeWebSocketConnection called with:", { threadId, authToken: !!authToken, initialMessage });
    
    try {
      // Close any existing WebSocket connection
      if (websocketRef.current) {
        console.log("🔌 Closing existing WebSocket connection");
        websocketRef.current.close();
        websocketRef.current = null;
      }

      console.log("🔗 Creating WebSocket connection for thread:", threadId);
      
      // Connect WebSocket with thread ID and optional auth token
      const wsUrlWithAuth = authToken 
        ? `${wsUrl}/ws/chat/${threadId}?token=${encodeURIComponent(authToken)}`
        : `${wsUrl}/ws/chat/${threadId}`;
      
      console.log("🔗 WebSocket URL (initializeWebSocketConnection):", wsUrlWithAuth);
      const websocket = new WebSocket(wsUrlWithAuth);
      
      websocket.onopen = () => {
        console.log("✅ WebSocket connected to thread:", threadId);
        websocketRef.current = websocket;
        
        // Send the message that triggered this connection
        if (initialMessage) {
          const messageData = {
            type: "message",
            content: initialMessage,
            conversation_history: messages
          };
          console.log("📤 Sending initial message:", messageData);
          
          try {
            websocket.send(JSON.stringify(messageData));
            console.log("✅ Initial message sent successfully");
          } catch (error) {
            console.error("❌ Failed to send initial message:", error);
          }
        } else {
          console.log("⚠️ No initial message to send");
        }
      };

      websocket.onmessage = async (event) => {
        try {
          console.log("🔍 Raw WebSocket data:", event.data);
          console.log("🔍 Data type:", typeof event.data);
          console.log("🔍 Data length:", event.data.length);
          
          const data = JSON.parse(event.data);
          console.log("📥 Parsed WebSocket data:", data);
          
          if (data.type === "text") {
            console.log("📝 Received text token:", data.content);

            if (!hasReceivedResponse) {
              setHasReceivedResponse(true);
              setIsLoading(false); // Hide thinking indicator
              setIsStreaming(true); // Start streaming mode

              // Create initial assistant message if the last message is not an assistant message
              const lastMessage = messages[messages.length - 1];
              if (!lastMessage || lastMessage.role === "user") {
                await addMessageSafely({
                  role: "assistant",
                  content: "",
                });
              }
            }

            // Update the content of the last assistant message
            // For streaming updates, we need to handle this differently
            // This is a simplified approach - in a real implementation,
            // you'd want to handle streaming updates more elegantly
            console.log("📝 Streaming update:", data.content);

            // Clear existing finalize timeout
            if (finalizeTimeoutRef.current) {
              clearTimeout(finalizeTimeoutRef.current);
            }

            // Set new timeout to finalize message (200ms after last token)
            finalizeTimeoutRef.current = setTimeout(() => {
              setIsStreaming(false);
              finalizeTimeoutRef.current = null;
            }, 200);

          } else if (data.type === "deliver") {
            setDeliveredArtifacts(data.artifacts || []);

            // Add system message for delivery
            await addMessageSafely({
              role: "system",
              content: `📦 Delivered ${data.artifacts?.length || 0} file(s): ${data.summary || 'Files created'}`,
            });
            setIsStreaming(false); // Ensure streaming is off after delivery
          } else if (data.type === "end") {
            console.log("🏁 Received end signal");
            setIsStreaming(false);
            if (finalizeTimeoutRef.current) {
              clearTimeout(finalizeTimeoutRef.current);
              finalizeTimeoutRef.current = null;
            }
          }
        } catch (error) {
          console.error("❌ Error parsing WebSocket message:", error);
        }
      };

      websocket.onclose = (event) => {
        console.log("🔌 WebSocket disconnected:", event.code, event.reason);
        websocketRef.current = null;
        
        // If the connection was closed unexpectedly, try to reconnect
        if (event.code !== 1000 && event.code !== 1001) {
          console.log("🔄 WebSocket closed unexpectedly, attempting to reconnect...");
          setTimeout(() => {
            if (!websocketRef.current) {
              initializeWebSocketConnection(threadId, authToken, initialMessage);
            }
          }, 1000);
        }
      };

      websocket.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        websocketRef.current = null;
      };

    } catch (error) {
      console.error("Failed to initialize WebSocket connection:", error);
    }
  };

  const handleSend = async () => {
    console.log("🚀 handleSend called with input:", input);
    console.log("🚀 isLoading:", isLoading);
    
    if (!input.trim() || isLoading) {
      console.log("❌ handleSend early return - no input or loading");
      return;
    }

    const messageContent = input.trim();
    console.log("📝 Processing message:", messageContent);
    
    setInput("");
    setIsLoading(true);
    setHasReceivedResponse(false);
    setStreamingTextContent("");
    setIsStreaming(false);
    
    // Clear any pending timeouts
    if (finalizeTimeoutRef.current) {
      clearTimeout(finalizeTimeoutRef.current);
      finalizeTimeoutRef.current = null;
    }

    try {
      // Get the current active chat ID before adding the message
      const currentActiveChatId = tabs.find(tab => tab.isActive)?.chatId || currentChatId;
      console.log("🔍 Current active chat ID before:", currentActiveChatId);
      
      // Add the user message (this will handle chat creation if needed)
      console.log("📤 Adding user message...");
      const { message: newMessage, chatId: activeChatId } = await addMessage({
        role: "user",
        content: messageContent,
      });
      
      console.log("✅ Message added successfully");
      console.log("🔍 Active chat ID after:", activeChatId);
      
      // Update URL if we just created a new chat
      if (currentActiveChatId === 'new-chat' && activeChatId !== 'new-chat') {
        // Replace the URL instead of pushing
        window.history.replaceState(null, '', `/chat/${activeChatId}`);
        console.log("🔗 Updated URL to:", `/chat/${activeChatId}`);
      }

      // Send via WebSocket if connected
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        console.log("📤 Sending message via existing WebSocket:", messageContent);
        
        const messageData = {
          type: "message",
          content: messageContent,
          conversation_history: messages
        };
        console.log("📤 Sending data:", messageData);
        
        try {
          websocketRef.current.send(JSON.stringify(messageData));
          console.log("✅ Message sent successfully via WebSocket");
        } catch (error) {
          console.error("❌ Failed to send message via WebSocket:", error);
          setIsLoading(false);
        }
      } else {
        // If WebSocket is not connected, wait for the useEffect to establish connection
        console.log("🔌 WebSocket not connected, waiting for useEffect to establish connection...");
        
        // Wait for the WebSocket connection to be established (with timeout)
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait
        const checkConnection = () => {
          if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
            console.log("✅ WebSocket connection established, sending message");
            
            const messageData = {
              type: "message",
              content: messageContent,
              conversation_history: messages
            };
            
            try {
              websocketRef.current.send(JSON.stringify(messageData));
              console.log("✅ Message sent successfully via WebSocket");
            } catch (error) {
              console.error("❌ Failed to send message via WebSocket:", error);
              setIsLoading(false);
            }
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(checkConnection, 100);
          } else {
            console.log("❌ Timeout waiting for WebSocket connection");
            setIsLoading(false);
          }
        };
        
        checkConnection();
      }
    } catch (error) {
      console.error("❌ Failed to send message:", error);
      setIsLoading(false);
    }
  };

  const generateTitle = async (firstMessage: string) => {
    try {
      const response = await fetch(`${apiUrl}/chat/title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: firstMessage }),
      });

      if (!response.ok) {
        console.warn('Title generation failed, using default title');
        return; // Just return without throwing error
      }

      const data = await response.json();
      const newTitle = data.title || "New Chat";
      
      // Update the current chat's title
      if (currentChatId) {
        // This would need to be implemented in the chat manager
        console.log('Generated title:', newTitle);
      }
    } catch (error) {
      console.warn('Title generation failed:', error);
      // Don't throw error, just use default title
    }
  };

  // File upload handlers
  const handleFileUpload = async (files: any[]) => {
    try {
      // Send each file via WebSocket
      for (const file of files) {
        if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN && file.content) {
          websocketRef.current.send(JSON.stringify({
            type: "file_upload",
            file_name: file.name,
            file_content: file.content,
            file_size: file.size,
            file_type: file.type
          }));
        }
      }
    } catch (error) {
      console.error('File upload error:', error);
    }
  };

  const handleFileDownload = async (filePath: string) => {
    try {
      // Send download request via WebSocket
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({
          type: "file_download",
          file_path: filePath
        }));
      }
    } catch (error) {
      console.error('File download error:', error);
    }
  };

  const handleListFiles = async () => {
    try {
      // Send list files request via WebSocket
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({
          type: "list_files",
          folder_path: "/workspace"
        }));
      }
    } catch (error) {
      console.error('List files error:', error);
    }
  };

  // Helper function to download file from base64 content
  const downloadFile = (fileName: string, base64Content: string) => {
    try {
      // Decode base64 content
      const binaryString = atob(base64Content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Create blob and download
      const blob = new Blob([bytes]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download file error:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTabClick = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      switchToChat(tab.chatId);
      
      // Update URL if switching to an existing chat
      if (tab.chatId !== 'new-chat') {
        window.history.replaceState(null, '', `/chat/${tab.chatId}`);
      } else {
        window.history.replaceState(null, '', '/');
      }
    }
  };

  const handleTabClose = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      closeChat(tab.chatId);
      
      // Update URL after closing
      const remainingActiveTab = tabs.find(t => t.id !== tabId && t.isActive);
      if (remainingActiveTab) {
        if (remainingActiveTab.chatId !== 'new-chat') {
          window.history.replaceState(null, '', `/chat/${remainingActiveTab.chatId}`);
        } else {
          window.history.replaceState(null, '', '/');
        }
      }
    }
  };

  const handleNewTab = () => {
    createNewChat();
    window.history.replaceState(null, '', '/');
  };

  const handleHistorySelect = (chatId: string) => {
    switchToChat(chatId);
    window.history.replaceState(null, '', `/chat/${chatId}`);
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
                    className="glass-button h-9 w-9 p-0 text-foreground/60 hover:text-foreground/90 transition-all duration-250"
                    onClick={() => {/* TODO: Implement share functionality */}}
                  >
                    <ShareIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="glass-card text-foreground border-white/20 bg-black/80 backdrop-blur-sm">
                  <p>Share conversation</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="glass-button h-9 w-9 p-0 text-foreground/60 hover:text-foreground/90 transition-all duration-250"
                    onClick={() => {/* TODO: Implement view files functionality */}}
                  >
                    <FileIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="glass-card text-foreground border-white/20 bg-black/80 backdrop-blur-sm">
                  <p>View files</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showComputerView ? "default" : "ghost"}
                    size="sm"
                    className={`glass-button h-9 w-9 p-0 transition-all duration-250 ${
                      showComputerView 
                        ? "active text-foreground/90" 
                        : "text-foreground/60 hover:text-foreground/90"
                    }`}
                    onClick={() => setShowComputerView(!showComputerView)}
                  >
                    <MonitorIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="glass-card text-foreground border-white/20 bg-black/80 backdrop-blur-sm">
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
        <div className="flex flex-col flex-1 min-w-0">
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
                      <MessageSquareIcon className="h-10 w-10 text-foreground/70" />
                    </div>
                  </div>
                  <div className="glass-card p-8">
                    <h2 className="mb-3 text-2xl font-medium text-foreground">Hello, I'm Iris</h2>
                    <p className="text-foreground/70 leading-relaxed">
                      I'm your AI assistant. I can help you with various tasks, answer questions, 
                      and provide assistance. What would you like to know?
                    </p>
                  </div>
                </motion.div>
              </div>
            ) : (
              <div className="mx-auto max-w-4xl px-6 py-8">
                {/* Phase Indicator removed - no longer using phases */}

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
                            <span className="text-foreground/80">
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
                  {(() => {
                    // Group consecutive assistant messages together
                    const groupedMessages: Array<{ type: 'user' | 'assistant_group' | 'system', messages: ChatMessage[], startIndex: number }> = [];
                    let currentGroup: { type: 'user' | 'assistant_group' | 'system', messages: ChatMessage[], startIndex: number } | null = null;
                    
                    messages.forEach((message, index) => {
                      if (message.role === 'user') {
                        // Finalize any existing group
                        if (currentGroup) {
                          groupedMessages.push(currentGroup);
                          currentGroup = null;
                        }
                        // Create new user message group
                        groupedMessages.push({ type: 'user', messages: [message], startIndex: index });
                      } else if (message.role === 'assistant') {
                        if (currentGroup && currentGroup.type === 'assistant_group') {
                          // Add to existing assistant group
                          currentGroup.messages.push(message);
                        } else {
                          // Finalize any existing group
                          if (currentGroup) {
                            groupedMessages.push(currentGroup);
                          }
                          // Create new assistant group
                          currentGroup = { type: 'assistant_group', messages: [message], startIndex: index };
                        }
                      } else if (message.role === 'system') {
                        // Finalize any existing group
                        if (currentGroup) {
                          groupedMessages.push(currentGroup);
                          currentGroup = null;
                        }
                        // Create new system message group
                        groupedMessages.push({ type: 'system', messages: [message], startIndex: index });
                      }
                    });
                    
                    // Finalize any remaining group
                    if (currentGroup) {
                      groupedMessages.push(currentGroup);
                    }
                    
                    return groupedMessages.map((group, groupIndex) => {
                      if (group.type === 'user') {
                        const message = group.messages[0];
                        return (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: groupIndex * 0.1 }}
                            className="flex justify-end"
                          >
                            <div className="glass-message px-6 py-4 bg-blue-500/20">
                              <div className="prose prose-invert max-w-none">
                                <div className="whitespace-pre-wrap text-foreground">{message.content}</div>
                                {message.timestamp && (
                                  <div className="text-xs text-foreground/40 mt-1">
                                    {new Date(message.timestamp).toLocaleTimeString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      } else if (group.type === 'assistant_group') {
                        // Combine all assistant messages in the group
                        const combinedContent = group.messages.map(msg => msg.content).join('');
                        const lastMessage = group.messages[group.messages.length - 1];
                        const isLastGroup = groupIndex === groupedMessages.length - 1;
                        
                        return (
                          <motion.div
                            key={`assistant-group-${group.startIndex}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: groupIndex * 0.1 }}
                            className="flex flex-col gap-2"
                          >
                            {/* Iris logo only for the first assistant group */}
                            <div className="flex items-center mb-2">
                              <IrisLogo width={24} height={24} className="h-6 w-auto max-w-none" />
                            </div>
                            
                            <div className="px-6 py-4">
                              <MarkdownRenderer content={combinedContent} />
                              
                              {/* Streaming indicator */}
                              {isStreaming && isLastGroup && (
                                <div className="inline-block ml-1">
                                  <div className="inline-block w-2 h-4 bg-white/70 animate-pulse"></div>
                                </div>
                              )}
                              
                              {/* Tool Call Chips for completed messages */}
                              {activeToolCalls.size > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {Array.from(activeToolCalls.values()).map((toolCall) => (
                                    <div
                                      key={toolCall.id}
                                      className="glass-card flex items-center gap-2 px-3 py-1 rounded-full text-xs"
                                    >
                                      <div className={`h-2 w-2 rounded-full ${
                                        toolCall.status === 'running' ? 'bg-blue-500 animate-pulse' :
                                        toolCall.status === 'completed' ? 'bg-green-500' :
                                        'bg-red-500'
                                      }`} />
                                      <span className="text-foreground/80">{toolCall.name}</span>
                                      {toolCall.cached && (
                                        <span className="text-blue-400 text-xs">cached</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Artifacts */}
                              {lastMessage.artifacts && lastMessage.artifacts.length > 0 && (
                                <div className="mt-4 border-t border-white/10 pt-4">
                                  <div className="text-sm text-white/70 mb-2">Created files:</div>
                                  <div className="space-y-1">
                                    {lastMessage.artifacts.map((artifact: any, idx: number) => (
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
                              
                              {lastMessage.timestamp && (
                                <div className="text-xs text-white/40 mt-2">
                                  {new Date(lastMessage.timestamp).toLocaleTimeString()}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      } else if (group.type === 'system') {
                        const message = group.messages[0];
                        return (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: groupIndex * 0.1 }}
                            className="flex flex-col gap-2"
                          >
                            <div className="flex items-center mb-2">
                              <div className="glass-card flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                                <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                              </div>
                            </div>
                            
                            <div className="glass-message px-6 py-4 bg-gray-500/10 border-l-2 border-blue-500/50">
                              <div className="prose prose-invert max-w-none">
                                <div className="whitespace-pre-wrap text-blue-300 text-sm">
                                  {message.content}
                                </div>
                                {message.timestamp && (
                                  <div className="text-xs text-foreground/40 mt-1">
                                    {new Date(message.timestamp).toLocaleTimeString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      }
                      return null;
                    });
                  })()}
                  
                  
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
                  
                  {/* Scroll anchor */}
                  <div ref={messagesEndRef} />
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
              onFileUpload={() => setShowFileUpload(true)}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Computer View */}
        <AnimatePresence>
          <ComputerView
            toolCalls={toolCalls}
            isVisible={showComputerView}
            onToggle={() => setShowComputerView(!showComputerView)}
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
          tabsContainerRef={tabsContainerRef}
        />
      </div>

      {/* Modals */}
      <FileUpload
        onUpload={handleFileUpload}
        onDownload={handleFileDownload}
        onListFiles={handleListFiles}
        isVisible={showFileUpload}
        onClose={() => setShowFileUpload(false)}
      />
      
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        onSelectChat={handleHistorySelect}
        chats={chats}
      />
    </div>
  );
}