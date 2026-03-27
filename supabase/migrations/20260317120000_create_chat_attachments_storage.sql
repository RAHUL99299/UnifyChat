-- Create storage bucket for chat attachments (images, files, audio, video)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-attachments', 'chat-attachments', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

-- Allow anyone to view/download files (public bucket)
DROP POLICY IF EXISTS "Public can view chat attachments" ON storage.objects;
CREATE POLICY "Public can view chat attachments"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'chat-attachments');

-- Allow users to delete their own uploads (paths start with their user id)
DROP POLICY IF EXISTS "Users can delete own chat attachments" ON storage.objects;
CREATE POLICY "Users can delete own chat attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
