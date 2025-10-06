'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Terminal,
  FileText,
  Globe,
  Code,
  Monitor,
  Activity,
  Loader2,
  Brain,
  Zap,
  Eye,
  Search,
  Wrench
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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


interface ComputerViewProps {
  toolCalls: ToolCallViewModel[];
  isVisible: boolean;
  onToggle: () => void;
}

export function ComputerView({ toolCalls, isVisible, onToggle }: ComputerViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-scroll to latest tool call when new ones are added
  useEffect(() => {
    if (toolCalls.length > 0) {
      setCurrentIndex(toolCalls.length - 1);
    }
  }, [toolCalls.length]);

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'task_list':
        return <Brain className="h-5 w-5" />;
      case 'shell':
        return <Terminal className="h-5 w-5" />;
      case 'web_search':
        return <Search className="h-5 w-5" />;
      case 'web_scrape':
        return <Eye className="h-5 w-5" />;
      case 'file_operations':
        return <FileText className="h-5 w-5" />;
      case 'browser_automation':
        return <Globe className="h-5 w-5" />;
      // Legacy tool names for compatibility
      case 'file':
        return <FileText className="h-5 w-5" />;
      case 'code':
        return <Code className="h-5 w-5" />;
      case 'browser':
        return <Globe className="h-5 w-5" />;
      case 'computer':
        return <Monitor className="h-5 w-5" />;
      default:
        return <Zap className="h-5 w-5" />;
    }
  };

  const getToolDescription = (toolName: string, args: Record<string, any>) => {
    switch (toolName) {
      case 'task_list':
        return `Task management: ${args?.action || 'organizing workflow'}`;
      case 'shell':
        return `Shell command: ${args?.command || args?.action || 'system operation'}`;
      case 'web_search':
        return `Web search: ${args?.query || 'finding information'}`;
      case 'web_scrape':
        return `Web scraping: ${args?.urls || args?.url || 'extracting content'}`;
      case 'file_operations':
        return `File operation: ${args?.action || 'managing files'}`;
      case 'browser_automation':
        return `Browser action: ${args?.action || 'web automation'}`;
      // Legacy tool names for compatibility
      case 'file':
        return `File operation: ${args?.operation || args?.action || 'accessing files'}`;
      case 'code':
        return `Code execution: ${args?.language || 'programming'}`;
      case 'browser':
        return `Browser action: ${args?.action || 'web interaction'}`;
      case 'computer':
        return `System access: ${args?.operation || args?.action || 'computer control'}`;
      default:
        return 'Agent activity in progress';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };


  const renderTimelineView = () => (
    <div className="space-y-4">
      {toolCalls.length > 0 && (
        <Card className="glass-card border-l-4 border-l-blue-400">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="glass-card flex h-10 w-10 items-center justify-center rounded-full">
                {getToolIcon(toolCalls[currentIndex].name)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {toolCalls[currentIndex].name.replace('_', ' ').toUpperCase()}
                  </span>
                  {getStatusIcon(toolCalls[currentIndex].status)}
                </div>
                <p className="text-sm text-foreground/70 font-normal">
                  {getToolDescription(toolCalls[currentIndex].name, toolCalls[currentIndex].args)}
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {toolCalls[currentIndex].args && Object.keys(toolCalls[currentIndex].args).length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-foreground/70">Parameters</h4>
                <div className="glass-card p-3">
                  <pre className="text-xs overflow-x-auto text-foreground/80">
                    {JSON.stringify(toolCalls[currentIndex].args, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {toolCalls[currentIndex].status === 'completed' && toolCalls[currentIndex].result && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-foreground/70">Result</h4>
                <div className="glass-card p-3 border-l-4 border-l-green-400">
                  <pre className="text-xs overflow-x-auto max-h-60 text-green-300">
                    {JSON.stringify(toolCalls[currentIndex].result, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {toolCalls[currentIndex].status === 'error' && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-red-400">Error</h4>
                <div className="glass-card p-3 border-l-4 border-l-red-400">
                  <pre className="text-xs text-red-300">
                    {toolCalls[currentIndex].result?.error || 'Unknown error occurred'}
                  </pre>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-foreground/60 pt-2 border-t border-white/10">
              <div className="flex items-center gap-4">
                <span>
                  Started: {new Date(toolCalls[currentIndex].startTime).toLocaleTimeString()}
                </span>
                {toolCalls[currentIndex].endTime && (
                  <span>
                    Duration: {Math.round(toolCalls[currentIndex].endTime - toolCalls[currentIndex].startTime)}ms
                  </span>
                )}
              </div>
              {toolCalls[currentIndex].cached && (
                <Badge variant="secondary" className="glass-card text-xs px-2 py-1">
                  Cached
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {toolCalls.length === 0 && (
        <div className="text-center py-12 text-foreground/60">
          <div className="glass-card flex h-16 w-16 items-center justify-center rounded-full mx-auto mb-4">
            <Brain className="h-8 w-8 text-foreground/70" />
          </div>
          <h3 className="text-lg font-medium mb-2 text-foreground">Iris is Ready</h3>
          <p className="text-sm">Agent activities will appear here as they execute</p>
        </div>
      )}
    </div>
  );


  if (!isVisible) {
    return (
      <div className="w-12 h-full glass-card flex items-center justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="glass-button h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4 text-foreground/70" />
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 578, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="glass-card flex flex-col flex-shrink-0 mr-4 mb-8 mt-4"
      style={{ height: 'calc(100vh - 10rem)' }}
    >
      {/* Header */}
      <div className="glass-header p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="glass-card flex h-10 w-10 items-center justify-center rounded-full">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Iris Agent Activity</h2>
              <p className="text-sm text-white/70">Real-time agent execution timeline</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="glass-button h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4 text-foreground/70" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderTimelineView()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation - Always visible, positioned at bottom */}
      <div className="glass-header p-4 border-t border-white/10">
        <div className="flex items-center justify-between w-full">
          {/* Navigation Controls */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0 || toolCalls.length === 0}
              className="glass-button h-9 w-9 p-0 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4 text-foreground/70" />
            </Button>
            
            {/* Tool Call Counter */}
            <div className="glass-card flex items-center gap-2 px-4 py-2">
              <span className="text-sm font-medium text-foreground tabular-nums">
                {toolCalls.length > 0 ? `${currentIndex + 1} of ${toolCalls.length}` : '0 of 0'}
              </span>
              {toolCalls.length > 0 && (
                <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentIndex(Math.min(toolCalls.length - 1, currentIndex + 1))}
              disabled={currentIndex === toolCalls.length - 1 || toolCalls.length === 0}
              className="glass-button h-9 w-9 p-0 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4 text-foreground/70" />
            </Button>
          </div>
          
          {/* Timeline Label */}
          <div className="glass-card flex items-center gap-2 px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-medium text-foreground/70">Agent Timeline</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
