ALTER TABLE public.task_media
DROP CONSTRAINT IF EXISTS task_media_media_type_check;

UPDATE public.task_media
SET media_type = 'image'
WHERE media_type = 'photo';

ALTER TABLE public.task_media
ADD CONSTRAINT task_media_media_type_check
CHECK (media_type IN ('image', 'video'));
