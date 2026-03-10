import { headers } from "next/headers";
import { getSiteConfigForHost, isDevelopmentHost, normalizeHost } from "@/lib/site-config";

export async function getRequestSiteConfig() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  return getSiteConfigForHost(host);
}

export async function getRequestUrl(): Promise<URL> {
  const requestHeaders = await headers();
  const hostHeader = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const host = normalizeHost(hostHeader);
  const pathname = requestHeaders.get("x-pathname") ?? "/";
  const search = requestHeaders.get("x-search") ?? "";
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProto
    ? `${forwardedProto}:`
    : isDevelopmentHost(host)
      ? "http:"
      : "https:";

  return new URL(`${protocol}//${host}${pathname}${search}`);
}
