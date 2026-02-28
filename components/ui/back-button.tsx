"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  fallbackUrl?: string;
  label?: string;
  variant?: "default" | "ghost" | "outline" | "secondary" | "link";
  className?: string;
}

export function BackButton({
  fallbackUrl = "/dashboard",
  label = "返回",
  variant = "ghost",
  className = ""
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 2) {
      router.back();
    } else {
      router.push(fallbackUrl);
    }
  };

  return (
    <Button variant={variant} onClick={handleBack} className={className}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
