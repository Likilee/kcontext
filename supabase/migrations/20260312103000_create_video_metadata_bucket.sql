INSERT INTO storage.buckets (id, name, public)
VALUES ('video-metadata', 'video-metadata', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for video metadata"
ON storage.objects FOR SELECT
USING (bucket_id = 'video-metadata');
