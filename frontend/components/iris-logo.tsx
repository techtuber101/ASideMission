"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface IrisLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function IrisLogo({ width = 20, height = 20, className = "h-5 w-5" }: IrisLogoProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Use white logo for dark mode, regular logo for light mode
  // Default to white logo during SSR/hydration to prevent hydration mismatch
  const logoSrc = mounted && (theme === "light" || resolvedTheme === "light") ? "/irislogo.png" : "/irislogowhite.png";
  
  return (
    <Image 
      src={logoSrc} 
      alt="Iris Logo" 
      width={width} 
      height={height}
      className={className}
      quality={100}
      priority
      unoptimized
    />
  );
}
