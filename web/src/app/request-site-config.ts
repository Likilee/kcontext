import { cookies, headers } from "next/headers";
import { getCanonicalSearch } from "@/lib/app-routes";
import {
  getSiteConfigForRequest,
  isDevelopmentHost,
  normalizeHost,
  UI_LANGUAGE_COOKIE_NAME,
  UI_LANGUAGE_QUERY_PARAM,
} from "@/lib/site-config";

function getSearchParams(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

export async function getRequestSiteConfig() {
  const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
  const pathname = requestHeaders.get("x-pathname");
  const search = requestHeaders.get("x-search") ?? "";
  const requestedUiLanguageCode = getSearchParams(search).get(UI_LANGUAGE_QUERY_PARAM);

  return getSiteConfigForRequest({
    pathname,
    requestedUiLanguageCode,
    storedUiLanguageCode: cookieStore.get(UI_LANGUAGE_COOKIE_NAME)?.value,
    requestedLocale: requestHeaders.get("accept-language"),
  });
}

export async function getRequestUrl({
  usePrimaryHost = false,
  includeUiLanguage = true,
}: {
  readonly usePrimaryHost?: boolean;
  readonly includeUiLanguage?: boolean;
} = {}): Promise<URL> {
  const requestHeaders = await headers();
  const hostHeader = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const host = normalizeHost(hostHeader);
  const pathname = requestHeaders.get("x-pathname") ?? "/";
  const search = requestHeaders.get("x-search") ?? "";
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const shouldUseRequestHost = isDevelopmentHost(host) || !usePrimaryHost;
  const effectiveHost = shouldUseRequestHost ? host : "tubelang.com";
  const protocol = shouldUseRequestHost
    ? forwardedProto
      ? `${forwardedProto}:`
      : isDevelopmentHost(host)
        ? "http:"
        : "https:"
    : "https:";
  const effectiveSearch = includeUiLanguage ? search : getCanonicalSearch(search);

  return new URL(`${protocol}//${effectiveHost}${pathname}${effectiveSearch}`);
}
