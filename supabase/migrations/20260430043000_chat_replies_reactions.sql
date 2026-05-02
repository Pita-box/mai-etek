ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS messages_reply_to_message_idx
  ON public.messages(reply_to_message_id);

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL DEFAULT 'heart',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT message_reactions_emoji_check CHECK (emoji = 'heart'),
  CONSTRAINT message_reactions_unique_user_emoji UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS message_reactions_message_idx
  ON public.message_reactions(message_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can read message reactions"
  ON public.message_reactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages message
      WHERE message.id = message_id
        AND public.can_access_chat_message(message.sender_id)
    )
  );

CREATE POLICY "Chat participants can create own message reactions"
  ON public.message_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.messages message
      WHERE message.id = message_id
        AND public.can_access_chat_message(message.sender_id)
    )
  );

CREATE POLICY "Users can delete own message reactions"
  ON public.message_reactions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.message_reactions FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.message_reactions TO authenticated;
GRANT INSERT (reply_to_message_id) ON TABLE public.messages TO authenticated;

NOTIFY pgrst, 'reload schema';
