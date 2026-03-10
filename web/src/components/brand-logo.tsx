import Image from "next/image";
import { cn } from "@/components/ui/utils";
import type { SiteConfig } from "@/lib/site-config";
import horizontalLogo from "../../public/brand/tubelang-ko-horizontal.png";
import verticalLogo from "../../public/brand/tubelang-ko-vertical.png";

interface BrandLogoProps {
  siteConfig: SiteConfig;
  variant: "horizontal" | "vertical";
  className?: string;
}

export function BrandLogo({ siteConfig, variant, className }: BrandLogoProps) {
  const logo = variant === "horizontal" ? horizontalLogo : verticalLogo;
  const sizes =
    variant === "horizontal"
      ? "(max-width: 1024px) 184px, 232px"
      : "(max-width: 768px) 240px, 320px";

  return (
    <Image
      src={logo}
      alt={`${siteConfig.appName} ${siteConfig.learningLanguageName}`}
      className={cn("block h-auto w-auto object-contain", className)}
      priority={variant === "vertical"}
      sizes={sizes}
    />
  );
}
