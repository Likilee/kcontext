import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface ShortcutHarnessProps {
  onPrevious: () => void;
  onNext: () => void;
  onReplay: () => void;
}

function ShortcutHarness({ onPrevious, onNext, onReplay }: ShortcutHarnessProps) {
  useKeyboardShortcuts({ onPrevious, onNext, onReplay });
  return null;
}

function dispatchKeyboardEvent(target: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });

  act(() => {
    target.dispatchEvent(event);
  });

  return event;
}

describe("useKeyboardShortcuts", () => {
  const roots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

  afterEach(() => {
    for (const { root, container } of roots) {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
    roots.length = 0;
    document.body.innerHTML = "";
  });

  const renderHarness = (props: ShortcutHarnessProps) => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(createElement(ShortcutHarness, props));
    });

    roots.push({ root, container });
  };

  it("ignores key presses that originate from text input elements", () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const onReplay = vi.fn();

    renderHarness({ onPrevious, onNext, onReplay });

    const input = document.createElement("input");
    document.body.append(input);

    const arrowLeftEvent = dispatchKeyboardEvent(input, "ArrowLeft");
    const replayEvent = dispatchKeyboardEvent(input, "r");

    expect(onPrevious).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
    expect(onReplay).not.toHaveBeenCalled();
    expect(arrowLeftEvent.defaultPrevented).toBe(false);
    expect(replayEvent.defaultPrevented).toBe(false);
  });

  it("handles playback shortcuts when focus is outside text inputs", () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const onReplay = vi.fn();

    renderHarness({ onPrevious, onNext, onReplay });

    const trigger = document.createElement("button");
    document.body.append(trigger);

    const arrowLeftEvent = dispatchKeyboardEvent(trigger, "ArrowLeft");
    const arrowRightEvent = dispatchKeyboardEvent(trigger, "ArrowRight");
    const replayEvent = dispatchKeyboardEvent(trigger, " ");

    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(arrowLeftEvent.defaultPrevented).toBe(true);
    expect(arrowRightEvent.defaultPrevented).toBe(true);
    expect(replayEvent.defaultPrevented).toBe(true);
  });
});
