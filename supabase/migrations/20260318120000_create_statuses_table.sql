-- Create statuses table
CREATE TABLE IF NOT EXISTS public.statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('text', 'image', 'video')), -- text, image, or video
  content TEXT NOT NULL, -- text content or URL for media
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create status_viewers tracking table (who viewed which status)
CREATE TABLE IF NOT EXISTS public.status_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id UUID NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  viewer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(status_id, viewer_user_id)
);

-- Create status_visibility table (who can see which status)
CREATE TABLE IF NOT EXISTS public.status_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id UUID NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  visible_to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(status_id, visible_to_user_id)
);

-- Enable RLS
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_visibility ENABLE ROW LEVEL SECURITY;

-- Helper to avoid recursive RLS checks between statuses and status_visibility
CREATE OR REPLACE FUNCTION public.is_status_owner(_status_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.statuses
    WHERE id = _status_id
      AND user_id = auth.uid()
  );
$$;

-- RLS Policies for statuses
DROP POLICY IF EXISTS "Users can view statuses they can see" ON public.statuses;
CREATE POLICY "Users can view statuses they can see"
  ON public.statuses FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    id IN (
      SELECT status_id FROM public.status_visibility 
      WHERE visible_to_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create their own statuses" ON public.statuses;
CREATE POLICY "Users can create their own statuses"
  ON public.statuses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own statuses" ON public.statuses;
CREATE POLICY "Users can delete their own statuses"
  ON public.statuses FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own statuses" ON public.statuses;
CREATE POLICY "Users can update their own statuses"
  ON public.statuses FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for status_viewers
DROP POLICY IF EXISTS "Users can view their viewed status records" ON public.status_viewers;
CREATE POLICY "Users can view their viewed status records"
  ON public.status_viewers FOR SELECT
  TO authenticated
  USING (viewer_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can record status views" ON public.status_viewers;
CREATE POLICY "Users can record status views"
  ON public.status_viewers FOR INSERT
  TO authenticated
  WITH CHECK (viewer_user_id = auth.uid());

-- RLS Policies for status_visibility
DROP POLICY IF EXISTS "Status owner can insert visibility" ON public.status_visibility;
CREATE POLICY "Status owner can insert visibility"
  ON public.status_visibility FOR INSERT
  TO authenticated
  WITH CHECK (public.is_status_owner(status_id));

DROP POLICY IF EXISTS "Status owner can delete visibility" ON public.status_visibility;
CREATE POLICY "Status owner can delete visibility"
  ON public.status_visibility FOR DELETE
  TO authenticated
  USING (public.is_status_owner(status_id));

DROP POLICY IF EXISTS "Users can see visibility records for their statuses" ON public.status_visibility;
CREATE POLICY "Users can see visibility records for their statuses"
  ON public.status_visibility FOR SELECT
  TO authenticated
  USING (visible_to_user_id = auth.uid() OR public.is_status_owner(status_id));

-- Trigger to auto-delete expired statuses
CREATE OR REPLACE FUNCTION public.delete_expired_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.statuses
  WHERE expires_at < now();
END;
$$;

-- Index for better query performance
CREATE INDEX IF NOT EXISTS statuses_user_id_idx ON public.statuses(user_id);
CREATE INDEX IF NOT EXISTS statuses_expires_at_idx ON public.statuses(expires_at);
CREATE INDEX IF NOT EXISTS status_visibility_visible_to_user_id_idx ON public.status_visibility(visible_to_user_id);
CREATE INDEX IF NOT EXISTS status_viewers_viewer_user_id_idx ON public.status_viewers(viewer_user_id);
