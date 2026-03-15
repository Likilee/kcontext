"use client";

import type { FormEvent, MutableRefObject, Ref } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";

import { SEARCH_KEYWORDS } from "@/lib/search-keywords";

const HERO_PLACEHOLDER_EXAMPLES = SEARCH_KEYWORDS;
const STATIC_PLACEHOLDER = "Search real Korean";
const HERO_IDLE_PLACEHOLDER = "-";
const HERO_TYPE_INTERVAL = 80;
const HERO_DELETE_INTERVAL = 80;
const HERO_HOLD_AT_FULL = 240;
const HERO_HOLD_AT_EMPTY = 160;

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (keyword: string) => void;
  isLoading: boolean;
  inputId?: string;
  variant?: "hero" | "compact";
  dynamicPlaceholder?: boolean;
  placeholderText?: string;
  ariaLabel?: string;
  clearAriaLabel?: string;
  submitAriaLabel?: string;
  inputRef?: Ref<HTMLInputElement>;
}

function useRollingPlaceholder(enabled: boolean, staticPlaceholder: string): string {
  const [placeholder, setPlaceholder] = useState(staticPlaceholder);

  useEffect(() => {
    if (!enabled) {
      setPlaceholder(staticPlaceholder);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    let exampleIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    setPlaceholder(HERO_IDLE_PLACEHOLDER);

    const tick = () => {
      if (cancelled) {
        return;
      }

      const example = HERO_PLACEHOLDER_EXAMPLES[exampleIndex];
      if (!example) {
        return;
      }

      if (!isDeleting) {
        charIndex = Math.min(example.length, charIndex + 1);
        const typed = example.slice(0, charIndex);
        setPlaceholder(typed.length > 0 ? typed : HERO_IDLE_PLACEHOLDER);

        if (charIndex === example.length) {
          isDeleting = true;
          timeoutId = setTimeout(tick, HERO_HOLD_AT_FULL);
          return;
        }

        timeoutId = setTimeout(tick, HERO_TYPE_INTERVAL);
        return;
      }

      charIndex = Math.max(0, charIndex - 1);
      const typed = example.slice(0, charIndex);
      setPlaceholder(typed.length > 0 ? typed : HERO_IDLE_PLACEHOLDER);

      if (charIndex === 0) {
        isDeleting = false;
        exampleIndex = (exampleIndex + 1) % HERO_PLACEHOLDER_EXAMPLES.length;
        timeoutId = setTimeout(tick, HERO_HOLD_AT_EMPTY);
        return;
      }

      timeoutId = setTimeout(tick, HERO_DELETE_INTERVAL);
    };

    timeoutId = setTimeout(tick, HERO_HOLD_AT_EMPTY);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [enabled, staticPlaceholder]);

  return placeholder;
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  isLoading,
  inputId,
  variant = "compact",
  dynamicPlaceholder = false,
  placeholderText = STATIC_PLACEHOLDER,
  ariaLabel = "Search real Korean",
  clearAriaLabel = "Clear search input",
  submitAriaLabel = "Submit search",
  inputRef,
}: SearchBarProps) {
  const internalInputRef = useRef<HTMLInputElement | null>(null);
  const placeholder = useRollingPlaceholder(
    dynamicPlaceholder && value.length === 0,
    placeholderText,
  );
  const setInputRefs = useCallback(
    (element: HTMLInputElement | null) => {
      internalInputRef.current = element;

      if (!inputRef) {
        return;
      }

      if (typeof inputRef === "function") {
        inputRef(element);
        return;
      }

      (inputRef as MutableRefObject<HTMLInputElement | null>).current = element;
    },
    [inputRef],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(value);
    internalInputRef.current?.blur();
  };

  const isHero = variant === "hero";
  const showClearButton = value.trim().length > 0 && !isLoading;

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <Input
        ref={setInputRefs}
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden [&::-webkit-search-results-decoration]:hidden",
          isHero
            ? "min-h-[calc(var(--space-layout-section)+var(--space-inset-squish-y))] pr-[calc(var(--space-layout-section)*2)] text-[length:var(--font-size-18)]"
            : "h-[calc(var(--space-layout-section)-var(--space-gap-item))] py-[calc(var(--space-inset-squish-y)-var(--space-gap-micro))] pr-[calc(var(--space-layout-section)*2)] text-[length:var(--font-size-16)]",
        )}
        data-tubelang-search-input="true"
        autoComplete="off"
        aria-label={ariaLabel}
      />

      {showClearButton ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange("")}
          className={cn(
            "absolute right-[calc(var(--space-layout-section)+var(--space-gap-micro))] top-1/2 -translate-y-1/2",
            isHero
              ? ""
              : "min-h-[calc(var(--space-layout-section)-var(--space-gap-item))] min-w-[calc(var(--space-layout-section)-var(--space-gap-item))]",
          )}
          aria-label={clearAriaLabel}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </Button>
      ) : null}

      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className={cn(
          "absolute right-[var(--space-gap-micro)] top-1/2 -translate-y-1/2",
          isHero
            ? ""
            : "min-h-[calc(var(--space-layout-section)-var(--space-gap-item))] min-w-[calc(var(--space-layout-section)-var(--space-gap-item))]",
        )}
        aria-label={submitAriaLabel}
      >
        {isLoading ? (
          <span className="size-5 animate-spin rounded-full border-2 border-[var(--text-secondary)] border-t-transparent" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        )}
      </Button>
    </form>
  );
}
