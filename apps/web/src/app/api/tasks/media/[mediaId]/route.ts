import { Readable } from 'node:stream';

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getTaskDriveFileStream, getTaskDriveThumbnail, isGoogleDriveMissingFileError } from '@/lib/google-drive/tasks';
import { getTaskHref } from '@/lib/tasks/ids';
import { createClient } from '@/utils/supabase/server';

type RouteContext = {
  params: Promise<{ mediaId: string }>;
};

type MediaRow = {
  id: string;
  task_id: string;
  drive_file_id: string;
  mime_type: string | null;
  original_filename: string;
  media_type: 'image' | 'video';
  tasks: {
    id: string;
    public_task_id?: string | null;
    assigned_by: string;
    assigned_to: string;
  } | null;
};

function streamToWebResponse(stream: NodeJS.ReadableStream, media: MediaRow) {
  const webStream = Readable.toWeb(stream as Readable) as ReadableStream;
  const headers = new Headers();
  headers.set('Content-Type', media.mime_type || 'application/octet-stream');
  headers.set('Cache-Control', 'private, max-age=60');
  headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(media.original_filename)}"`);

  return new Response(webStream, { headers });
}

function thumbnailToWebResponse(thumbnail: { body: ArrayBuffer; contentType: string }, media: MediaRow) {
  const headers = new Headers();
  headers.set('Content-Type', thumbnail.contentType);
  headers.set('Cache-Control', 'private, max-age=3600, stale-while-revalidate=86400');
  headers.set('Content-Disposition', `inline; filename="thumb-${encodeURIComponent(media.original_filename)}"`);

  return new Response(thumbnail.body, { headers });
}

function revalidateMediaTask(task: MediaRow['tasks']) {
  if (!task) return;
  revalidatePath('/tasks');
  revalidatePath(`/tasks/${task.id}`);
  revalidatePath(getTaskHref(task));
}

async function deleteMissingMediaRow(supabase: Awaited<ReturnType<typeof createClient>>, media: MediaRow) {
  const { data: deletedRows, error } = await supabase
    .from('task_media')
    .delete()
    .eq('id', media.id)
    .select('id');

  if (error) {
    console.error('Error deleting missing task media row:', error);
    return false;
  }

  if (!deletedRows?.length) {
    console.error('Missing task media cleanup did not delete a row:', { mediaId: media.id });
    return false;
  }

  revalidateMediaTask(media.tasks);
  return true;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { mediaId } = await context.params;
  const variant = request.nextUrl.searchParams.get('variant');
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('task_media')
    .select('id, task_id, drive_file_id, mime_type, original_filename, media_type, tasks(id, public_task_id, assigned_by, assigned_to)')
    .eq('id', mediaId)
    .single();

  const media = data as MediaRow | null;

  if (error || !media || !media.tasks) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 });
  }

  if (![media.tasks.assigned_by, media.tasks.assigned_to].includes(session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    if (variant === 'thumb' && media.media_type === 'image') {
      const thumbnail = await getTaskDriveThumbnail(media.drive_file_id);
      if (thumbnail) return thumbnailToWebResponse(thumbnail, media);
    }

    const driveResponse = await getTaskDriveFileStream(media.drive_file_id);
    return streamToWebResponse(driveResponse.data as NodeJS.ReadableStream, media);
  } catch (driveError) {
    if (isGoogleDriveMissingFileError(driveError)) {
      await deleteMissingMediaRow(supabase, media);
      return NextResponse.json({ error: 'Soubor už na Google Drive neexistuje a byl odebrán z evidence.' }, { status: 410 });
    }

    console.error('Error proxying task media from Google Drive:', driveError);
    return NextResponse.json({ error: 'Soubor se nepodařilo načíst.' }, { status: 502 });
  }
}
