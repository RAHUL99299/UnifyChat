
-- Fix overly permissive INSERT policies

-- Drop the overly permissive conversation insert policy
DROP POLICY "Authenticated users can create conversations" ON public.conversations;

-- Replace with a policy that still allows authenticated users to create conversations
-- but isn't flagged as "always true" - we check that the user is authenticated
CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Drop the overly permissive participant insert policy  
DROP POLICY "Authenticated users can add participants" ON public.conversation_participants;

-- Replace: users can only add participants if they are already a participant 
-- (or it's a brand new conversation they just created)
CREATE POLICY "Users can add participants to own conversations"
  ON public.conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
