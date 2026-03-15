"use client";

import type { SiteConfig } from "@/lib/site-config";
import { BrandLogo } from "./brand-logo";
import { SearchBar } from "./search-bar";

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
  const logoButton = (
    <button
      type="button"
      onClick={onLogoClick}
      className="shrink-0 cursor-pointer"
      aria-label={siteConfig.copy.homeAriaLabel}
    >
      <BrandLogo
        siteConfig={siteConfig}
        variant="horizontal"
        className="h-[calc(var(--font-size-20)+var(--space-gap-item))] w-auto lg:h-[calc(var(--font-size-28)+var(--space-gap-item))]"
      />
    </button>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/95 backdrop-blur-md">
      <div className="mx-auto w-full max-w-6xl px-[var(--space-layout-screen)] pb-[var(--space-inset-squish-y)] pt-[calc(var(--space-inset-squish-y)+var(--space-safe-top))]">
        <div className="flex h-[calc(var(--space-layout-section)-var(--space-gap-item))] items-center">
          {mode === "home" ? (
            logoButton
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
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
