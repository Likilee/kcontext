import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { BLOG_INDEX_PATH, KOREAN_HOME_PATH } from "@/lib/app-routes";
import type { SiteConfig } from "@/lib/site-config";

interface BlogPageShellProps {
  readonly siteConfig: SiteConfig;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly children: React.ReactNode;
}

export function BlogPageShell({
  siteConfig,
  eyebrow,
  title,
  description,
  children,
}: BlogPageShellProps) {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] pb-[calc(var(--space-layout-section)+var(--space-safe-bottom))]">
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-base)]">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-[var(--space-gap-item)] px-[var(--space-layout-screen)] pb-[var(--space-inset-squish-y)] pt-[calc(var(--space-inset-squish-y)+var(--space-safe-top))]">
          <Link href={KOREAN_HOME_PATH} aria-label={siteConfig.copy.homeAriaLabel}>
            <BrandLogo
              siteConfig={siteConfig}
              variant="horizontal"
              className="h-[calc(var(--font-size-20)+var(--space-gap-item))] w-auto"
            />
          </Link>

          <Link
            href={BLOG_INDEX_PATH}
            className="text-[length:var(--font-size-13)] font-medium text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--text-primary)]"
          >
            Blog
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-[var(--space-layout-section)] px-[var(--space-layout-screen)] pt-[var(--space-layout-section)]">
        <section className="flex flex-col gap-[var(--space-gap-item)]">
          <p className="text-[length:var(--font-size-13)] font-semibold uppercase tracking-[0.08em] text-[var(--brand-highlight)]">
            {eyebrow}
          </p>
          <h1 className="max-w-3xl font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-28)] font-bold leading-[var(--line-height-tight)] text-[var(--text-primary)]">
            {title}
          </h1>
          <p className="max-w-3xl text-[length:var(--font-size-18)] leading-[var(--line-height-relaxed)] text-[var(--text-secondary)]">
            {description}
          </p>
        </section>

        {children}
      </div>
    </main>
  );
}
