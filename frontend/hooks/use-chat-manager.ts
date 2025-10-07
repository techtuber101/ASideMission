/**
 * Comprehensive chat management hook that handles:
 * - Local and cloud storage integration
 * - Tab management with proper shifting
 * - Chat history persistence
 * - Real-time updates
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
  threadId?: string; // For cloud chats
}

export interface ChatTab {
  id: string;
  title: string;
  isActive: boolean;
  chatId: string; // Reference to the actual chat
  isNew?: boolean; // Flag for new/unsaved chats
}

const MAX_TABS = 10; // Maximum number of tabs to show
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useChatManager() {
  const { user, isLoading: authLoading } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [tabs, setTabs] = useState<ChatTab[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tabsRef = useRef<ChatTab[]>([]);

  // Initialize with a default "New Chat" tab
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
    tabsRef.current = [newTab];
  }, []);

  // Load chats from storage
  const loadChats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let loadedChats: Chat[] = [];

      if (user) {
        // Load from cloud storage only if user is authenticated
        try {
          // Get the current session to access the access token
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session?.access_token) {
            throw new Error('No access token available');
          }
          
          const response = await fetch(`${API_URL}/api/threads`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            loadedChats = data.threads.map((thread: any) => ({
              id: thread.thread_id,
              title: thread.metadata?.title || 'Untitled Chat',
              messages: [], // Messages loaded separately
              createdAt: new Date(thread.created_at).getTime(),
              updatedAt: new Date(thread.updated_at).getTime(),
              isLocal: false,
              threadId: thread.thread_id,
            }));
          } else {
            console.warn('Failed to load cloud chats, falling back to local');
          }
        } catch (err) {
          console.warn('Error loading cloud chats:', err);
        }
      }

      // Always load local chats as backup or for anonymous users
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

      // Merge chats, prioritizing cloud chats
      const allChats = [...loadedChats, ...localChatsFormatted];
      const uniqueChats = allChats.filter((chat, index, self) => 
        index === self.findIndex(c => c.id === chat.id)
      );

      setChats(uniqueChats);

      // Create tabs from loaded chats
      const chatTabs: ChatTab[] = uniqueChats
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_TABS - 1) // Reserve one slot for "New Chat"
        .map((chat, index) => ({
          id: `tab-${chat.id}`,
          title: chat.title,
          isActive: index === 0, // First tab is active
          chatId: chat.id,
          isNew: false,
        }));

      // Add "New Chat" tab at the beginning
      const newTab: ChatTab = {
        id: 'new-chat',
        title: 'New Chat',
        isActive: chatTabs.length === 0, // Active if no other tabs
        chatId: 'new-chat',
        isNew: true,
      };

      const allTabs = [newTab, ...chatTabs];
      setTabs(allTabs);
      tabsRef.current = allTabs;

      // Set current chat
      if (allTabs.length > 0) {
        setCurrentChatId(allTabs.find(tab => tab.isActive)?.chatId || allTabs[0].chatId);
      }

    } catch (err) {
      console.error('Error loading chats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chats');
      initializeTabs(); // Fallback to default
    } finally {
      setIsLoading(false);
    }
  }, [user, initializeTabs]);

  // Load messages for a specific chat
  const loadChatMessages = useCallback(async (chatId: string): Promise<ChatMessage[]> => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return [];

    // If messages are already loaded, return them
    if (chat.messages.length > 0) {
      return chat.messages;
    }

    // For local chats, messages are already loaded
    if (chat.isLocal) {
      return chat.messages;
    }

    // Load messages from cloud
    if (user && chat.threadId) {
      try {
        // Get the current session to access the access token
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No access token available');
        }
        
        const response = await fetch(`${API_URL}/api/threads/${chat.threadId}/messages`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const messages: ChatMessage[] = data.messages.map((msg: any) => ({
            id: msg.message_id,
            role: msg.content?.role || 'user',
            content: msg.content?.content || '',
            timestamp: new Date(msg.created_at).getTime(),
            artifacts: msg.artifacts,
          }));

          // Update chat with loaded messages
          setChats(prev => prev.map(c => 
            c.id === chatId 
              ? { ...c, messages }
              : c
          ));

          return messages;
        }
      } catch (err) {
        console.error('Error loading messages:', err);
      }
    }

    return [];
  }, [chats, user]);

  // Create a new chat
  const createChat = useCallback(async (firstMessage?: string): Promise<Chat> => {
    const now = Date.now();
    const title = firstMessage ? generateTitle(firstMessage) : 'New Chat';

    let newChat: Chat;

    if (user) {
      // Create cloud chat for authenticated users
      try {
        // Get the current session to access the access token
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No access token available');
        }
        
        const response = await fetch(`${API_URL}/api/threads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: new URLSearchParams({
            name: title,
          }),
        });

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
    setChats(prev => [newChat, ...prev]);

    // Create new tab and shift existing tabs
    const newTab: ChatTab = {
      id: `tab-${newChat.id}`,
      title: newChat.title,
      isActive: true,
      chatId: newChat.id,
      isNew: false,
    };

    setTabs(prev => {
      const updatedTabs = prev.map(tab => ({ ...tab, isActive: false }));
      const newTabs = [newTab, ...updatedTabs].slice(0, MAX_TABS);
      tabsRef.current = newTabs;
      return newTabs;
    });

    setCurrentChatId(newChat.id);
    return newChat;
  }, [user]);

  // Add message to chat
  const addMessage = useCallback(async (chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    // Update local state immediately
    setChats(prev => prev.map(chat => 
      chat.id === chatId 
        ? {
            ...chat,
            messages: [...chat.messages, newMessage],
            updatedAt: Date.now(),
          }
        : chat
    ));

    // Update tab title if this is the first message
    if (message.role === 'user') {
      const chat = chats.find(c => c.id === chatId);
      if (chat && chat.messages.length === 0) {
        const title = generateTitle(message.content);
        setTabs(prev => prev.map(tab => 
          tab.chatId === chatId 
            ? { ...tab, title }
            : tab
        ));
      }
    }

    // Save to storage
    const chat = chats.find(c => c.id === chatId);
    if (chat?.isLocal) {
      // Save to local storage
      const localMessage: Omit<LocalMessage, 'id'> = {
        role: message.role,
        content: message.content,
        timestamp: newMessage.timestamp,
        artifacts: message.artifacts,
      };
      localChatStorage.addMessage(chatId, localMessage);
    } else if (user && chat?.threadId) {
      // Save to cloud storage for authenticated users
      try {
        // Get the current session to access the access token
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No access token available');
        }
        
        await fetch(`${API_URL}/api/threads/${chat.threadId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            type: message.role === 'user' ? 'user' : 'assistant',
            content: message.content,
            is_llm_message: true,
          }),
        });
      } catch (err) {
        console.error('Error saving message to cloud:', err);
      }
    }
    // For anonymous users with cloud threads, messages are handled by WebSocket

    return newMessage;
  }, [chats, user]);

  // Switch to a different chat
  const switchToChat = useCallback((chatId: string) => {
    setTabs(prev => prev.map(tab => ({
      ...tab,
      isActive: tab.chatId === chatId,
    })));
    setCurrentChatId(chatId);
  }, []);

  // Close a chat tab
  const closeChat = useCallback((chatId: string) => {
    if (tabs.length <= 1) return; // Don't close the last tab

    setTabs(prev => {
      const filteredTabs = prev.filter(tab => tab.chatId !== chatId);
      const activeTab = filteredTabs.find(tab => tab.isActive) || filteredTabs[0];
      
      if (activeTab) {
        activeTab.isActive = true;
        setCurrentChatId(activeTab.chatId);
      }

      tabsRef.current = filteredTabs;
      return filteredTabs;
    });
  }, [tabs.length]);

  // Create new chat tab
  const createNewChat = useCallback(() => {
    const newTab: ChatTab = {
      id: `new-${Date.now()}`,
      title: 'New Chat',
      isActive: true,
      chatId: `new-${Date.now()}`,
      isNew: true,
    };

    setTabs(prev => {
      const updatedTabs = prev.map(tab => ({ ...tab, isActive: false }));
      const newTabs = [newTab, ...updatedTabs].slice(0, MAX_TABS);
      tabsRef.current = newTabs;
      return newTabs;
    });

    setCurrentChatId(newTab.chatId);
  }, []);

  // Get current chat
  const getCurrentChat = useCallback((): Chat | null => {
    if (!currentChatId) return null;
    return chats.find(chat => chat.id === currentChatId) || null;
  }, [chats, currentChatId]);

  // Get chat by ID
  const getChat = useCallback((chatId: string): Chat | null => {
    return chats.find(chat => chat.id === chatId) || null;
  }, [chats]);

  // Delete chat
  const deleteChat = useCallback(async (chatId: string): Promise<boolean> => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return false;

    try {
      if (chat.isLocal) {
        const success = localChatStorage.deleteChat(chatId);
        if (success) {
          setChats(prev => prev.filter(c => c.id !== chatId));
          closeChat(chatId);
        }
        return success;
      } else if (user && chat.threadId) {
        // Only try to delete from cloud if user is authenticated
        // Get the current session to access the access token
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No access token available');
        }
        
        const response = await fetch(`${API_URL}/api/threads/${chat.threadId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          setChats(prev => prev.filter(c => c.id !== chatId));
          closeChat(chatId);
          return true;
        }
      } else {
        // For anonymous users with cloud threads, just remove from local state
        setChats(prev => prev.filter(c => c.id !== chatId));
        closeChat(chatId);
        return true;
      }
    } catch (err) {
      console.error('Error deleting chat:', err);
    }

    return false;
  }, [chats, user, closeChat]);

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
    error,
    
    // Actions
    loadChats,
    loadChatMessages,
    createChat,
    addMessage,
    switchToChat,
    closeChat,
    createNewChat,
    deleteChat,
    
    // Getters
    getCurrentChat,
    getChat,
    
    // Utils
    isAuthenticated: !!user,
  };
}

// Helper function to generate chat titles
function generateTitle(firstMessage: string): string {
  const words = firstMessage.trim().split(' ').slice(0, 6);
  const title = words.join(' ');
  return title.length > 50 ? title.substring(0, 50) + '...' : title;
}
