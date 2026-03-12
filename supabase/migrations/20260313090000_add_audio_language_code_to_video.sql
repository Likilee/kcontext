ALTER TABLE public.video
ADD COLUMN audio_language_code TEXT;

UPDATE public.video
SET audio_language_code = 'ko'
WHERE audio_language_code IS NULL;

CREATE INDEX idx_video_audio_language_code ON public.video (audio_language_code);

DROP FUNCTION IF EXISTS public.search_subtitles(TEXT);

CREATE OR REPLACE FUNCTION public.search_subtitles(search_keyword TEXT, audio_language_code TEXT)
RETURNS TABLE (
  video_id TEXT,
  title TEXT,
  channel_name TEXT,
  start_time REAL,
  text TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT v.id AS video_id, v.title, v.channel_name, s.start_time, s.text
  FROM public.subtitle s
  JOIN public.video v ON s.video_id = v.id
  WHERE s.text &@ search_keyword
    AND v.audio_language_code = search_subtitles.audio_language_code
  ORDER BY v.published_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

REVOKE EXECUTE ON FUNCTION public.search_subtitles(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_subtitles(TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_subtitles(TEXT, TEXT) TO anon, authenticated;
