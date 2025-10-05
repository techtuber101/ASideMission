"use client";

import Image from "next/image";

interface IrisLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function IrisLogo({ width = 20, height = 20, className = "h-5 w-5" }: IrisLogoProps) {
  // Use the white logo by default since we're in dark mode
  return (
    <Image 
      src="/irislogowhite.png" 
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
