import { redirect } from "next/navigation";
import { getDefaultLearningHomePath } from "@/lib/app-routes";
import { resolveRequestedUiLanguageCode, UI_LANGUAGE_QUERY_PARAM } from "@/lib/site-config";
import { getRequestUrl } from "./request-site-config";

export default async function HomePage() {
  const requestUrl = await getRequestUrl();
  const requestedUiLanguageCode = resolveRequestedUiLanguageCode(
    requestUrl.searchParams.get(UI_LANGUAGE_QUERY_PARAM),
  );
  redirect(getDefaultLearningHomePath(requestedUiLanguageCode));
}
