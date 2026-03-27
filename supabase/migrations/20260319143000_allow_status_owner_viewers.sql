-- Allow status owners to read viewers list (WhatsApp-like viewed-by list)
DROP POLICY IF EXISTS "Users can view their viewed status records" ON public.status_viewers;

CREATE POLICY "Users can view viewer rows for own statuses"
  ON public.status_viewers FOR SELECT
  TO authenticated
  USING (
    viewer_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.statuses
      WHERE statuses.id = status_viewers.status_id
        AND statuses.user_id = auth.uid()
    )
  );
