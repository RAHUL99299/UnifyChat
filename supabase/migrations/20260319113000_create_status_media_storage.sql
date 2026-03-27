-- Storage bucket for status media
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('status-media', 'status-media', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload status media under their own folder
DROP POLICY IF EXISTS "Authenticated users can upload status media" ON storage.objects;
CREATE POLICY "Authenticated users can upload status media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'status-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public read access for status media URLs
DROP POLICY IF EXISTS "Public can view status media" ON storage.objects;
CREATE POLICY "Public can view status media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'status-media');

-- Users can delete their own status media
DROP POLICY IF EXISTS "Users can delete own status media" ON storage.objects;
CREATE POLICY "Users can delete own status media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'status-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
