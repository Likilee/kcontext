import type { Metadata } from "next";
import Script from "next/script";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@fontsource-variable/inter";
import "./globals.css";
import { getRequestSiteConfig, getRequestUrl } from "./request-site-config";
import { buildRootMetadata, RootHtml } from "./root-layout-content";

export async function generateMetadata(): Promise<Metadata> {
  const [siteConfig, requestUrl] = await Promise.all([
    getRequestSiteConfig(),
    getRequestUrl({ usePrimaryHost: true }),
  ]);

  return buildRootMetadata({ siteConfig, requestUrl });
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteConfig = await getRequestSiteConfig();

  return (
    <RootHtml interfaceLanguageCode={siteConfig.interfaceLanguageCode}>
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
    </RootHtml>
  );
}
