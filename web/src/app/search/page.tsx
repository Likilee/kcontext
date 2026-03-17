import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { KOREAN_SEARCH_PATH } from "@/lib/app-routes";

export default async function SearchPage() {
  const requestHeaders = await headers();
  const search = requestHeaders.get("x-search") ?? "";

  redirect(`${KOREAN_SEARCH_PATH}${search}`);
}
