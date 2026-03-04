import { Suspense } from "react";
import { SearchPageClient } from "./search-page-client";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[var(--bg-base)]">
          <section className="mx-auto flex w-full max-w-4xl flex-col gap-[var(--space-gap-group)] px-[var(--space-layout-screen)] py-[var(--space-layout-section)]">
            <p className="font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-16)] text-[var(--text-secondary)]">
              Loading search...
            </p>
          </section>
        </main>
      }
    >
      <SearchPageClient />
    </Suspense>
  );
}
