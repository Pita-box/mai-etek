-- Narrow punishments to a DOM-only template library.
-- Assigned punishment workflow is intentionally disabled for the current product scope.

DROP POLICY IF EXISTS "DOM can read pair punishments" ON public.punishments;
DROP POLICY IF EXISTS "Assigned SUB can read own punishments" ON public.punishments;
DROP POLICY IF EXISTS "DOM can assign punishments to own SUB" ON public.punishments;
DROP POLICY IF EXISTS "DOM can update pair punishments" ON public.punishments;
DROP POLICY IF EXISTS "Assigned SUB can submit own punishments" ON public.punishments;
DROP POLICY IF EXISTS "Punishment participants can create notifications" ON public.notifications;
