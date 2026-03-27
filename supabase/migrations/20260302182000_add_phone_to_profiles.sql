-- Add phone number field to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

