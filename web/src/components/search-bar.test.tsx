import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchBar } from "./search-bar";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SearchBar", () => {
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

  const renderSearchBar = (props: Partial<Parameters<typeof SearchBar>[0]> = {}) => {
    const onChange = vi.fn();
    const onSearch = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        createElement(SearchBar, {
          value: "",
          onChange,
          onSearch,
          isLoading: false,
          clearAriaLabel: "Clear search input",
          submitAriaLabel: "Submit search",
          ...props,
        }),
      );
    });

    roots.push({ root, container });

    return { container, onChange, onSearch };
  };

  it("shows only the submit button when the input is empty", () => {
    const { container } = renderSearchBar({ value: "" });

    expect(container.querySelector("button[aria-label='Submit search']")).not.toBeNull();
    expect(container.querySelector("button[aria-label='Clear search input']")).toBeNull();
  });

  it("shows only the clear button when the input has text", () => {
    const { container } = renderSearchBar({ value: "피곤하다" });

    expect(container.querySelector("button[aria-label='Clear search input']")).not.toBeNull();
    expect(container.querySelector("button[aria-label='Submit search']")).toBeNull();
  });

  it("keeps the submit affordance visible while loading", () => {
    const { container } = renderSearchBar({ value: "피곤하다", isLoading: true });

    expect(container.querySelector("button[aria-label='Submit search']")).not.toBeNull();
    expect(container.querySelector("button[aria-label='Clear search input']")).toBeNull();
  });

  it("clears the input when the clear button is pressed", () => {
    const { container, onChange } = renderSearchBar({ value: "피곤하다" });
    const clearButton = container.querySelector("button[aria-label='Clear search input']");

    if (!(clearButton instanceof HTMLButtonElement)) {
      throw new Error("Expected clear button to be rendered.");
    }

    act(() => {
      clearButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("submits the current value through the form", () => {
    const { container, onSearch } = renderSearchBar({ value: "피곤하다" });
    const form = container.querySelector("form");

    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Expected search form to be rendered.");
    }

    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSearch).toHaveBeenCalledWith("피곤하다");
  });
});
