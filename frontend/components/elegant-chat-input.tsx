"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRightIcon, PaperclipIcon, MicIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ElegantChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onFileUpload?: () => void;
  disabled?: boolean;
}

export function ElegantChatInput({ 
  value, 
  onChange, 
  onSend, 
  onKeyPress,
  onFileUpload,
  disabled = false 
}: ElegantChatInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative mx-auto max-w-3xl px-4 py-2">
      <motion.div
        className={`glass-card relative transition-all duration-200 ${
          isFocused 
            ? "ring-1 ring-white/20" 
            : "hover:ring-1 hover:ring-white/10"
        }`}
        animate={{
          scale: isFocused ? 1.002 : 1,
        }}
        transition={{ duration: 0.1 }}
      >
        {/* Unified Input Bubble */}
        <div className="flex items-center gap-2 p-4">
          {/* Attachment Button */}
          <button
            className="flex items-center gap-1 px-2 py-1 text-foreground/70 hover:text-foreground hover:bg-white/5 rounded-md transition-all duration-200"
            disabled={disabled}
            onClick={onFileUpload}
          >
            <PaperclipIcon className="h-3 w-3" />
            <span className="text-xs">Attach</span>
          </button>

          {/* Text Input - No separate container */}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={onKeyPress}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Ask Iris anything..."
            className="flex-1 bg-transparent text-sm placeholder:text-foreground/40 focus:outline-none text-foreground min-h-[28px]"
            disabled={disabled}
          />

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              className="p-2 hover:bg-white/5 hover:text-foreground text-foreground/70 rounded-md transition-all duration-200"
              disabled={disabled}
            >
              <MicIcon className="h-4 w-4" />
            </button>

            <button
              onClick={onSend}
              disabled={!value.trim() || disabled}
              className="p-2 bg-white/5 text-foreground hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all duration-200"
            >
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
