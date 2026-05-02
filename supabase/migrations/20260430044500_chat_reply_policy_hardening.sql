CREATE OR REPLACE FUNCTION public.can_access_chat_message_id(chat_message_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.messages message
    WHERE message.id = chat_message_id
      AND public.can_access_chat_message(message.sender_id)
  );
$$;

DROP POLICY IF EXISTS "Users can create own chat messages"
  ON public.messages;

CREATE POLICY "Users can create own chat messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      reply_to_message_id IS NULL
      OR public.can_access_chat_message_id(reply_to_message_id)
    )
  );

GRANT EXECUTE ON FUNCTION public.can_access_chat_message_id(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
