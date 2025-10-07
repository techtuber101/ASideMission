'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  Bell, 
  Palette, 
  Settings, 
  BarChart3,
  Monitor,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ControlCenterProps {
  onComputerViewToggle: () => void;
}

export function ControlCenter({ onComputerViewToggle }: ControlCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const menuItems = [
    {
      id: 'home',
      icon: Home,
      label: 'Home',
      action: () => router.push('/')
    },
    {
      id: 'updates',
      icon: Bell,
      label: 'Updates',
      action: () => console.log('Updates clicked')
    },
    {
      id: 'theme',
      icon: Palette,
      label: 'Theme',
      action: () => setTheme(theme === 'light' ? 'dark' : 'light')
    },
    {
      id: 'computer',
      icon: Monitor,
      label: 'Computer View',
      action: onComputerViewToggle
    },
    {
      id: 'analytics',
      icon: BarChart3,
      label: 'Analytics',
      action: () => console.log('Analytics clicked')
    },
    {
      id: 'settings',
      icon: Settings,
      label: 'Settings',
      action: () => console.log('Settings clicked')
    }
  ];

  const radius = 70; // Distance from center
  const startAngle = Math.PI; // Start from left (180 degrees)
  const endAngle = 0; // End at right (0 degrees)
  const angleStep = (endAngle - startAngle) / (menuItems.length - 1);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    const timeout = setTimeout(() => {
      if (isHovered) {
        setIsOpen(true);
      }
    }, 1000); // 1 second delay
    setHoverTimeout(timeout);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    // Only close on hover leave if not clicked open
    if (!isOpen) {
      setIsOpen(false);
    }
  };

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  // Keyboard shortcut: Tab key opens computer view
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault(); // Prevent default tab behavior
        onComputerViewToggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onComputerViewToggle]);

  return (
    <TooltipProvider>
      <div className="relative">
        {/* Control Center Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onClick={handleClick}
              className="glass-button h-9 w-9 p-0 hover:bg-white/10 text-foreground/70 hover:text-foreground transition-all duration-200"
            >
              <div className="w-4 h-4 border-2 border-current rounded-full"></div>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="glass-card text-foreground border-white/10 dark:border-white/5 bg-white/10 dark:bg-black/10 backdrop-blur-sm">
            <p>Control Center</p>
          </TooltipContent>
        </Tooltip>

      {/* Semi-Circular Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Menu Items */}
            <div className="absolute top-0 left-0 z-50">
              {menuItems.map((item, index) => {
                const angle = startAngle + (index * angleStep);
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius + 20; // Offset below the button
                
                return (
                  <motion.div
                    key={item.id}
                    initial={{ 
                      scale: 0, 
                      opacity: 0,
                      x: 0,
                      y: 0
                    }}
                    animate={{ 
                      scale: 1, 
                      opacity: 1,
                      x: x,
                      y: y
                    }}
                    exit={{ 
                      scale: 0, 
                      opacity: 0,
                      x: 0,
                      y: 0
                    }}
                    transition={{ 
                      delay: index * 0.05,
                      type: "spring",
                      stiffness: 300,
                      damping: 20
                    }}
                    className="absolute"
                    style={{ transform: `translate(${x}px, ${y}px)` }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        item.action();
                        setIsOpen(false);
                      }}
                      className="glass-button h-10 w-10 p-0 hover:scale-110 transition-all duration-200 group relative"
                    >
                      <item.icon className="h-4 w-4 text-foreground/70 group-hover:text-foreground" />
                      
                      {/* Tooltip */}
                      <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                        <div className="glass-card px-3 py-1 text-xs text-foreground whitespace-nowrap border border-white/10 dark:border-white/5 bg-white/10 dark:bg-black/10 backdrop-blur-sm">
                          {item.label}
                        </div>
                      </div>
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
