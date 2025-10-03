"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRightIcon, PaperclipIcon, MicIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ElegantChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
}

export function ElegantChatInput({ 
  value, 
  onChange, 
  onSend, 
  onKeyPress, 
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
        {/* Input Area */}
        <div className="flex items-center gap-2 p-3">
          {/* Attachment Button */}
          <button
            className="flex items-center gap-1 px-2 py-1 text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-all duration-200"
            disabled={disabled}
          >
            <PaperclipIcon className="h-3 w-3" />
            <span className="text-xs">Attach</span>
          </button>

          {/* Text Input */}
          <div className="flex-1 min-h-[28px]">
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyPress={onKeyPress}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask Iris anything..."
              className="min-h-[28px] max-h-16 resize-none border-0 bg-transparent text-sm placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 text-white w-full"
              disabled={disabled}
              rows={1}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              className="p-2 hover:bg-white/5 hover:text-white text-white/70 rounded-md transition-all duration-200"
              disabled={disabled}
            >
              <MicIcon className="h-4 w-4" />
            </button>

            <button
              onClick={onSend}
              disabled={!value.trim() || disabled}
              className="p-2 bg-white/5 text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all duration-200"
            >
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
