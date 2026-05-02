import { Readable } from "node:stream";

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getWishDriveFileStream,
  getWishDriveThumbnail,
  isGoogleDriveMissingWishFileError,
} from "@/lib/google-drive/wishes";
import { createClient } from "@/utils/supabase/server";

type RouteContext = {
  params: Promise<{ mediaId: string }>;
};

type WishMediaRow = {
  id: string;
  wish_id: string;
  media_type: "image" | "video";
  original_filename: string;
  drive_file_id: string;
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

function thumbnailToWebResponse(thumbnail: { body: ArrayBuffer; contentType: string }, media: WishMediaRow) {
  const headers = new Headers();
  headers.set("Content-Type", thumbnail.contentType);
  headers.set("Cache-Control", "private, max-age=3600, stale-while-revalidate=86400");
  headers.set("Content-Disposition", `inline; filename="thumb-${encodeURIComponent(media.original_filename)}"`);

  return new Response(thumbnail.body, { headers });
}

async function deleteMissingMediaRow(supabase: Awaited<ReturnType<typeof createClient>>, media: WishMediaRow) {
  const { data: deletedRows, error } = await supabase
    .from("wish_media")
    .delete()
    .eq("id", media.id)
    .select("id");

  if (error || !deletedRows?.length) {
    if (error) console.error("Error deleting missing wish media row:", error);
    return false;
  }

  revalidatePath("/wishes");
  return true;
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
    .from("wish_media")
    .select("id, wish_id, media_type, original_filename, drive_file_id, mime_type, thumbnail_drive_file_id, thumbnail_original_filename, thumbnail_mime_type")
    .eq("id", mediaId)
    .single();

  const media = data as WishMediaRow | null;

  if (error || !media) {
    return NextResponse.json({ error: "Médium nebylo nalezeno." }, { status: 404 });
  }

  try {
    if (variant === "thumb") {
      if (media.thumbnail_drive_file_id) {
        try {
          const thumbnailResponse = await getWishDriveFileStream(media.thumbnail_drive_file_id);
          return streamToWebResponse(thumbnailResponse.data as NodeJS.ReadableStream, {
            filename: media.thumbnail_original_filename || `thumb-${media.original_filename}`,
            mimeType: media.thumbnail_mime_type || "image/jpeg",
            cacheControl: "private, max-age=3600, stale-while-revalidate=86400",
          });
        } catch (thumbnailError) {
          if (!isGoogleDriveMissingWishFileError(thumbnailError)) throw thumbnailError;
        }
      }

      try {
        const thumbnail = await getWishDriveThumbnail(media.drive_file_id);
        if (thumbnail) return thumbnailToWebResponse(thumbnail, media);
      } catch (thumbnailError) {
        if (!isGoogleDriveMissingWishFileError(thumbnailError)) throw thumbnailError;
      }

      if (media.media_type === "video") {
        return NextResponse.json({ error: "Náhled videa není dostupný." }, { status: 404 });
      }
    }

    const driveResponse = await getWishDriveFileStream(media.drive_file_id);
    return streamToWebResponse(driveResponse.data as NodeJS.ReadableStream, {
      filename: media.original_filename,
      mimeType: media.mime_type,
    });
  } catch (driveError) {
    if (isGoogleDriveMissingWishFileError(driveError)) {
      await deleteMissingMediaRow(supabase, media);
      return NextResponse.json({ error: "Soubor už na Google Drive neexistuje a byl odebrán z evidence." }, { status: 410 });
    }

    console.error("Error proxying wish media from Google Drive:", driveError);
    return NextResponse.json({ error: "Soubor se nepodařilo načíst." }, { status: 502 });
  }
}
