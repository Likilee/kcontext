import { redirect } from "next/navigation";
import { getDefaultLearningSearchPath } from "@/lib/app-routes";
import { resolveRequestedUiLanguageCode, UI_LANGUAGE_QUERY_PARAM } from "@/lib/site-config";
import { getRequestUrl } from "../request-site-config";

export default async function SearchPage() {
  const requestUrl = await getRequestUrl();
  const requestedUiLanguageCode = resolveRequestedUiLanguageCode(
    requestUrl.searchParams.get(UI_LANGUAGE_QUERY_PARAM),
  );
  redirect(
    getDefaultLearningSearchPath({
      keyword: requestUrl.searchParams.get("q") ?? "",
      uiLanguageCode: requestedUiLanguageCode,
    }),
  );
}
