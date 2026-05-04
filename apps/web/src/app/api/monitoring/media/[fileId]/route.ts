import { Readable } from "node:stream";

import { NextRequest, NextResponse } from "next/server";
import {
  getMonitoringDriveFileStream,
  getMonitoringDriveThumbnail,
  isGoogleDriveMissingMonitoringFileError,
} from "@/lib/google-drive/monitoring";
import { createClient } from "@/utils/supabase/server";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

type MonitoringScreenshotRow = {
  id: string;
  metadata: {
    filename?: string;
    mime_type?: string;
  } | null;
};

function streamToWebResponse(
  stream: NodeJS.ReadableStream,
  metadata: { filename: string; mimeType: string },
) {
  const webStream = Readable.toWeb(stream as Readable) as ReadableStream;
  const headers = new Headers();
  headers.set("Content-Type", metadata.mimeType);
  headers.set("Cache-Control", "private, max-age=60");
  headers.set(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(metadata.filename)}"`,
  );

  return new Response(webStream, { headers });
}

function thumbnailToWebResponse(
  thumbnail: { body: ArrayBuffer; contentType: string },
  metadata: { filename: string },
) {
  const headers = new Headers();
  headers.set("Content-Type", thumbnail.contentType);
  headers.set("Cache-Control", "private, max-age=3600, stale-while-revalidate=86400");
  headers.set(
    "Content-Disposition",
    `inline; filename="thumb-${encodeURIComponent(metadata.filename)}"`,
  );

  return new Response(thumbnail.body, { headers });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { fileId } = await context.params;
  const variant = request.nextUrl.searchParams.get("variant");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("monitoring_events")
    .select("id, metadata")
    .eq("event_type", "page_screenshot")
    .contains("metadata", { drive_file_id: fileId })
    .limit(1);

  const screenshot = (data?.[0] as MonitoringScreenshotRow | undefined) ?? null;

  if (error || !screenshot) {
    return NextResponse.json({ error: "Snímek nebyl nalezen." }, { status: 404 });
  }

  try {
    if (variant === "thumb") {
      const thumbnail = await getMonitoringDriveThumbnail(fileId);
      if (!thumbnail) {
        return NextResponse.json(
          { error: "Náhled zatím není dostupný." },
          { status: 404 },
        );
      }

      return thumbnailToWebResponse(thumbnail, {
        filename: screenshot.metadata?.filename || "monitoring-screenshot.jpg",
      });
    }

    const driveResponse = await getMonitoringDriveFileStream(fileId);
    return streamToWebResponse(driveResponse.data as NodeJS.ReadableStream, {
      filename: screenshot.metadata?.filename || "monitoring-screenshot.jpg",
      mimeType: screenshot.metadata?.mime_type || "image/jpeg",
    });
  } catch (driveError) {
    if (isGoogleDriveMissingMonitoringFileError(driveError)) {
      return NextResponse.json(
        { error: "Soubor už na Google Drive neexistuje." },
        { status: 410 },
      );
    }

    console.error("Error proxying monitoring media from Google Drive:", driveError);
    return NextResponse.json(
      { error: "Snímek se nepodařilo načíst." },
      { status: 502 },
    );
  }
}
