import { LearningLanguagePlaceholderPage } from "../learning-language-placeholder-page";
import { getRequestSiteConfig } from "../request-site-config";

export default async function EnglishHomePage() {
  const siteConfig = await getRequestSiteConfig();
  return <LearningLanguagePlaceholderPage siteConfig={siteConfig} />;
}
