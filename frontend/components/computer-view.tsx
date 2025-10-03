"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Monitor, 
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Globe,
  Wrench,
  Terminal,
  FileText, 
  Search,
  RefreshCw,
  Copy,
  Check,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ToolCall {
  id: string;
  name: string;
  content: string;
  output?: string;
  timestamp: string;
  isSuccess: boolean;
  isStreaming?: boolean;
  type: 'command' | 'browser' | 'file' | 'search';
}

interface ComputerViewProps {
  isOpen: boolean;
  onClose: () => void;
  agentName?: string;
}

// Mock data for demonstration
const mockToolCalls: ToolCall[] = [
    {
      id: "1",
    name: "browser-navigate-to",
    content: "Navigate to https://example.com",
    output: "Successfully navigated to example.com",
    timestamp: "2024-01-15T10:30:00Z",
    isSuccess: true,
    type: 'browser'
    },
    {
      id: "2", 
    name: "command-tool",
    content: "ls -la",
    output: "total 24\ndrwxr-xr-x 3 user user 4096 Jan 15 10:30 .\ndrwxr-xr-x 5 user user 4096 Jan 15 10:25 ..\n-rw-r--r-- 1 user user 1024 Jan 15 10:30 file.txt",
    timestamp: "2024-01-15T10:31:00Z",
    isSuccess: true,
    type: 'command'
    },
    {
      id: "3",
    name: "web-search",
    content: "Search for 'AI tools 2024'",
    output: "Found 15 results about AI tools in 2024...",
    timestamp: "2024-01-15T10:32:00Z",
    isSuccess: true,
    type: 'search'
    },
    {
      id: "4",
    name: "file-read",
    content: "Read package.json",
    output: '{\n  "name": "iris-app",\n  "version": "1.0.0",\n  "dependencies": {...}\n}',
    timestamp: "2024-01-15T10:33:00Z",
    isSuccess: true,
    type: 'file'
  }
];

const getToolIcon = (type: string) => {
  switch (type) {
    case 'command': return Terminal;
    case 'browser': return Globe;
    case 'file': return FileText;
    case 'search': return Search;
    default: return Wrench;
  }
};

const getToolName = (name: string) => {
  const nameMap: Record<string, string> = {
    'browser-navigate-to': 'Navigate to Website',
    'browser-act': 'Browser Action',
    'command-tool': 'Terminal Command',
    'web-search': 'Web Search',
    'file-read': 'Read File',
    'file-write': 'Write File'
  };
  return nameMap[name] || name;
};

