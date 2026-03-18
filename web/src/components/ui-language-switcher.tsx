"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition } from "react";
import { getUiLanguageSwitchPath } from "@/lib/app-routes";
import { type SiteConfig, UI_LANGUAGE_COOKIE_NAME, type UiLanguageCode } from "@/lib/site-config";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const UI_LANGUAGE_OPTIONS: readonly {
  readonly code: UiLanguageCode;
  readonly label: string;
  readonly getAriaLabel: (copy: SiteConfig["copy"]) => string;
}[] = [
  {
    code: "en",
    label: "EN",
    getAriaLabel: (copy) => copy.switchToEnglishLabel,
  },
  {
    code: "ko",
    label: "KO",
    getAriaLabel: (copy) => copy.switchToKoreanLabel,
  },
];

function persistUiLanguage(uiLanguageCode: UiLanguageCode) {
  // biome-ignore lint/suspicious/noDocumentCookie: client-side UI language persistence needs a broad browser fallback.
  document.cookie = `${UI_LANGUAGE_COOKIE_NAME}=${encodeURIComponent(uiLanguageCode)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

interface UiLanguageSwitcherProps {
  readonly siteConfig: Pick<SiteConfig, "uiLanguageCode" | "copy">;
}

export function UiLanguageSwitcher({ siteConfig }: UiLanguageSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <fieldset
      aria-label={siteConfig.copy.uiLanguageSwitcherLabel}
      data-testid="ui-language-switcher"
      className="flex items-center gap-[var(--space-gap-micro)]"
    >
      {UI_LANGUAGE_OPTIONS.map((option) => {
        const isActive = option.code === siteConfig.uiLanguageCode;

        return (
          <Button
            key={option.code}
            type="button"
            size="compact"
            variant={isActive ? "accent" : "ghost"}
            data-testid={`ui-language-btn-${option.code}`}
            aria-label={option.getAriaLabel(siteConfig.copy)}
            aria-pressed={isActive}
            className={cn(
              "min-h-[calc(var(--space-gap-group)+var(--space-gap-item))] min-w-[calc(var(--space-layout-section)-var(--space-gap-item))] px-[var(--space-gap-item)] text-[length:var(--font-size-13)] font-semibold",
              isActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]",
            )}
            onClick={() => {
              persistUiLanguage(option.code);
              startTransition(() => {
                router.push(
                  getUiLanguageSwitchPath({
                    pathname,
                    search: searchParams.toString(),
                    uiLanguageCode: option.code,
                  }),
                );
              });
            }}
          >
            {option.label}
          </Button>
        );
      })}
    </fieldset>
  );
}
