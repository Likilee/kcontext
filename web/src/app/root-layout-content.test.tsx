import { describe, expect, it } from "vitest";
import { getSiteConfigForHost } from "@/lib/site-config";
import { buildRootMetadata, RootHtml } from "./root-layout-content";

describe("root-layout-content", () => {
  it("builds locale-specific metadata from the resolved site config", () => {
    const englishSiteConfig = getSiteConfigForHost("tubelang.com", "en-US,en;q=0.9");
    const koreanSiteConfig = getSiteConfigForHost("tubelang.com", "ko-KR,ko;q=0.9");
    const requestUrl = new URL("https://tubelang.com/ko");

    const englishMetadata = buildRootMetadata({
      siteConfig: englishSiteConfig,
      requestUrl,
    });
    const koreanMetadata = buildRootMetadata({
      siteConfig: koreanSiteConfig,
      requestUrl,
    });

    expect(englishMetadata.title).toBe("Tubelang Korean");
    expect(englishMetadata.description).toBe("Real Korean, Right in Context.");
    expect(englishMetadata.openGraph?.locale).toBe("en_US");

    expect(koreanMetadata.title).toBe("튜브랭 한국어");
    expect(koreanMetadata.description).toBe("진짜 한국어를 맥락 속에서 익히세요.");
    expect(koreanMetadata.openGraph?.locale).toBe("ko_KR");
  });

  it("sets the html lang attribute from the resolved interface language", () => {
    const englishSiteConfig = getSiteConfigForHost("tubelang.com", "en-US");
    const koreanSiteConfig = getSiteConfigForHost("tubelang.com", "ko-KR");

    const englishDocument = RootHtml({
      interfaceLanguageCode: englishSiteConfig.interfaceLanguageCode,
      children: null,
    });
    const koreanDocument = RootHtml({
      interfaceLanguageCode: koreanSiteConfig.interfaceLanguageCode,
      children: null,
    });

    expect(englishDocument.props.lang).toBe("en");
    expect(koreanDocument.props.lang).toBe("ko");
  });
});
