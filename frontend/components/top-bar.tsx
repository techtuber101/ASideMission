"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShareIcon, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ControlCenter } from "@/components/control-center";
import { useAuth } from "@/components/AuthProvider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TopBarProps {
  onComputerViewToggle: () => void;
  onShare?: () => void;
  onViewFiles?: () => void;
}

export function TopBar({ onComputerViewToggle, onShare, onViewFiles }: TopBarProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGetStarted = () => {
    router.push('/auth?mode=signup');
  };

  const handleExploreMore = () => {
    router.push('/auth?mode=signin');
  };

  // Don't render until mounted to prevent hydration issues
  if (!mounted) {
    return (
      <div className="flex items-center justify-between w-full px-4 py-2">
        <div className="flex-1"></div>
        <div className="flex items-center gap-3">
          <div className="glass-card flex items-center gap-2 rounded-full px-3 py-1.5 text-sm">
            <span className="text-lg">🪙</span>
            <span className="text-foreground font-medium">3,900</span>
          </div>
          <div className="w-px h-6 bg-border/30"></div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="glass-button h-9 w-9 p-0 text-foreground/60 hover:text-foreground/90 transition-all duration-250"
                  onClick={onShare}
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
                  onClick={onViewFiles}
                >
                  <FileIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="glass-card text-foreground border-white/20 bg-black/80 backdrop-blur-sm">
                <p>View files</p>
              </TooltipContent>
            </Tooltip>
            
            <ControlCenter onComputerViewToggle={onComputerViewToggle} />
          </TooltipProvider>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between w-full px-4 py-2">
      {/* Left side - empty for now */}
      <div className="flex-1"></div>
      
      {/* Right side - reordered content */}
      <div className="flex items-center gap-3">
        {/* Main action buttons first */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="glass-button h-9 w-9 p-0 text-foreground/60 hover:text-foreground/90 transition-all duration-250"
                onClick={onShare}
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
                onClick={onViewFiles}
              >
                <FileIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="glass-card text-foreground border-white/20 bg-black/80 backdrop-blur-sm">
              <p>View files</p>
            </TooltipContent>
          </Tooltip>
          
          <ControlCenter onComputerViewToggle={onComputerViewToggle} />
        </TooltipProvider>
        
        {/* Visual separator line with spacing */}
        <div className="flex items-center">
          <div className="w-0.5 h-6 bg-border/60 ml-3 mr-8"></div>
        </div>
        
        {/* Auth buttons or coins (rightmost) */}
        {user ? (
          // Logged in state - show coins bubble
          <div className="glass-card flex items-center gap-2 rounded-full px-3 py-1.5 text-sm">
            <span className="text-lg">🪙</span>
            <span className="text-foreground font-medium">3,900</span>
          </div>
        ) : (
          // Not logged in state - show auth buttons
          <>
            <Button
              variant="ghost"
              size="sm"
              className="glass-button text-foreground/80 hover:text-foreground hover:bg-white/10"
              onClick={handleExploreMore}
            >
              Explore More
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="glass-button text-foreground/80 hover:text-foreground hover:bg-white/10"
              onClick={handleGetStarted}
            >
              Get Started
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
