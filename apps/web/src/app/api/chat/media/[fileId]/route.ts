import { Readable } from "node:stream";

import { NextRequest, NextResponse } from "next/server";
import {
  getChatDriveFileMetadata,
  getChatDriveFileStream,
  getChatDriveThumbnail,
  isGoogleDriveMissingChatFileError,
} from "@/lib/google-drive/chat";
import { createClient } from "@/utils/supabase/server";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

type ChatMediaMessageRow = {
  id: string;
  media_url: string | null;
  media_thumbnail_url: string | null;
};

function streamToWebResponse(
  stream: NodeJS.ReadableStream,
  metadata: { name: string; mimeType: string },
) {
  const webStream = Readable.toWeb(stream as Readable) as ReadableStream;
  const headers = new Headers();
  headers.set("Content-Type", metadata.mimeType);
  headers.set("Cache-Control", "private, max-age=60");
  headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(metadata.name)}"`);

  return new Response(webStream, { headers });
}

function thumbnailToWebResponse(
  thumbnail: { body: ArrayBuffer; contentType: string },
  metadata: { name: string },
) {
  const headers = new Headers();
  headers.set("Content-Type", thumbnail.contentType);
  headers.set("Cache-Control", "private, max-age=3600, stale-while-revalidate=86400");
  headers.set("Content-Disposition", `inline; filename="thumb-${encodeURIComponent(metadata.name)}"`);

  return new Response(thumbnail.body, { headers });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { fileId } = await context.params;
  const variant = request.nextUrl.searchParams.get("variant");
  const mediaUrl = `/api/chat/media/${fileId}`;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("messages")
    .select("id, media_url, media_thumbnail_url")
    .or(`media_url.eq.${mediaUrl},media_thumbnail_url.eq.${mediaUrl}`)
    .limit(1);

  const message = (data?.[0] as ChatMediaMessageRow | undefined) ?? null;

  if (error || !message) {
    return NextResponse.json({ error: "Médium nebylo nalezeno" }, { status: 404 });
  }

  try {
    const metadata = await getChatDriveFileMetadata(fileId);

    if (variant === "thumb") {
      const thumbnail = await getChatDriveThumbnail(fileId);
      if (thumbnail) return thumbnailToWebResponse(thumbnail, metadata);
      if (!metadata.mimeType.startsWith("image/")) {
        return NextResponse.json({ error: "Náhled zatím není dostupný." }, { status: 404 });
      }
    }

    const driveResponse = await getChatDriveFileStream(fileId);
    return streamToWebResponse(driveResponse.data as NodeJS.ReadableStream, metadata);
  } catch (driveError) {
    if (isGoogleDriveMissingChatFileError(driveError)) {
      return NextResponse.json({ error: "Soubor už na Google Drive neexistuje." }, { status: 410 });
    }

    console.error("Error proxying chat media from Google Drive:", driveError);
    return NextResponse.json({ error: "Soubor se nepodařilo načíst." }, { status: 502 });
  }
}
