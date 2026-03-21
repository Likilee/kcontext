"use client";

import type { SiteConfig } from "@/lib/site-config";
import { BrandLogo } from "./brand-logo";
import { SearchBar } from "./search-bar";
import { UiLanguageSwitcher } from "./ui-language-switcher";

interface TopNavigationProps {
  mode: "home" | "search";
  siteConfig: SiteConfig;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSearchSubmit: (keyword: string) => void;
  isSearchLoading: boolean;
  onLogoClick: () => void;
}

export function TopNavigation({
  mode,
  siteConfig,
  searchValue,
  onSearchValueChange,
  onSearchSubmit,
  isSearchLoading,
  onLogoClick,
}: TopNavigationProps) {
  const shouldUseMobileSimpleLogo = mode === "search";
  const logoButton = (
    <button
      type="button"
      onClick={onLogoClick}
      className="shrink-0 cursor-pointer"
      aria-label={siteConfig.copy.homeAriaLabel}
    >
      {shouldUseMobileSimpleLogo ? (
        <BrandLogo
          siteConfig={siteConfig}
          variant="simple"
          className="h-[calc(var(--font-size-20)+var(--space-gap-item))] w-auto sm:hidden"
        />
      ) : null}
      <BrandLogo
        siteConfig={siteConfig}
        variant="horizontal"
        className={
          shouldUseMobileSimpleLogo
            ? "hidden h-[calc(var(--font-size-20)+var(--space-gap-item))] w-auto sm:block lg:h-[calc(var(--font-size-28)+var(--space-gap-item))]"
            : "h-[calc(var(--font-size-20)+var(--space-gap-item))] w-auto lg:h-[calc(var(--font-size-28)+var(--space-gap-item))]"
        }
      />
    </button>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/95 backdrop-blur-md">
      <div className="mx-auto w-full max-w-6xl px-[var(--space-layout-screen)] pb-[var(--space-inset-squish-y)] pt-[calc(var(--space-inset-squish-y)+var(--space-safe-top))]">
        <div className="flex h-[calc(var(--space-layout-section)-var(--space-gap-item))] items-center">
          {mode === "home" ? (
            <div className="flex w-full items-center justify-between gap-[var(--space-gap-item)]">
              {logoButton}
              <UiLanguageSwitcher siteConfig={siteConfig} />
            </div>
          ) : (
            <div className="flex w-full items-center gap-[var(--space-gap-item)]">
              {logoButton}
              <div className="min-w-0 flex-1">
                <SearchBar
                  value={searchValue}
                  onChange={onSearchValueChange}
                  onSearch={onSearchSubmit}
                  isLoading={isSearchLoading}
                  variant="compact"
                  inputId="global-search-input"
                  placeholderText={siteConfig.copy.searchPlaceholder}
                  ariaLabel={siteConfig.copy.globalSearchAriaLabel}
                  clearAriaLabel={siteConfig.copy.clearSearchInputAriaLabel}
                  submitAriaLabel={siteConfig.copy.submitSearchAriaLabel}
                />
              </div>
              <UiLanguageSwitcher siteConfig={siteConfig} />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
