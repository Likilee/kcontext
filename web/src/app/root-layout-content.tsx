import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { SiteConfig } from "@/lib/site-config";

export function buildRootMetadata({
  siteConfig,
  requestUrl,
}: {
  readonly siteConfig: SiteConfig;
  readonly requestUrl: URL;
}): Metadata {
  return {
    metadataBase: new URL(siteConfig.baseUrl),
    title: siteConfig.metadataTitle,
    description: siteConfig.metadataDescription,
    applicationName: siteConfig.appName,
    alternates: {
      canonical: requestUrl.toString(),
    },
    openGraph: {
      type: "website",
      url: requestUrl.toString(),
      siteName: siteConfig.appName,
      title: siteConfig.metadataTitle,
      description: siteConfig.metadataDescription,
      locale: siteConfig.openGraphLocale,
      images: [
        {
          url: siteConfig.brandAssets.verticalLogoPath,
          alt: `${siteConfig.appName} ${siteConfig.learningLanguageName}`,
        },
      ],
    },
    twitter: {
      card: "summary",
      title: siteConfig.metadataTitle,
      description: siteConfig.metadataDescription,
      images: [siteConfig.brandAssets.verticalLogoPath],
    },
  };
}

export function RootHtml({
  interfaceLanguageCode,
  children,
}: Readonly<{
  interfaceLanguageCode: SiteConfig["interfaceLanguageCode"];
  children: ReactNode;
}>) {
  return (
    <html lang={interfaceLanguageCode} className="dark">
      {children}
    </html>
  );
}
