ALTER TABLE public.user_usage 
  ADD COLUMN IF NOT EXISTS last_tool_date date,
  ADD COLUMN IF NOT EXISTS last_transcription_date date,
  ADD COLUMN IF NOT EXISTS last_chat_date date;