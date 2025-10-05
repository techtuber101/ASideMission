'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { localChatStorage, LocalChat } from '@/lib/stores/local-chats';
import { useAuth } from '@/components/AuthProvider';

interface SyncDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface SyncStatus {
  chatId: string;
  status: 'pending' | 'syncing' | 'completed' | 'error';
  cloudThreadId?: string;
  error?: string;
}

export function SyncDialog({ isOpen, onClose, onComplete }: SyncDialogProps) {
  const { user } = useAuth();
  const [localChats] = useState<LocalChat[]>(() => localChatStorage.getAllChats());
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const handleSync = async () => {
    if (!user) return;

    setIsSyncing(true);
    setCompletedCount(0);

    // Initialize sync statuses
    const initialStatuses: SyncStatus[] = localChats.map(chat => ({
      chatId: chat.id,
      status: 'pending',
    }));
    setSyncStatuses(initialStatuses);

    // Sync each chat
    for (let i = 0; i < localChats.length; i++) {
      const chat = localChats[i];
      
      // Update status to syncing
      setSyncStatuses(prev => prev.map(status => 
        status.chatId === chat.id 
          ? { ...status, status: 'syncing' }
          : status
      ));

      try {
        // Call sync endpoint
        const response = await fetch('/api/threads/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.access_token}`,
          },
          body: JSON.stringify({
            messages: chat.messages.map(msg => ({
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp,
              type: msg.role === 'user' ? 'user' : 'assistant',
              is_llm_message: true,
            })),
            title: chat.title,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to sync chat: ${response.statusText}`);
        }

        const result = await response.json();
        
        // Mark as completed
        setSyncStatuses(prev => prev.map(status => 
          status.chatId === chat.id 
            ? { 
                ...status, 
                status: 'completed', 
                cloudThreadId: result.thread_id 
              }
            : status
        ));

        // Mark chat as synced in local storage
        localChatStorage.markChatAsSynced(chat.id, result.thread_id);
        
        setCompletedCount(prev => prev + 1);

      } catch (error) {
        console.error(`Error syncing chat ${chat.id}:`, error);
        
        // Mark as error
        setSyncStatuses(prev => prev.map(status => 
          status.chatId === chat.id 
            ? { 
                ...status, 
                status: 'error', 
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            : status
        ));
      }
    }

    setIsSyncing(false);
  };

  const handleSkip = () => {
    onClose();
    onComplete();
  };

  const handleComplete = () => {
    // Remove synced chats from local storage
    localChatStorage.removeSyncedChats();
    onClose();
    onComplete();
  };

  const allCompleted = completedCount === localChats.length;
  const hasErrors = syncStatuses.some(status => status.status === 'error');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Sync Local Chats
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    disabled={isSyncing}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  We found {localChats.length} local chat{localChats.length !== 1 ? 's' : ''} that can be synced to your account.
                </p>

                {localChats.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Chats to sync:</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {localChats.map((chat, index) => {
                        const status = syncStatuses.find(s => s.chatId === chat.id);
                        return (
                          <div
                            key={chat.id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{chat.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {chat.messages.length} message{chat.messages.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {status?.status === 'pending' && (
                                <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />
                              )}
                              {status?.status === 'syncing' && (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                              )}
                              {status?.status === 'completed' && (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              )}
                              {status?.status === 'error' && (
                                <div className="w-4 h-4 rounded-full bg-red-500" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {hasErrors && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50">
                    <p className="text-sm text-red-800 dark:text-red-400">
                      Some chats failed to sync. You can try again later or continue without syncing them.
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  {!isSyncing && !allCompleted && (
                    <>
                      <Button onClick={handleSync} className="flex-1">
                        <Upload className="h-4 w-4 mr-2" />
                        Sync All Chats
                      </Button>
                      <Button variant="outline" onClick={handleSkip}>
                        Skip
                      </Button>
                    </>
                  )}
                  
                  {isSyncing && (
                    <Button disabled className="flex-1">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing... ({completedCount}/{localChats.length})
                    </Button>
                  )}
                  
                  {allCompleted && (
                    <Button onClick={handleComplete} className="flex-1">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Complete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
