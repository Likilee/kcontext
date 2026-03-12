import type { Metadata } from "next";
import Script from "next/script";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@fontsource-variable/inter";
import "./globals.css";
import { getRequestSiteConfig, getRequestUrl } from "./request-site-config";

export async function generateMetadata(): Promise<Metadata> {
  const [siteConfig, requestUrl] = await Promise.all([
    getRequestSiteConfig(),
    getRequestUrl({ usePrimaryHost: true }),
  ]);

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteConfig = await getRequestSiteConfig();

  return (
    <html lang={siteConfig.interfaceLanguageCode} className="dark">
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
