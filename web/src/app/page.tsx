"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { SearchBar } from "@/components/search-bar";
import { SuggestionChipList } from "@/components/suggestion-chip-list";
import { TopNavigation } from "@/components/top-navigation";

import { SEARCH_KEYWORDS } from "@/lib/search-keywords";

const SEARCH_SUGGESTIONS = SEARCH_KEYWORDS;

export default function HomePage() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");

  const navigateToSearch = useCallback(
    (keyword: string) => {
      const normalizedKeyword = keyword.trim();
      if (!normalizedKeyword) {
        return;
      }

      router.push(`/search?q=${encodeURIComponent(normalizedKeyword)}`);
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

  return (
    <main className="relative min-h-screen bg-[var(--bg-base)]">
      <TopNavigation
        mode="home"
        searchValue=""
        onSearchValueChange={() => {
          // no-op in home mode
        }}
        onSearchSubmit={() => {
          // no-op in home mode
        }}
        isSearchLoading={false}
        onLogoClick={() => {
          router.push("/");
        }}
      />

      <section className="mx-auto flex min-h-[calc(100dvh-var(--space-layout-section))] w-full max-w-3xl flex-col justify-center px-[var(--space-layout-screen)] pb-[calc(var(--space-layout-section)+var(--space-safe-bottom))] pt-[var(--space-layout-section)]">
        <div className="flex flex-col gap-[var(--space-layout-section)]">
          <div className="flex flex-col gap-[var(--space-gap-group)] text-center">
            <h1 className="font-[family-name:var(--font-family-kr)] text-[length:var(--font-size-28)] font-bold leading-[var(--line-height-tight)] text-[var(--text-primary)]">
              Learn real Korean beyond textbooks.
              <br />
              See it in native context.
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
              ariaLabel="Hero search for Korean context"
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
