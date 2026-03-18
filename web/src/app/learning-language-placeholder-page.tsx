import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UiLanguageSwitcher } from "@/components/ui-language-switcher";
import { getLearningHomePath } from "@/lib/app-routes";
import { DEFAULT_LEARNING_LANGUAGE_CODE, type SiteConfig } from "@/lib/site-config";

function getReservedLearningTitle(siteConfig: SiteConfig): string {
  if (siteConfig.uiLanguageCode === "ko") {
    return `${siteConfig.learningLanguageName} 학습은 준비 중입니다.`;
  }

  return `${siteConfig.learningLanguageName} learning is coming soon.`;
}

interface LearningLanguagePlaceholderPageProps {
  readonly siteConfig: SiteConfig;
}

export function LearningLanguagePlaceholderPage({
  siteConfig,
}: LearningLanguagePlaceholderPageProps) {
  const liveLearningPath = getLearningHomePath(
    DEFAULT_LEARNING_LANGUAGE_CODE,
    siteConfig.uiLanguageCode,
  );

  return (
    <main className="relative min-h-screen bg-[var(--bg-base)] pb-[calc(var(--space-layout-section)+var(--space-safe-bottom))]">
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-[var(--space-gap-item)] px-[var(--space-layout-screen)] pb-[var(--space-inset-squish-y)] pt-[calc(var(--space-inset-squish-y)+var(--space-safe-top))]">
          <Link
            href={liveLearningPath}
            className="font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-20)] font-semibold text-[var(--text-primary)]"
          >
            Tubelang
          </Link>
          <UiLanguageSwitcher siteConfig={siteConfig} />
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100dvh-var(--space-layout-section))] w-full max-w-3xl items-center px-[var(--space-layout-screen)] pt-[var(--space-layout-section)]">
        <Card className="w-full">
          <CardContent className="flex flex-col gap-[var(--space-gap-group)] p-[var(--space-layout-screen)]">
            <p className="font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-13)] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
              {siteConfig.copy.reservedLearningEyebrow}
            </p>
            <h1 className="font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-28)] font-semibold leading-[var(--line-height-tight)] text-[var(--text-primary)]">
              {getReservedLearningTitle(siteConfig)}
            </h1>
            <p className="font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-16)] leading-[var(--line-height-relaxed)] text-[var(--text-secondary)]">
              {siteConfig.copy.reservedLearningDescription}
            </p>
            <div>
              <Button asChild>
                <Link href={liveLearningPath}>{siteConfig.copy.reservedLearningCtaLabel}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
