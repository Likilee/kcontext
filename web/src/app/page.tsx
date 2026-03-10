import { HomePageClient } from "./home-page-client";
import { getRequestSiteConfig } from "./request-site-config";

export default async function HomePage() {
  const siteConfig = await getRequestSiteConfig();
  return <HomePageClient siteConfig={siteConfig} />;
}
