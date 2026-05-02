import { Readable } from "node:stream";

import { NextRequest, NextResponse } from "next/server";
import {
  getGalleryDriveFileStream,
  getGalleryDriveThumbnail,
  isGoogleDriveMissingGalleryFileError,
} from "@/lib/google-drive/gallery";
import { createClient } from "@/utils/supabase/server";

type RouteContext = {
  params: Promise<{ mediaId: string }>;
};

type GalleryMediaRow = {
  id: string;
  media_type: "image" | "video";
  original_filename: string;
  display_filename: string;
  display_drive_file_id: string;
  mime_type: string | null;
  thumbnail_drive_file_id: string | null;
  thumbnail_original_filename: string | null;
  thumbnail_mime_type: string | null;
};

function streamToWebResponse(
  stream: NodeJS.ReadableStream,
  options: {
    filename: string;
    mimeType: string | null;
    cacheControl?: string;
  },
) {
  const webStream = Readable.toWeb(stream as Readable) as ReadableStream;
  const headers = new Headers();
  headers.set("Content-Type", options.mimeType || "application/octet-stream");
  headers.set("Cache-Control", options.cacheControl || "private, max-age=60");
  headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(options.filename)}"`);

  return new Response(webStream, { headers });
}

function thumbnailToWebResponse(thumbnail: { body: ArrayBuffer; contentType: string }, media: GalleryMediaRow) {
  const headers = new Headers();
  headers.set("Content-Type", thumbnail.contentType);
  headers.set("Cache-Control", "private, max-age=3600, stale-while-revalidate=86400");
  headers.set("Content-Disposition", `inline; filename="thumb-${encodeURIComponent(media.original_filename)}"`);

  return new Response(thumbnail.body, { headers });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { mediaId } = await context.params;
  const variant = request.nextUrl.searchParams.get("variant");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("gallery_media")
    .select("id, media_type, original_filename, display_filename, display_drive_file_id, mime_type, thumbnail_drive_file_id, thumbnail_original_filename, thumbnail_mime_type")
    .eq("id", mediaId)
    .is("deleted_at", null)
    .single();

  const media = data as GalleryMediaRow | null;

  if (error || !media) {
    return NextResponse.json({ error: "Médium nebylo nalezeno." }, { status: 404 });
  }

  try {
    if (variant === "thumb") {
      if (media.thumbnail_drive_file_id) {
        try {
          const thumbnailResponse = await getGalleryDriveFileStream(media.thumbnail_drive_file_id);
          return streamToWebResponse(thumbnailResponse.data as NodeJS.ReadableStream, {
            filename: media.thumbnail_original_filename || `thumb-${media.original_filename}`,
            mimeType: media.thumbnail_mime_type || "image/jpeg",
            cacheControl: "private, max-age=3600, stale-while-revalidate=86400",
          });
        } catch (thumbnailError) {
          if (!isGoogleDriveMissingGalleryFileError(thumbnailError)) throw thumbnailError;
        }
      }

      try {
        const thumbnail = await getGalleryDriveThumbnail(media.display_drive_file_id);
        if (thumbnail) return thumbnailToWebResponse(thumbnail, media);
      } catch (thumbnailError) {
        if (!isGoogleDriveMissingGalleryFileError(thumbnailError)) throw thumbnailError;
      }

      return NextResponse.json({ error: "Náhled není dostupný." }, { status: 404 });
    }

    const driveResponse = await getGalleryDriveFileStream(media.display_drive_file_id);
    return streamToWebResponse(driveResponse.data as NodeJS.ReadableStream, {
      filename: media.display_filename,
      mimeType: media.mime_type,
    });
  } catch (driveError) {
    if (isGoogleDriveMissingGalleryFileError(driveError)) {
      return NextResponse.json({ error: "Soubor už na Google Drive neexistuje." }, { status: 410 });
    }

    console.error("Error proxying gallery media from Google Drive:", driveError);
    return NextResponse.json({ error: "Soubor se nepodařilo načíst." }, { status: 502 });
  }
}