interface ViewToggleProps {
  currentView: 'tools' | 'browser';
  onViewChange: (view: 'tools' | 'browser') => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ currentView, onViewChange }) => {
  return (
    <div className="relative flex items-center gap-1 bg-muted rounded-3xl px-1 py-1">
      {/* Sliding background */}
        <motion.div
        className="absolute h-7 w-7 bg-white rounded-xl shadow-sm"
        initial={false}
        animate={{
          x: currentView === 'tools' ? 0 : 32,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30
        }}
      />
      
      {/* Buttons */}
      <Button
        size="sm"
        onClick={() => onViewChange('tools')}
        className={`relative z-10 h-7 w-7 p-0 rounded-xl bg-transparent hover:bg-transparent shadow-none ${
          currentView === 'tools'
            ? 'text-black'
            : 'text-gray-500 dark:text-gray-400'
        }`}
        title="Switch to Tool View"
      >
        <Wrench className="h-3.5 w-3.5" />
      </Button>

      <Button
        size="sm"
        onClick={() => onViewChange('browser')}
        className={`relative z-10 h-7 w-7 p-0 rounded-xl bg-transparent hover:bg-transparent shadow-none ${
          currentView === 'browser'
            ? 'text-black'
            : 'text-gray-500 dark:text-gray-400'
        }`}
        title="Switch to Browser View"
      >
        <Globe className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export function ComputerView({ isOpen, onClose, agentName = "Iris" }: ComputerViewProps) {
  const [toolCalls, setToolCalls] = useState<ToolCall[]>(mockToolCalls);
  const [currentIndex, setCurrentIndex] = useState(toolCalls.length - 1);
  const [navigationMode, setNavigationMode] = useState<'live' | 'manual'>('live');
  const [currentView, setCurrentView] = useState<'tools' | 'browser'>('tools');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const currentToolCall = toolCalls[currentIndex];
  const totalCalls = toolCalls.length;
  const latestIndex = Math.max(0, totalCalls - 1);

  const isLiveMode = navigationMode === 'live';
  const isAtLatest = currentIndex === latestIndex;

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setNavigationMode('manual');
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < latestIndex) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setNavigationMode(nextIndex === latestIndex ? 'live' : 'manual');
    }
  }, [currentIndex, latestIndex]);

  const handleSliderChange = useCallback(([newValue]: [number]) => {
    const bounded = Math.max(0, Math.min(newValue, latestIndex));
    setCurrentIndex(bounded);
    setNavigationMode(bounded === latestIndex ? 'live' : 'manual');
  }, [latestIndex]);

  const jumpToLive = useCallback(() => {
    setNavigationMode('live');
    setCurrentIndex(latestIndex);
  }, [latestIndex]);

  const jumpToLatest = useCallback(() => {
    setNavigationMode('manual');
    setCurrentIndex(latestIndex);
  }, [latestIndex]);

  const handleCopyContent = useCallback(async () => {
    if (!currentToolCall?.output) return;

    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(currentToolCall.output);
      toast.success('Content copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy content');
    }
    setTimeout(() => setIsCopying(false), 500);
  }, [currentToolCall?.output]);

  const renderStatusButton = () => {
    const baseClasses = "flex items-center justify-center gap-1.5 px-2 py-0.5 rounded-full w-[116px]";
    const dotClasses = "w-1.5 h-1.5 rounded-full";
    const textClasses = "text-xs font-medium";

    if (isLiveMode) {
      if (isStreaming) {
        return (
          <div
            className={`${baseClasses} bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors cursor-pointer`}
            onClick={jumpToLive}
          >
            <div className={`${dotClasses} bg-green-500 animate-pulse`} />
            <span className={`${textClasses} text-green-700 dark:text-green-400`}>Live Updates</span>
          </div>
        );
      } else {
        return (
          <div className={`${baseClasses} bg-neutral-50 dark:bg-neutral-900/20 border border-neutral-200 dark:border-neutral-800`}>
            <div className={`${dotClasses} bg-neutral-500`} />
            <span className={`${textClasses} text-neutral-700 dark:text-neutral-400`}>Latest Tool</span>
          </div>
        );
      }
    } else {
      if (isStreaming) {
        return (
          <div
            className={`${baseClasses} bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors cursor-pointer`}
            onClick={jumpToLive}
          >
            <div className={`${dotClasses} bg-green-500 animate-pulse`} />
            <span className={`${textClasses} text-green-700 dark:text-green-400`}>Jump to Live</span>
          </div>
        );
      } else {
        return (
          <div
            className={`${baseClasses} bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer`}
            onClick={jumpToLatest}
          >
            <div className={`${dotClasses} bg-blue-500`} />
            <span className={`${textClasses} text-blue-700 dark:text-blue-400`}>Jump to Latest</span>
          </div>
        );
      }
    }
  };

  const renderToolView = () => {
    if (!currentToolCall) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 p-8">
          <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
            <div className="relative">
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                <Monitor className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-zinc-400 dark:text-zinc-500 rounded-full"></div>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                No tool activity
                  </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Tool calls and computer interactions will appear here when they're being executed.
              </p>
            </div>
          </div>
        </div>
      );
    }

    const ToolIcon = getToolIcon(currentToolCall.type);
    const toolName = getToolName(currentToolCall.name);

    return (
      <div className="flex flex-col h-full">
        {/* Tool Header */}
        <div className="glass-header p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="glass-card flex h-10 w-10 items-center justify-center rounded-full">
                <ToolIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">{toolName}</h3>
                <p className="text-sm text-muted-foreground">{currentToolCall.content}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentToolCall.isStreaming && (
                <Badge variant="outline" className="glass-card gap-1.5 p-2 rounded-3xl">
                  <CircleDashed className="h-3 w-3 animate-spin" />
                  <span>Running</span>
                </Badge>
              )}
              {currentToolCall.output && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="glass-button h-8 w-8"
                  onClick={handleCopyContent}
                  disabled={isCopying}
                >
                  {isCopying ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tool Content */}
        <div className="flex-1 p-4 overflow-auto">
          {currentToolCall.output ? (
            <Card>
              <CardContent className="p-4">
                <pre className="text-sm font-mono whitespace-pre-wrap text-muted-foreground">
                  {currentToolCall.output}
                </pre>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center h-32">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CircleDashed className="h-4 w-4 animate-spin" />
                <span>Executing...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderBrowserView = () => {
    return (
      <div className="flex flex-col h-full">
        {/* Browser Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <Globe className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium">Browser View</h3>
                <p className="text-sm text-muted-foreground">Live browser interaction</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8">
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
                  </Button>
            </div>
          </div>
                </div>

        {/* Browser Content */}
        <div className="flex-1 p-4">
          <div className="h-full bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center border-2 border-zinc-200 dark:border-zinc-700 mx-auto">
                <Globe className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Browser not available
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  No active browser session available. The browser will appear here when a sandbox is created and Browser tools are used.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="glass-sidebar w-96 border-l flex flex-col h-full">
      {/* Header */}
      <div className="glass-header p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="glass-card flex h-10 w-10 items-center justify-center rounded-full">
              <Monitor className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-medium">{agentName}'s Computer</h2>
              <p className="text-sm text-muted-foreground">Tool execution & browser view</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isStreaming && (
              <Badge variant="outline" className="glass-card gap-1.5 p-2 rounded-3xl">
                <CircleDashed className="h-3 w-3 animate-spin" />
                <span>Running</span>
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="glass-button h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="p-4 border-b">
        <ViewToggle currentView={currentView} onViewChange={setCurrentView} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {currentView === 'tools' ? renderToolView() : renderBrowserView()}
      </div>

      {/* Timeline Controls */}
      {totalCalls > 1 && (
        <div className="border-t bg-muted/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                disabled={currentIndex <= 0}
                className="h-7 w-7 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium tabular-nums px-1 min-w-[44px] text-center">
                {currentIndex + 1}/{totalCalls}
              </span>
                      <Button
                        variant="ghost"
                        size="icon"
                onClick={handleNext}
                disabled={currentIndex >= latestIndex}
                className="h-7 w-7 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                      >
                <ChevronRight className="h-4 w-4" />
                      </Button>
            </div>

            <div className="flex-1 relative">
              <Slider
                min={0}
                max={Math.max(0, totalCalls - 1)}
                step={1}
                value={[currentIndex]}
                onValueChange={handleSliderChange}
                className="w-full [&>span:first-child]:h-1.5 [&>span:first-child]:bg-zinc-200 dark:[&>span:first-child]:bg-zinc-800 [&>span:first-child>span]:bg-zinc-500 dark:[&>span:first-child>span]:bg-zinc-400 [&>span:first-child>span]:h-1.5"
              />
                </div>

            <div className="flex items-center gap-1.5">
              {renderStatusButton()}
            </div>
          </div>
                </div>
      )}
    </div>
  );
}