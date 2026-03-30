
-- Fix search_path warnings
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('media-uploads', 'media-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'media-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read own media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'media-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'media-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
