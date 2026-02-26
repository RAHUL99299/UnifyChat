-- Add unique constraint for typing indicators upsert
ALTER TABLE public.typing_indicators 
ADD CONSTRAINT typing_indicators_conversation_user_unique 
UNIQUE (conversation_id, user_id);