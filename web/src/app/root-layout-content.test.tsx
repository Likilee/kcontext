import { describe, expect, it } from "vitest";
import { getSiteConfig } from "@/lib/site-config";
import { buildRootMetadata, RootHtml } from "./root-layout-content";

describe("root-layout-content", () => {
  it("builds UI-language-specific metadata for the live learning route", () => {
    const englishUiConfig = getSiteConfig({ learningLanguageCode: "ko", uiLanguageCode: "en" });
    const koreanUiConfig = getSiteConfig({ learningLanguageCode: "ko", uiLanguageCode: "ko" });
    const requestUrl = new URL("https://tubelang.com/ko");

    const englishMetadata = buildRootMetadata({
      siteConfig: englishUiConfig,
      requestUrl,
    });
    const koreanMetadata = buildRootMetadata({
      siteConfig: koreanUiConfig,
      requestUrl,
    });

    expect(englishMetadata.title).toBe("Tubelang Korean");
    expect(englishMetadata.description).toBe("Real Korean, Right in Context.");
    expect(englishMetadata.openGraph?.locale).toBe("en_US");

    expect(koreanMetadata.title).toBe("튜브랭 한국어");
    expect(koreanMetadata.description).toBe("진짜 한국어를 맥락 속에서 익히세요.");
    expect(koreanMetadata.openGraph?.locale).toBe("ko_KR");
  });

  it("builds reserved-route metadata from the learning-language path", () => {
    const reservedConfig = getSiteConfig({ learningLanguageCode: "en", uiLanguageCode: "en" });
    const requestUrl = new URL("https://tubelang.com/en");
    const metadata = buildRootMetadata({
      siteConfig: reservedConfig,
      requestUrl,
    });

    expect(metadata.title).toBe("Tubelang English");
    expect(metadata.description).toBe("English learning is coming soon.");
  });

  it("sets the html lang attribute from the resolved UI language", () => {
    const englishUiConfig = getSiteConfig({ learningLanguageCode: "ko", uiLanguageCode: "en" });
    const koreanUiConfig = getSiteConfig({ learningLanguageCode: "ko", uiLanguageCode: "ko" });

    const englishDocument = RootHtml({
      uiLanguageCode: englishUiConfig.uiLanguageCode,
      children: null,
    });
    const koreanDocument = RootHtml({
      uiLanguageCode: koreanUiConfig.uiLanguageCode,
      children: null,
    });

    expect(englishDocument.props.lang).toBe("en");
    expect(koreanDocument.props.lang).toBe("ko");
  });
});
