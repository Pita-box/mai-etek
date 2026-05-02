"use server";

import { createActivityNotification } from "@/actions/notifications";
import { revalidatePath } from "next/cache";
import {
  getGalleryMediaSizeError,
  getGalleryMediaType,
  GALLERY_MEDIA_MAX_BYTES,
} from "@/lib/gallery/media-limits";
import { processGalleryMedia } from "@/lib/gallery/processing";
import { uploadGalleryFileToDrive } from "@/lib/google-drive/gallery";
import { createClient } from "@/utils/supabase/server";
import type {
  GalleryMedia,
  GalleryMediaType,
  GalleryViewerRole,
} from "@/types/gallery";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ProfileRow = {
  id: string;
  role: string | null;
  dom_id?: string | null;
  full_name: string | null;
};

type GalleryMediaRow = Omit<
  GalleryMedia,
  | "media_type"
  | "size_bytes"
  | "display_size_bytes"
  | "thumbnail_size_bytes"
  | "width"
  | "height"
  | "aspect_ratio"
  | "is_favorite"
  | "uploader_name"
> & {
  media_type: string | null;
  size_bytes: number | null;
  display_size_bytes: number | null;
  thumbnail_size_bytes: number | null;
  width: number | null;
  height: number | null;
  aspect_ratio: number | string | null;
  is_favorite: boolean | null;
};

function normalizeGalleryMediaType(value: string | null): GalleryMediaType {
  return value === "video" ? "video" : "image";
}

function normalizeNumber(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeGalleryMedia(
  row: GalleryMediaRow,
  uploaderName?: string | null,
): GalleryMedia {
  return {
    ...row,
    media_type: normalizeGalleryMediaType(row.media_type),
    size_bytes: normalizeNumber(row.size_bytes),
    display_size_bytes: normalizeNumber(row.display_size_bytes),
    thumbnail_size_bytes: normalizeNumber(row.thumbnail_size_bytes),
    width: normalizeNumber(row.width),
    height: normalizeNumber(row.height),
    aspect_ratio: normalizeNumber(row.aspect_ratio),
    is_favorite: Boolean(row.is_favorite),
    uploader_name: uploaderName ?? null,
  };
}

async function getGalleryViewerContext(supabase: SupabaseServerClient) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { context: null, error: userError?.message || "Not authenticated" };
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, dom_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profileData) {
    return {
      context: null,
      error: profileError?.message || "Profil nebyl nalezen.",
    };
  }

  const profile = profileData as ProfileRow;
  const role: GalleryViewerRole = profile.role === "dom" ? "dom" : "sub";

  return {
    context: {
      userId: user.id,
      role,
      profile,
    },
    error: null,
  };
}

function isDom(
  context: NonNullable<
    Awaited<ReturnType<typeof getGalleryViewerContext>>["context"]
  >,
) {
  return context.profile.role === "dom";
}

async function getGalleryNotificationRecipientId(
  supabase: SupabaseServerClient,
  context: NonNullable<
    Awaited<ReturnType<typeof getGalleryViewerContext>>["context"]
  >,
) {
  if (context.profile.role === "sub") {
    return context.profile.dom_id || null;
  }

  if (context.profile.role !== "dom") {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("dom_id", context.userId)
    .eq("role", "sub")
    .order("full_name", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error loading gallery notification recipient:", error);
    return null;
  }

  return data?.id || null;
}

export async function getGallery() {
  const supabase = await createClient();
  const { context, error: contextError } =
    await getGalleryViewerContext(supabase);

  if (contextError || !context) {
    return {
      error: contextError || "Nepodařilo se načíst uživatele.",
      role: "sub" as GalleryViewerRole,
      media: [] as GalleryMedia[],
    };
  }

  const { data, error } = await supabase
    .from("gallery_media")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching gallery media:", error);
    return {
      error: error.message,
      role: context.role,
      media: [] as GalleryMedia[],
    };
  }

  const rows = (data || []) as GalleryMediaRow[];
  const uploaderIds = Array.from(new Set(rows.map((item) => item.uploaded_by)));
  const uploaderNames = new Map<string, string | null>();

  if (uploaderIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", uploaderIds);

    for (const profile of (profiles || []) as Array<{
      id: string;
      full_name: string | null;
    }>) {
      uploaderNames.set(profile.id, profile.full_name);
    }
  }

  return {
    role: context.role,
    media: rows.map((item) =>
      normalizeGalleryMedia(item, uploaderNames.get(item.uploaded_by) || null),
    ),
  };
}

