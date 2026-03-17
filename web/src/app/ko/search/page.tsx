import type { Metadata } from "next";
import { Suspense } from "react";
import { getRequestSiteConfig } from "../../request-site-config";
import { SearchPageClient } from "../../search/search-page-client";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
};

function SearchPageSkeleton() {
  return (
    <main className="relative min-h-screen bg-[var(--bg-base)] pb-[calc(var(--space-layout-section)+var(--space-safe-bottom))]">
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/95 backdrop-blur-md">
        <div className="mx-auto w-full max-w-6xl px-[var(--space-layout-screen)] pb-[var(--space-inset-squish-y)] pt-[calc(var(--space-inset-squish-y)+var(--space-safe-top))]">
          <div className="flex items-center gap-[var(--space-gap-item)]">
            <div className="h-[calc(var(--font-size-20)+var(--space-gap-item))] w-40 animate-pulse rounded-[var(--radius-04)] bg-[var(--bg-surface)] lg:h-[calc(var(--font-size-28)+var(--space-gap-item))]" />
            <div className="h-10 min-w-0 flex-1 animate-pulse rounded-[var(--radius-pill)] border border-[var(--border-default)] bg-[var(--bg-surface)]" />
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-gap-group)] px-[var(--space-layout-screen)] pt-[var(--space-gap-group)]">
        <div className="h-10 w-full animate-pulse rounded-[var(--radius-pill)] border border-[var(--border-default)] bg-[var(--bg-surface)]" />

        <div className="-mx-[var(--space-layout-screen)] w-[calc(100%+var(--space-layout-screen)+var(--space-layout-screen))] lg:mx-0 lg:w-full">
          <div className="aspect-video w-full animate-pulse bg-[var(--bg-surface)]" />
          <div className="flex flex-col gap-[var(--space-gap-item)] rounded-b-[var(--radius-08)] border border-t-0 border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-inset-base)]">
            <div className="h-[var(--font-size-20)] w-11/12 animate-pulse rounded-[var(--radius-04)] bg-[var(--bg-surface-hover)]" />
            <div className="h-[var(--font-size-20)] w-8/12 animate-pulse rounded-[var(--radius-04)] bg-[var(--bg-surface-hover)]" />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-md items-center gap-[var(--space-gap-item)]">
          <div className="h-10 flex-1 animate-pulse rounded-[var(--radius-pill)] bg-[var(--bg-surface)]" />
          <div className="h-10 flex-1 animate-pulse rounded-[var(--radius-pill)] bg-[var(--bg-surface)]" />
          <div className="h-10 flex-1 animate-pulse rounded-[var(--radius-pill)] bg-[var(--bg-surface)]" />
          <div className="h-10 w-20 animate-pulse rounded-[var(--radius-pill)] bg-[var(--bg-surface)]" />
        </div>
      </section>
    </main>
  );
}

export default async function KoreanSearchPage() {
  const siteConfig = await getRequestSiteConfig();

  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchPageClient siteConfig={siteConfig} />
    </Suspense>
  );
}
