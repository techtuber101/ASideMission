/**
 * Unified chat storage hook that handles both local and cloud storage
 * Automatically switches between storage backends based on auth state
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { localChatStorage, LocalChat, LocalMessage } from '@/lib/stores/local-chats';

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
  isLocal?: boolean; // Flag to indicate if this is a local chat
}

export function useChatStorage() {
  const { user, isLoading: authLoading } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load chats based on auth state
  const loadChats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (user) {
        // Load from cloud storage
        const response = await fetch('/api/threads', {
          headers: {
            'Authorization': `Bearer ${user.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load chats from cloud');
        }

        const data = await response.json();
        const cloudChats: Chat[] = data.threads.map((thread: any) => ({
          id: thread.thread_id,
          title: thread.metadata?.title || 'Untitled Chat',
          messages: [], // Messages loaded separately
          createdAt: new Date(thread.created_at).getTime(),
          updatedAt: new Date(thread.updated_at).getTime(),
          isLocal: false,
        }));

        setChats(cloudChats);
      } else {
        // Load from local storage
        const localChats = localChatStorage.getAllChats();
        const chats: Chat[] = localChats.map(chat => ({
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

        setChats(chats);
      }
    } catch (err) {
      console.error('Error loading chats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chats');
      
      // Fallback to local storage on error
      if (user) {
        const localChats = localChatStorage.getAllChats();
        const chats: Chat[] = localChats.map(chat => ({
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
        setChats(chats);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load messages for a specific chat
  const loadChatMessages = useCallback(async (chatId: string): Promise<ChatMessage[]> => {
    if (!user) {
      // For local chats, messages are already loaded
      const chat = chats.find(c => c.id === chatId);
      return chat?.messages || [];
    }

    try {
      const response = await fetch(`/api/threads/${chatId}/messages`, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load messages');
      }

      const data = await response.json();
      return data.messages.map((msg: any) => ({
        id: msg.message_id,
        role: msg.content?.role || 'user',
        content: msg.content?.content || '',
        timestamp: new Date(msg.created_at).getTime(),
        artifacts: msg.artifacts,
      }));
    } catch (err) {
      console.error('Error loading messages:', err);
      return [];
    }
  }, [user, chats]);

  // Create a new chat
  const createChat = useCallback(async (firstMessage?: string): Promise<Chat> => {
    if (!user) {
      // Create local chat
      const localChat = localChatStorage.createChat(firstMessage);
      const chat: Chat = {
        id: localChat.id,
        title: localChat.title,
        messages: [],
        createdAt: localChat.createdAt,
        updatedAt: localChat.updatedAt,
        isLocal: true,
      };

      setChats(prev => [chat, ...prev]);
      return chat;
    }

    try {
      const response = await fetch('/api/threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${user.access_token}`,
        },
        body: new URLSearchParams({
          name: firstMessage || 'New Chat',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create chat');
      }

      const data = await response.json();
      const chat: Chat = {
        id: data.thread_id,
        title: firstMessage || 'New Chat',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isLocal: false,
      };

      setChats(prev => [chat, ...prev]);
      return chat;
    } catch (err) {
      console.error('Error creating chat:', err);
      throw err;
    }
  }, [user]);

  // Add message to chat
  const addMessage = useCallback(async (chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    if (!user) {
      // Add to local storage
      const localMessage: Omit<LocalMessage, 'id'> = {
        role: message.role,
        content: message.content,
        timestamp: newMessage.timestamp,
        artifacts: message.artifacts,
      };

      localChatStorage.addMessage(chatId, localMessage);
      
      // Update local state
      setChats(prev => prev.map(chat => 
        chat.id === chatId 
          ? {
              ...chat,
              messages: [...chat.messages, newMessage],
              updatedAt: Date.now(),
            }
          : chat
      ));

      return newMessage;
    }

    try {
      const response = await fetch(`/api/threads/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.access_token}`,
        },
        body: JSON.stringify({
          type: message.role === 'user' ? 'user' : 'assistant',
          content: message.content,
          is_llm_message: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add message');
      }

      const data = await response.json();
      const savedMessage: ChatMessage = {
        id: data.message_id,
        role: message.role,
        content: message.content,
        timestamp: new Date(data.created_at).getTime(),
        artifacts: message.artifacts,
      };

      // Update local state
      setChats(prev => prev.map(chat => 
        chat.id === chatId 
          ? {
              ...chat,
              messages: [...chat.messages, savedMessage],
              updatedAt: Date.now(),
            }
          : chat
      ));

      return savedMessage;
    } catch (err) {
      console.error('Error adding message:', err);
      throw err;
    }
  }, [user]);

  // Delete chat
  const deleteChat = useCallback(async (chatId: string): Promise<boolean> => {
    if (!user) {
      const success = localChatStorage.deleteChat(chatId);
      if (success) {
        setChats(prev => prev.filter(chat => chat.id !== chatId));
      }
      return success;
    }

    try {
      const response = await fetch(`/api/threads/${chatId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete chat');
      }

      setChats(prev => prev.filter(chat => chat.id !== chatId));
      return true;
    } catch (err) {
      console.error('Error deleting chat:', err);
      return false;
    }
  }, [user]);

  // Load chats when auth state changes
  useEffect(() => {
    if (!authLoading) {
      loadChats();
    }
  }, [authLoading, loadChats]);

  return {
    chats,
    isLoading,
    error,
    loadChats,
    loadChatMessages,
    createChat,
    addMessage,
    deleteChat,
    isAuthenticated: !!user,
  };
}
