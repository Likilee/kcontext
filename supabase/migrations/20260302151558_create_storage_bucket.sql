INSERT INTO storage.buckets (id, name, public)
VALUES ('subtitles', 'subtitles', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for subtitles"
ON storage.objects FOR SELECT
USING (bucket_id = 'subtitles');
