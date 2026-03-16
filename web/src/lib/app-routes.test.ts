import { describe, expect, it } from "vitest";
import {
  getCanonicalSearch,
  getDefaultLearningHomePath,
  getDefaultLearningSearchPagePath,
  getDefaultLearningSearchPath,
  getLearningHomePath,
  getLearningSearchPagePath,
  getLearningSearchPath,
  getUiLanguageSwitchPath,
} from "./app-routes";

describe("app-routes", () => {
  it("builds a learning-language home path", () => {
    expect(getLearningHomePath("ko")).toBe("/ko");
    expect(getLearningHomePath("en", "ko")).toBe("/en?hl=ko");
  });

  it("builds an encoded learning-language search path", () => {
    expect(getLearningSearchPath({ learningLanguageCode: "ko", keyword: " hello world " })).toBe(
      "/ko/search?q=hello+world",
    );
    expect(
      getLearningSearchPath({
        learningLanguageCode: "ko",
        keyword: " hello world ",
        uiLanguageCode: "ko",
      }),
    ).toBe("/ko/search?q=hello+world&hl=ko");
  });

  it("builds a learning-language search page path without a keyword", () => {
    expect(getLearningSearchPagePath("ko")).toBe("/ko/search");
    expect(getLearningSearchPagePath("ko", "en")).toBe("/ko/search?hl=en");
  });

  it("falls back to the learning-language home path for empty search input", () => {
    expect(getLearningSearchPath({ learningLanguageCode: "ko", keyword: "   " })).toBe("/ko");
  });

  it("builds the default live-learning paths", () => {
    expect(getDefaultLearningHomePath()).toBe("/ko");
    expect(getDefaultLearningSearchPagePath("ko")).toBe("/ko/search?hl=ko");
    expect(getDefaultLearningSearchPath({ keyword: "행복해요", uiLanguageCode: "ko" })).toBe(
      "/ko/search?q=%ED%96%89%EB%B3%B5%ED%95%B4%EC%9A%94&hl=ko",
    );
  });

  it("preserves the current query string when switching UI language", () => {
    expect(
      getUiLanguageSwitchPath({
        pathname: "/ko/search",
        search: "?q=%ED%96%89%EB%B3%B5%ED%95%B4%EC%9A%94",
        uiLanguageCode: "ko",
      }),
    ).toBe("/ko/search?q=%ED%96%89%EB%B3%B5%ED%95%B4%EC%9A%94&hl=ko");
  });

  it("strips the UI language query from canonical search params", () => {
    expect(getCanonicalSearch("?q=%ED%96%89%EB%B3%B5%ED%95%B4%EC%9A%94&hl=ko")).toBe(
      "?q=%ED%96%89%EB%B3%B5%ED%95%B4%EC%9A%94",
    );
    expect(getCanonicalSearch("?hl=en")).toBe("");
  });
});
