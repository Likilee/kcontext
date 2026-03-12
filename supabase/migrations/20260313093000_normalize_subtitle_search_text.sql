BEGIN;

CREATE OR REPLACE FUNCTION public._normalize_subtitle_search_text(input_text TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        input_text,
        '\([^()]*\)|（[^（）]*）|\[[^][]*\]|［[^［］]*］',
        ' ',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

DELETE FROM public.subtitle
WHERE public._normalize_subtitle_search_text(text) = '';

UPDATE public.subtitle
SET text = public._normalize_subtitle_search_text(text)
WHERE text <> public._normalize_subtitle_search_text(text);

DROP FUNCTION public._normalize_subtitle_search_text(TEXT);

COMMIT;
