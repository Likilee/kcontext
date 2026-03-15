import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ChunkViewer } from "./chunk-viewer";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ChunkViewer", () => {
  const roots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

  afterEach(() => {
    for (const { root, container } of roots) {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
    roots.length = 0;
  });

  const renderChunkViewer = (props: Partial<Parameters<typeof ChunkViewer>[0]> = {}) => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        createElement(ChunkViewer, {
          text: null,
          keyword: "",
          isLoading: false,
          ...props,
        }),
      );
    });

    roots.push({ root, container });

    return container;
  };

  it("wraps long active subtitle text in a scrollable centered container", () => {
    const longText =
      "자막 청크가 세 줄 이상으로 길어져도 전체 문장을 읽을 수 있어야 하고 화면 중앙의 읽기 흐름이 깨지지 않아야 합니다.";
    const container = renderChunkViewer({
      text: longText,
      keyword: "읽기",
      isLoading: false,
    });

    const viewer = container.querySelector("[data-testid='chunk-viewer']");
    expect(viewer).not.toBeNull();

    const layoutContainer = viewer?.querySelector("[data-testid='chunk-viewer-layout']");
    expect(layoutContainer).not.toBeNull();
    expect(layoutContainer?.className).toContain("min-h-0");
    expect(layoutContainer?.className).toContain("items-center");

    const scrollContainer = viewer?.querySelector("[data-testid='chunk-viewer-scroll-region']");
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer?.className).toContain("overflow-y-auto");
    expect(scrollContainer?.className).toContain("py-[var(--space-gap-item)]");
    expect(scrollContainer?.textContent).toContain(longText);

    const paragraph = viewer?.querySelector("p");
    expect(paragraph?.className).toContain("break-keep");
    expect(paragraph?.className).toContain("text-center");

    const highlight = viewer?.querySelector("mark");
    expect(highlight?.textContent).toBe("읽기");
  });
});
