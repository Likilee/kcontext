"use client";

import { SearchBar } from "./search-bar";

interface TopNavigationProps {
  mode: "home" | "search";
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSearchSubmit: (keyword: string) => void;
  isSearchLoading: boolean;
  onLogoClick: () => void;
}

export function TopNavigation({
  mode,
  searchValue,
  onSearchValueChange,
  onSearchSubmit,
  isSearchLoading,
  onLogoClick,
}: TopNavigationProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/95 backdrop-blur-md">
      <div className="mx-auto w-full max-w-6xl px-[var(--space-layout-screen)] pb-[var(--space-inset-squish-y)] pt-[calc(var(--space-inset-squish-y)+var(--space-safe-top))]">
        {mode === "home" ? (
          <button
            type="button"
            onClick={onLogoClick}
            className="font-[family-name:var(--font-family-kr)] text-[length:var(--font-size-18)] font-bold text-[var(--text-primary)]"
            aria-label="Go to home"
          >
            kcontext
          </button>
        ) : (
          <div className="flex items-center gap-[var(--space-gap-item)]">
            <button
              type="button"
              onClick={onLogoClick}
              className="shrink-0 font-[family-name:var(--font-family-kr)] text-[length:var(--font-size-18)] font-bold text-[var(--text-primary)]"
              aria-label="Go to home"
            >
              kcontext
            </button>
            <div className="min-w-0 flex-1">
              <SearchBar
                value={searchValue}
                onChange={onSearchValueChange}
                onSearch={onSearchSubmit}
                isLoading={isSearchLoading}
                variant="compact"
                inputId="global-search-input"
                ariaLabel="Global search for real Korean"
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
