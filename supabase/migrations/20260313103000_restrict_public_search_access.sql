DROP POLICY IF EXISTS "Public read access for video" ON public.video;
DROP POLICY IF EXISTS "Public read access for subtitle" ON public.subtitle;

REVOKE SELECT ON TABLE public.video FROM anon, authenticated;
REVOKE SELECT ON TABLE public.subtitle FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.search_subtitles(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_subtitles(TEXT, TEXT) FROM anon, authenticated;

GRANT SELECT ON TABLE public.video TO service_role;
GRANT SELECT ON TABLE public.subtitle TO service_role;
GRANT EXECUTE ON FUNCTION public.search_subtitles(TEXT, TEXT) TO service_role;
