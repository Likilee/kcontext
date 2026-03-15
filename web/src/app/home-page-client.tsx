"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { SearchBar } from "@/components/search-bar";
import { SuggestionChipList } from "@/components/suggestion-chip-list";
import { TopNavigation } from "@/components/top-navigation";
import { getKoreanSearchPath, KOREAN_HOME_PATH } from "@/lib/app-routes";
import { SEARCH_KEYWORDS } from "@/lib/search-keywords";
import type { SiteConfig } from "@/lib/site-config";

const SEARCH_SUGGESTIONS = SEARCH_KEYWORDS;

interface HomePageClientProps {
  siteConfig: SiteConfig;
}

export function HomePageClient({ siteConfig }: HomePageClientProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");

  const navigateToSearch = useCallback(
    (keyword: string) => {
      const normalizedKeyword = keyword.trim();
      if (!normalizedKeyword) {
        return;
      }

      router.push(getKoreanSearchPath(normalizedKeyword));
    },
    [router],
  );

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      setSearchInput(suggestion);
      navigateToSearch(suggestion);
    },
    [navigateToSearch],
  );

  const [headlineTop, headlineBottom] = siteConfig.copy.homeHeadline;

  return (
    <main className="relative min-h-screen bg-[var(--bg-base)]">
      <TopNavigation
        mode="home"
        siteConfig={siteConfig}
        searchValue=""
        onSearchValueChange={() => {
          // no-op in home mode
        }}
        onSearchSubmit={() => {
          // no-op in home mode
        }}
        isSearchLoading={false}
        onLogoClick={() => {
          router.push(KOREAN_HOME_PATH);
        }}
      />

      <section className="mx-auto flex min-h-[calc(100dvh-var(--space-layout-section))] w-full max-w-3xl flex-col justify-center px-[var(--space-layout-screen)] pb-[calc(var(--space-layout-section)+var(--space-safe-bottom))] pt-[var(--space-layout-section)]">
        <div className="flex flex-col gap-[var(--space-layout-section)]">
          <div className="flex flex-col gap-[var(--space-gap-group)] text-center">
            <h1 className="font-[family-name:var(--font-family-kr)] text-[length:var(--font-size-28)] font-bold leading-[var(--line-height-tight)] text-[var(--text-primary)]">
              {headlineTop}
              <br />
              {headlineBottom}
            </h1>
          </div>

          <div className="flex flex-col gap-[var(--space-gap-group)]">
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              onSearch={navigateToSearch}
              isLoading={false}
              inputId="hero-search-input"
              variant="hero"
              dynamicPlaceholder
              placeholderText={siteConfig.copy.searchPlaceholder}
              ariaLabel={siteConfig.copy.heroSearchAriaLabel}
              clearAriaLabel={siteConfig.copy.clearSearchInputAriaLabel}
              submitAriaLabel={siteConfig.copy.submitSearchAriaLabel}
            />

            <SuggestionChipList
              suggestions={SEARCH_SUGGESTIONS}
              onSelect={handleSuggestionSelect}
              wrap
            />
          </div>
        </div>
      </section>
    </main>
  );
}
