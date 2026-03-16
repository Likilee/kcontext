import { redirect } from "next/navigation";
import { getDefaultLearningSearchPagePath, getDefaultLearningSearchPath } from "@/lib/app-routes";
import { resolveRequestedUiLanguageCode, UI_LANGUAGE_QUERY_PARAM } from "@/lib/site-config";
import { getRequestUrl } from "../request-site-config";

export default async function SearchPage() {
  const requestUrl = await getRequestUrl();
  const keyword = requestUrl.searchParams.get("q") ?? "";
  const requestedUiLanguageCode = resolveRequestedUiLanguageCode(
    requestUrl.searchParams.get(UI_LANGUAGE_QUERY_PARAM),
  );

  if (!keyword.trim()) {
    redirect(getDefaultLearningSearchPagePath(requestedUiLanguageCode));
  }

  redirect(
    getDefaultLearningSearchPath({
      keyword,
      uiLanguageCode: requestedUiLanguageCode,
    }),
  );
}
