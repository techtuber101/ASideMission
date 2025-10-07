"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { 
  User, 
  Settings, 
  CreditCard, 
  Plug, 
  Palette, 
  LogOut,
  ChevronDown,
  Sun,
  Moon,
  LogIn,
  UserPlus,
  Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase/client";

interface AccountButtonProps {
  // Remove the user prop since we'll get it from auth context
}

export function AccountButton({}: AccountButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsOpen(false);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleLogin = () => {
    router.push('/auth?mode=signin');
    setIsOpen(false);
  };

  const handleSignUp = () => {
    router.push('/auth?mode=signup');
    setIsOpen(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const getUserDisplayName = () => {
    if (!user) return "Guest";
    return user.user_metadata?.full_name || user.email?.split('@')[0] || "User";
  };

  const getUserEmail = () => {
    if (!user) return "";
    return user.email || "";
  };

  const getUserAvatar = () => {
    if (!user) return null;
    return user.user_metadata?.avatar_url || null;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="glass-button h-10 w-10 rounded-full p-0 hover:bg-white/10 text-foreground/70 hover:text-foreground"
        >
          <Avatar className="h-8 w-8">
            {getUserAvatar() && <AvatarImage src={getUserAvatar()} alt={getUserDisplayName()} />}
            <AvatarFallback className="text-xs font-medium">
              {getInitials(getUserDisplayName())}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="glass-card w-56 ml-2" 
        align="end" 
        alignOffset={0}
        side="top"
        sideOffset={8}
      >
        {user ? (
          // Authenticated user menu
          <>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-3 px-2 py-2">
                <Avatar className="h-8 w-8">
                  {getUserAvatar() && <AvatarImage src={getUserAvatar()} alt={getUserDisplayName()} />}
                  <AvatarFallback className="text-xs font-medium">
                    {getInitials(getUserDisplayName())}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{getUserDisplayName()}</span>
                  <span className="text-xs text-muted-foreground">{getUserEmail()}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="cursor-pointer text-foreground">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-foreground">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-foreground">
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Billing</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-foreground">
                <Plug className="mr-2 h-4 w-4" />
                <span>Integrations</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer text-foreground"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              >
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span>Theme</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </>
        ) : (
          // Unauthenticated user menu
          <>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-3 px-2 py-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs font-medium bg-muted">
                    GU
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">Guest User</span>
                  <span className="text-xs text-muted-foreground">Not signed in</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem 
                className="cursor-pointer text-foreground"
                onClick={handleLogin}
              >
                <LogIn className="mr-2 h-4 w-4" />
                <span>Sign In</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer text-foreground"
                onClick={handleSignUp}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                <span>Sign Up</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer text-foreground"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              >
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span>Theme</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
