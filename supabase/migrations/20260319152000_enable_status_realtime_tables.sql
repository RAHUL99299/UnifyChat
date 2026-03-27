-- Enable realtime for status tables so seen counts and status updates propagate instantly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'statuses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.statuses;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'status_viewers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.status_viewers;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'status_visibility'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.status_visibility;
  END IF;
END $$;
