-- Enable Supabase Realtime for Tasks workflow tables.
-- Without publication membership, client subscriptions connect successfully
-- but never receive DB change events for these tables.

ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_attempts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_media;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_evidence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comment_likes;