export async function uploadGalleryMedia(formData: FormData) {
  const supabase = await createClient();
  const { context, error: contextError } =
    await getGalleryViewerContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Not authenticated" };
  }

  if (context.profile.role !== "dom" && context.profile.role !== "sub") {
    return { error: "Galerii může používat pouze DOM nebo SUB." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Soubor chybí." };
  }

  const mediaType = getGalleryMediaType(file);
  if (!mediaType) {
    return { error: "Nahraj fotku nebo video." };
  }

  if (file.size > GALLERY_MEDIA_MAX_BYTES) {
    return { error: getGalleryMediaSizeError() };
  }

  try {
    const processed = await processGalleryMedia(file, mediaType);
    const uploadedSource = await uploadGalleryFileToDrive({
      filename: processed.source.filename,
      mimeType: processed.source.mimeType,
      body: processed.source.body,
    });
    const uploadedDisplay = await uploadGalleryFileToDrive({
      filename: processed.display.filename,
      mimeType: processed.display.mimeType,
      body: processed.display.body,
    });
    const uploadedThumbnail = await uploadGalleryFileToDrive({
      filename: processed.thumbnail.filename,
      mimeType: processed.thumbnail.mimeType,
      body: processed.thumbnail.body,
      folder: "thumbnails",
    });

    const { data, error } = await supabase
      .from("gallery_media")
      .insert({
        uploaded_by: context.userId,
        media_type: mediaType,
        original_filename: file.name,
        display_filename: uploadedDisplay.originalFilename,
        source_drive_file_id: uploadedSource.driveFileId,
        display_drive_file_id: uploadedDisplay.driveFileId,
        display_drive_web_view_link: uploadedDisplay.driveWebViewLink,
        drive_folder_id: uploadedDisplay.folderId,
        mime_type: uploadedDisplay.mimeType,
        size_bytes: file.size,
        display_size_bytes: uploadedDisplay.sizeBytes,
        thumbnail_drive_file_id: uploadedThumbnail.driveFileId,
        thumbnail_original_filename: uploadedThumbnail.originalFilename,
        thumbnail_mime_type: uploadedThumbnail.mimeType,
        thumbnail_size_bytes: uploadedThumbnail.sizeBytes,
        width: processed.width,
        height: processed.height,
        aspect_ratio: processed.aspectRatio,
      })
      .select("*")
      .maybeSingle();

    if (error || !data) {
      console.error("Error saving gallery media:", error);
      return { error: error?.message || "Médium se nepodařilo uložit." };
    }

    const recipientId = await getGalleryNotificationRecipientId(
      supabase,
      context,
    );
    await createActivityNotification({
      recipientId,
      pageKey: "gallery",
      entityType: "gallery_media",
      entityId: String(data.id),
      title:
        mediaType === "video" ? "Nové video v galerii" : "Nová fotka v galerii",
      body: file.name,
      type: "gallery_media_uploaded",
    });

    revalidatePath("/gallery");
    return {
      success: true,
      media: normalizeGalleryMedia(
        data as GalleryMediaRow,
        context.profile.full_name,
      ),
    };
  } catch (error) {
    console.error("Error uploading gallery media:", error);
    return {
      error: error instanceof Error ? error.message : "Upload se nepodařil.",
    };
  }
}

export async function setGalleryFavorite(mediaId: string, isFavorite: boolean) {
  const supabase = await createClient();
  const { context, error: contextError } =
    await getGalleryViewerContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Not authenticated" };
  }

  if (!isDom(context)) {
    return { error: "Favourite může upravit pouze DOM." };
  }

  const { error } = await supabase
    .from("gallery_media")
    .update({ is_favorite: isFavorite })
    .eq("id", mediaId)
    .is("deleted_at", null);

  if (error) {
    console.error("Error updating gallery favorite:", error);
    return { error: error.message };
  }

  revalidatePath("/gallery");
  return { success: true };
}

export async function bulkSetGalleryFavorite(
  mediaIds: string[],
  isFavorite: boolean,
) {
  const supabase = await createClient();
  const { context, error: contextError } =
    await getGalleryViewerContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Not authenticated" };
  }

  if (!isDom(context)) {
    return { error: "Bulk Favourite může upravit pouze DOM." };
  }

  const ids = mediaIds.filter(Boolean);
  if (ids.length === 0) {
    return { error: "Vyber alespoň jedno médium." };
  }

  const { error } = await supabase
    .from("gallery_media")
    .update({ is_favorite: isFavorite })
    .in("id", ids)
    .is("deleted_at", null);

  if (error) {
    console.error("Error bulk updating gallery favorite:", error);
    return { error: error.message };
  }

  revalidatePath("/gallery");
  return { success: true };
}

export async function bulkDeleteGalleryMedia(mediaIds: string[]) {
  const supabase = await createClient();
  const { context, error: contextError } =
    await getGalleryViewerContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Not authenticated" };
  }

  if (!isDom(context)) {
    return { error: "Média může mazat pouze DOM." };
  }

  const ids = mediaIds.filter(Boolean);
  if (ids.length === 0) {
    return { error: "Vyber alespoň jedno médium." };
  }

  const { error } = await supabase
    .from("gallery_media")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids)
    .is("deleted_at", null);

  if (error) {
    console.error("Error bulk deleting gallery media:", error);
    return { error: error.message };
  }

  revalidatePath("/gallery");
  return { success: true };
}
