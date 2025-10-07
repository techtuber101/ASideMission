/**
 * Simple Chat Manager - Clean, intuitive chat system
 * 
 * Key Principles:
 * 1. Default "New Chat" tab (no URL change until first message)
 * 2. Newest chats on the right, oldest on the left
 * 3. Auto-scroll to show newest chat
 * 4. Sticky + button on the right
 * 5. No page reloads, smooth transitions
 * 6. All messages persist, no disappearing content
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { localChatStorage, LocalChat, LocalMessage } from '@/lib/stores/local-chats';
import { supabase } from '@/lib/supabase/client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  artifacts?: Array<{
    path: string;
    size: number;
  }>;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  isLocal?: boolean;
  threadId?: string;
}

export interface ChatTab {
  id: string;
  title: string;
  isActive: boolean;
  chatId: string;
  isNew?: boolean;
}

const MAX_TABS = 10;
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Helper function to get access token from session
const getAccessToken = async (): Promise<string | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
};

export function useSimpleChatManager() {
  const { user, isLoading: authLoading } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [tabs, setTabs] = useState<ChatTab[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>('new-chat');
  const [isLoading, setIsLoading] = useState(true);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Initialize with a single "New Chat" tab
  const initializeTabs = useCallback(() => {
    const newTab: ChatTab = {
      id: 'new-chat',
      title: 'New Chat',
      isActive: true,
      chatId: 'new-chat',
      isNew: true,
    };
    setTabs([newTab]);
    setCurrentChatId('new-chat');
  }, []);

  // Load existing chats from storage
  const loadChats = useCallback(async () => {
    setIsLoading(true);

    try {
      let loadedChats: Chat[] = [];

      // Load from cloud storage if authenticated
      if (user) {
        try {
          const token = await getAccessToken();
          if (!token) {
            throw new Error('No access token available');
          }
          
          const response = await fetch(`${API_URL}/api/threads`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            loadedChats = data.threads.map((thread: any) => ({
              id: thread.thread_id,
              title: thread.metadata?.title || 'Untitled Chat',
              messages: [],
              createdAt: new Date(thread.created_at).getTime(),
              updatedAt: new Date(thread.updated_at).getTime(),
              isLocal: false,
              threadId: thread.thread_id,
            }));
          }
        } catch (err) {
          console.warn('Error loading cloud chats:', err);
        }
      }

      // Always load local chats
      const localChats = localChatStorage.getAllChats();
      const localChatsFormatted: Chat[] = localChats.map(chat => ({
        id: chat.id,
        title: chat.title,
        messages: chat.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          artifacts: msg.artifacts,
        })),
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        isLocal: true,
      }));

      // Merge and deduplicate
      const allChats = [...loadedChats, ...localChatsFormatted];
      const uniqueChats = allChats.filter((chat, index, self) => 
        index === self.findIndex(c => c.id === chat.id)
      );

      setChats(uniqueChats);

      // Create tabs from existing chats (oldest to newest, left to right)
      const existingChatTabs: ChatTab[] = uniqueChats
        .sort((a, b) => a.updatedAt - b.updatedAt) // Oldest first
        .slice(0, MAX_TABS - 1) // Reserve space for "New Chat"
        .map(chat => ({
          id: `tab-${chat.id}`,
          title: chat.title,
          isActive: false,
          chatId: chat.id,
          isNew: false,
        }));

      // Add "New Chat" tab at the end (rightmost)
      const newTab: ChatTab = {
        id: 'new-chat',
        title: 'New Chat',
        isActive: true,
        chatId: 'new-chat',
        isNew: true,
      };

      const allTabs = [...existingChatTabs, newTab];
      setTabs(allTabs);

    } catch (err) {
      console.error('Error loading chats:', err);
      initializeTabs(); // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [user, initializeTabs]);

  // Create a new chat from the current "New Chat" tab
  const createChatFromNew = useCallback(async (firstMessage: string): Promise<Chat> => {
    const now = Date.now();
    const title = generateTitle(firstMessage);

    let newChat: Chat;

    if (user) {
      // Create cloud chat for authenticated users
      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('No access token available');
        }
        
        const response = await fetch(`${API_URL}/api/threads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${token}`,
          },
          body: new URLSearchParams({ name: title }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (response.ok) {
          const data = await response.json();
          newChat = {
            id: data.thread_id,
            title,
            messages: [],
            createdAt: now,
            updatedAt: now,
            isLocal: false,
            threadId: data.thread_id,
          };
        } else {
          throw new Error('Failed to create cloud chat');
        }
      } catch (err) {
        console.error('Error creating cloud chat:', err);
        
        // Check if it's a network error (backend not running)
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
          console.warn('Backend API not available, falling back to local chat');
        }
        
        // Fallback to local chat
        const localChat = localChatStorage.createChat(firstMessage);
        newChat = {
          id: localChat.id,
          title: localChat.title,
          messages: [],
          createdAt: localChat.createdAt,
          updatedAt: localChat.updatedAt,
          isLocal: true,
        };
      }
    } else {
      // Create local chat for anonymous users
      const localChat = localChatStorage.createChat(firstMessage);
      newChat = {
        id: localChat.id,
        title: localChat.title,
        messages: [],
        createdAt: localChat.createdAt,
        updatedAt: localChat.updatedAt,
        isLocal: true,
      };
    }

    // Add to chats
    setChats(prev => [...prev, newChat]);

    // Update the "New Chat" tab to become the actual chat tab
    setTabs(prev => {
      const updatedTabs = prev.map(tab => ({ ...tab, isActive: false }));
      const newTab: ChatTab = {
        id: `tab-${newChat.id}`,
        title: newChat.title,
        isActive: true,
        chatId: newChat.id,
        isNew: false,
      };
      
      // Replace the "New Chat" tab with the actual chat tab
      const newTabs = [...updatedTabs.slice(0, -1), newTab];
      
      // Add a new "New Chat" tab at the end
      const finalNewTab: ChatTab = {
        id: 'new-chat',
        title: 'New Chat',
        isActive: false,
        chatId: 'new-chat',
        isNew: true,
      };
      
      return [...newTabs, finalNewTab];
    });

    // Update currentChatId to the new chat
    setCurrentChatId(newChat.id);
    return newChat;
  }, [user]);

  // Create a completely new chat (from + button)
  const createNewChat = useCallback(() => {
    // Simply switch to the existing "New Chat" tab
    setTabs(prev => prev.map(tab => ({
      ...tab,
      isActive: tab.id === 'new-chat'
    })));
    setCurrentChatId('new-chat');
  }, []);

  // Switch to an existing chat
  const switchToChat = useCallback((chatId: string) => {
    setTabs(prev => prev.map(tab => ({
      ...tab,
      isActive: tab.chatId === chatId
    })));
    setCurrentChatId(chatId);
  }, []);

  // Close a chat tab
  const closeChat = useCallback((chatId: string) => {
    if (tabs.length <= 1) return; // Don't close the last tab

    setTabs(prev => {
      const filteredTabs = prev.filter(tab => tab.chatId !== chatId);
      const activeTab = filteredTabs.find(tab => tab.isActive) || filteredTabs[filteredTabs.length - 1];
      
      if (activeTab) {
        activeTab.isActive = true;
        setCurrentChatId(activeTab.chatId);
      }

      return filteredTabs;
    });

    // Also remove from chats if it's a local chat
    const chat = chats.find(c => c.id === chatId);
    if (chat?.isLocal) {
      localChatStorage.deleteChat(chatId);
      setChats(prev => prev.filter(c => c.id !== chatId));
    }
  }, [tabs.length, chats]);

  // Add message to current chat
  const addMessage = useCallback(async (message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<{ message: ChatMessage; chatId: string }> => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    // Get the active chat ID from tabs (more reliable than currentChatId)
    const activeChatId = tabs.find(tab => tab.isActive)?.chatId || currentChatId;

    // If we're on "New Chat" and this is the first user message, create the chat
    if (activeChatId === 'new-chat' && message.role === 'user') {
      const newChat = await createChatFromNew(message.content);
      
      // Add the message to the new chat
      setChats(prev => prev.map(chat => 
        chat.id === newChat.id 
          ? {
              ...chat,
              messages: [...chat.messages, newMessage],
              updatedAt: Date.now(),
            }
          : chat
      ));

      // Save to storage
      if (newChat.isLocal) {
        const localMessage: Omit<LocalMessage, 'id'> = {
          role: message.role,
          content: message.content,
          timestamp: newMessage.timestamp,
          artifacts: message.artifacts,
        };
        localChatStorage.addMessage(newChat.id, localMessage);
      }

      return { message: newMessage, chatId: newChat.id };
    }

    // Add message to existing chat
    setChats(prev => prev.map(chat => 
      chat.id === activeChatId 
        ? {
            ...chat,
            messages: [...chat.messages, newMessage],
            updatedAt: Date.now(),
          }
        : chat
    ));

    // Save to storage
    const chat = chats.find(c => c.id === activeChatId);
    if (chat?.isLocal) {
      const localMessage: Omit<LocalMessage, 'id'> = {
        role: message.role,
        content: message.content,
        timestamp: newMessage.timestamp,
        artifacts: message.artifacts,
      };
      localChatStorage.addMessage(activeChatId, localMessage);
    } else if (user && chat?.threadId) {
      // Save to cloud storage
      try {
        const token = await getAccessToken();
        if (token) {
          await fetch(`${API_URL}/api/threads/${chat.threadId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              type: message.role === 'user' ? 'user' : 'assistant',
              content: message.content,
              is_llm_message: true,
            }),
          });
        }
      } catch (err) {
        console.error('Error saving message to cloud:', err);
      }
    }

    return { message: newMessage, chatId: activeChatId };
  }, [currentChatId, chats, user, createChatFromNew, tabs]);

  // Get current chat
  const getCurrentChat = useCallback((): Chat | null => {
    if (currentChatId === 'new-chat') {
      return {
        id: 'new-chat',
        title: 'New Chat',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isLocal: true,
      };
    }
    return chats.find(chat => chat.id === currentChatId) || null;
  }, [chats, currentChatId]);

  // Auto-scroll to rightmost tab
  const scrollToRightmost = useCallback(() => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollLeft = tabsContainerRef.current.scrollWidth;
    }
  }, []);

  // Scroll to rightmost tab when tabs change
  useEffect(() => {
    scrollToRightmost();
  }, [tabs, scrollToRightmost]);

  // Initialize on mount
  useEffect(() => {
    if (!authLoading) {
      loadChats();
    }
  }, [authLoading, loadChats]);

  return {
    // State
    chats,
    tabs,
    currentChatId,
    isLoading,
    tabsContainerRef,
    
    // Actions
    createChatFromNew,
    createNewChat,
    switchToChat,
    closeChat,
    addMessage,
    
    // Getters
    getCurrentChat,
    
    // Utils
    isAuthenticated: !!user,
    scrollToRightmost,
  };
}

// Helper function to generate chat titles
function generateTitle(firstMessage: string): string {
  const words = firstMessage.trim().split(' ').slice(0, 6);
  const title = words.join(' ');
  return title.length > 50 ? title.substring(0, 50) + '...' : title;
}
