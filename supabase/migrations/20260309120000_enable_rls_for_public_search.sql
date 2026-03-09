ALTER TABLE public.video ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtitle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for video"
ON public.video
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Public read access for subtitle"
ON public.subtitle
FOR SELECT
TO anon, authenticated
USING (true);

REVOKE ALL ON TABLE public.video FROM anon, authenticated;
REVOKE ALL ON TABLE public.subtitle FROM anon, authenticated;

GRANT SELECT ON TABLE public.video TO anon, authenticated;
GRANT SELECT ON TABLE public.subtitle TO anon, authenticated;

ALTER FUNCTION public.search_subtitles(TEXT) SECURITY INVOKER;

REVOKE EXECUTE ON FUNCTION public.search_subtitles(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_subtitles(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_subtitles(TEXT) TO anon, authenticated;
