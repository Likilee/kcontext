import Image from "next/image";
import { cn } from "@/components/ui/utils";
import type { SiteConfig } from "@/lib/site-config";

const HORIZONTAL_LOGO_DIMENSIONS = {
  width: 695,
  height: 144,
} as const;

const VERTICAL_LOGO_DIMENSIONS = {
  width: 512,
  height: 512,
} as const;

interface BrandLogoProps {
  siteConfig: SiteConfig;
  variant: "horizontal" | "vertical";
  className?: string;
}

export function BrandLogo({ siteConfig, variant, className }: BrandLogoProps) {
  const logo =
    variant === "horizontal"
      ? {
          src: siteConfig.brandAssets.horizontalLogoPath,
          ...HORIZONTAL_LOGO_DIMENSIONS,
        }
      : {
          src: siteConfig.brandAssets.verticalLogoPath,
          ...VERTICAL_LOGO_DIMENSIONS,
        };
  const sizes =
    variant === "horizontal"
      ? "(max-width: 1024px) 184px, 232px"
      : "(max-width: 768px) 240px, 320px";

  return (
    <Image
      src={logo.src}
      alt={`${siteConfig.appName} ${siteConfig.learningLanguageName}`}
      className={cn("block h-auto w-auto object-contain", className)}
      priority={variant === "vertical"}
      sizes={sizes}
      width={logo.width}
      height={logo.height}
    />
  );
}
