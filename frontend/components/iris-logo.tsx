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

  if (!mounted) {
    // Return a placeholder during SSR
    return (
      <div className={`${className} bg-white/10 rounded animate-pulse`} />
    );
  }

  const currentTheme = resolvedTheme || theme;
  const logoSrc = currentTheme === "dark" ? "/assets/irislogowhite.png" : "/assets/irislogo.png";

  return (
    <Image 
      src={logoSrc} 
      alt="Iris Logo" 
      width={width} 
      height={height}
      className={className}
    />
  );
}
