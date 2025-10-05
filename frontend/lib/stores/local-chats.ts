/**
 * Local chat storage using localStorage
 * Provides CRUD operations for chats when user is not authenticated
 */

export interface LocalMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  artifacts?: Array<{
    path: string;
    size: number;
  }>;
}

export interface LocalChat {
  id: string;
  title: string;
  messages: LocalMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'iris_local_chats';
const MAX_CHATS = 50; // Limit to prevent localStorage bloat

export class LocalChatStorage {
  private static instance: LocalChatStorage;
  
  static getInstance(): LocalChatStorage {
    if (!LocalChatStorage.instance) {
      LocalChatStorage.instance = new LocalChatStorage();
    }
    return LocalChatStorage.instance;
  }

  private constructor() {}

  private getChats(): LocalChat[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const chats = JSON.parse(stored) as LocalChat[];
      return Array.isArray(chats) ? chats : [];
    } catch (error) {
      console.error('Error reading local chats:', error);
      return [];
    }
  }

  private saveChats(chats: LocalChat[]): void {
    try {
      // Sort by updatedAt descending and limit to MAX_CHATS
      const sortedChats = chats
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_CHATS);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sortedChats));
    } catch (error) {
      console.error('Error saving local chats:', error);
    }
  }

  private generateId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTitle(firstMessage: string): string {
    // Extract meaningful title from first message
    const words = firstMessage.trim().split(' ').slice(0, 6);
    const title = words.join(' ');
    return title.length > 50 ? title.substring(0, 50) + '...' : title;
  }

  // CRUD Operations
  createChat(firstMessage?: string): LocalChat {
    const now = Date.now();
    const title = firstMessage ? this.generateTitle(firstMessage) : 'New Chat';
    
    const chat: LocalChat = {
      id: this.generateId(),
      title,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    const chats = this.getChats();
    chats.unshift(chat); // Add to beginning
    this.saveChats(chats);
    
    return chat;
  }

  getChat(chatId: string): LocalChat | null {
    const chats = this.getChats();
    return chats.find(chat => chat.id === chatId) || null;
  }

  getAllChats(): LocalChat[] {
    return this.getChats();
  }

  updateChat(chatId: string, updates: Partial<Pick<LocalChat, 'title' | 'messages'>>): LocalChat | null {
    const chats = this.getChats();
    const chatIndex = chats.findIndex(chat => chat.id === chatId);
    
    if (chatIndex === -1) return null;

    chats[chatIndex] = {
      ...chats[chatIndex],
      ...updates,
      updatedAt: Date.now(),
    };

    this.saveChats(chats);
    return chats[chatIndex];
  }

  addMessage(chatId: string, message: Omit<LocalMessage, 'id'>): LocalMessage | null {
    const chats = this.getChats();
    const chatIndex = chats.findIndex(chat => chat.id === chatId);
    
    if (chatIndex === -1) return null;

    const newMessage: LocalMessage = {
      ...message,
      id: this.generateId(),
    };

    chats[chatIndex].messages.push(newMessage);
    chats[chatIndex].updatedAt = Date.now();

    // Update title if this is the first message
    if (chats[chatIndex].messages.length === 1 && message.role === 'user') {
      chats[chatIndex].title = this.generateTitle(message.content);
    }

    this.saveChats(chats);
    return newMessage;
  }

  deleteChat(chatId: string): boolean {
    const chats = this.getChats();
    const initialLength = chats.length;
    const filteredChats = chats.filter(chat => chat.id !== chatId);
    
    if (filteredChats.length === initialLength) return false;
    
    this.saveChats(filteredChats);
    return true;
  }

  clearAllChats(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Utility methods
  getChatCount(): number {
    return this.getChats().length;
  }

  hasChats(): boolean {
    return this.getChatCount() > 0;
  }

  // Export/Import for sync
  exportChats(): LocalChat[] {
    return this.getChats();
  }

  importChats(chats: LocalChat[]): void {
    if (!Array.isArray(chats)) return;
    
    const validChats = chats.filter(chat => 
      chat.id && 
      chat.title && 
      Array.isArray(chat.messages) &&
      typeof chat.createdAt === 'number'
    );
    
    this.saveChats(validChats);
  }

  // Sync helpers
  markChatAsSynced(chatId: string, cloudThreadId: string): void {
    const chats = this.getChats();
    const chatIndex = chats.findIndex(chat => chat.id === chatId);
    
    if (chatIndex === -1) return;

    // Add sync metadata
    chats[chatIndex] = {
      ...chats[chatIndex],
      updatedAt: Date.now(),
      // Store cloud thread ID for reference
      metadata: {
        ...chats[chatIndex].metadata,
        cloudThreadId,
        syncedAt: Date.now(),
      },
    };

    this.saveChats(chats);
  }

  removeSyncedChats(): void {
    const chats = this.getChats();
    const unsyncedChats = chats.filter(chat => 
      !chat.metadata?.cloudThreadId
    );
    
    this.saveChats(unsyncedChats);
  }
}

// Export singleton instance
export const localChatStorage = LocalChatStorage.getInstance();
