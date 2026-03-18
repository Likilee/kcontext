import type { Metadata } from "next";
import { LearningLanguagePlaceholderPage } from "../../learning-language-placeholder-page";
import { getRequestSiteConfig } from "../../request-site-config";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
};

export default async function EnglishSearchPage() {
  const siteConfig = await getRequestSiteConfig();
  return <LearningLanguagePlaceholderPage siteConfig={siteConfig} />;
}
