import { headers } from "next/headers";
import { getSiteConfigForHost, isDevelopmentHost, normalizeHost } from "@/lib/site-config";

export async function getRequestSiteConfig() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const interfaceLocale = requestHeaders.get("accept-language");
  return getSiteConfigForHost(host, interfaceLocale);
}

export async function getRequestUrl({
  usePrimaryHost = false,
}: {
  readonly usePrimaryHost?: boolean;
} = {}): Promise<URL> {
  const requestHeaders = await headers();
  const hostHeader = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const host = normalizeHost(hostHeader);
  const siteConfig = getSiteConfigForHost(host);
  const pathname = requestHeaders.get("x-pathname") ?? "/";
  const search = requestHeaders.get("x-search") ?? "";
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const shouldUseRequestHost = isDevelopmentHost(host) || !usePrimaryHost;
  const effectiveHost = shouldUseRequestHost ? host : siteConfig.primaryHost;
  const protocol = shouldUseRequestHost
    ? forwardedProto
      ? `${forwardedProto}:`
      : isDevelopmentHost(host)
        ? "http:"
        : "https:"
    : "https:";

  return new URL(`${protocol}//${effectiveHost}${pathname}${search}`);
}
