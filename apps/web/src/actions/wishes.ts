"use server";

import { createActivityNotification } from "@/actions/notifications";
import { revalidatePath } from "next/cache";
import { uploadWishFileToDrive } from "@/lib/google-drive/wishes";
import {
  sendNewWishNotification,
  sendWishStatusChangedNotification,
} from "@/lib/telegram/notifications";
import {
  getWishMediaSizeError,
  getWishMediaThumbnailSizeError,
  getWishMediaType,
  WISH_MEDIA_MAX_BYTES,
  WISH_MEDIA_THUMBNAIL_MAX_BYTES,
} from "@/lib/wishes/media-limits";
import { createClient } from "@/utils/supabase/server";
import type {
  Wish,
  WishMedia,
  WishMediaType,
  WishStatus,
  WishViewerRole,
} from "@/types/wish";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ProfileRow = {
  id: string;
  role: string | null;
  dom_id?: string | null;
  full_name: string | null;
};

type WishRow = Omit<
  Wish,
  "status" | "intensity" | "media" | "creator_name" | "dom_note"
> & {
  status: string | null;
  intensity: number | null;
};

type WishMediaRow = Omit<
  WishMedia,
  "media_type" | "size_bytes" | "thumbnail_size_bytes"
> & {
  media_type: string | null;
  size_bytes: number | null;
  thumbnail_size_bytes: number | null;
};

const editableStatuses = new Set<WishStatus>(["new", "noted"]);

function normalizeWishStatus(value: string | null): WishStatus {
  if (
    value === "new" ||
    value === "noted" ||
    value === "planned" ||
    value === "fulfilled" ||
    value === "declined"
  ) {
    return value;
  }

  return "new";
}

function normalizeWishMediaType(value: string | null): WishMediaType {
  return value === "video" ? "video" : "image";
}

function normalizeIntensity(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 3;
  return Math.min(Math.max(Math.trunc(value), 1), 5);
}

function normalizeText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength).trim();
}

function normalizeMultilineText(
  value: FormDataEntryValue | null,
  maxLength: number,
) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function getWishInput(formData: FormData) {
  const title = normalizeText(formData.get("title"), 255);
  const description = normalizeMultilineText(formData.get("description"), 4000);

  if (!title) {
    return { error: "Název přání je povinný." };
  }

  return {
    data: {
      title,
      description: description || null,
      category: null,
      intensity: 3,
    },
  };
}

function normalizeWishMedia(row: WishMediaRow): WishMedia {
  return {
    ...row,
    media_type: normalizeWishMediaType(row.media_type),
    size_bytes: typeof row.size_bytes === "number" ? row.size_bytes : null,
    thumbnail_size_bytes:
      typeof row.thumbnail_size_bytes === "number"
        ? row.thumbnail_size_bytes
        : null,
  };
}

function normalizeWish(
  row: WishRow,
  options: {
    creatorName?: string | null;
    domNote?: string | null;
    media?: WishMedia[];
  } = {},
): Wish {
  return {
    ...row,
    status: normalizeWishStatus(row.status),
    intensity: normalizeIntensity(row.intensity),
    creator_name: options.creatorName ?? null,
    dom_note: options.domNote ?? null,
    media: options.media || [],
  };
}

async function getWishViewerContext(supabase: SupabaseServerClient) {
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
  const role: WishViewerRole = profile.role === "dom" ? "dom" : "sub";
  let subProfiles: ProfileRow[] = [];

  if (role === "dom") {
    const { data: subData, error: subError } = await supabase
      .from("profiles")
      .select("id, role, dom_id, full_name")
      .eq("dom_id", user.id)
      .order("full_name", { ascending: true });

    if (subError) {
      return { context: null, error: subError.message };
    }

    subProfiles = (subData || []) as ProfileRow[];
  }

  return {
    context: {
      userId: user.id,
      role,
      profile,
      subProfiles,
    },
    error: null,
  };
}

async function loadWishMedia(
  supabase: SupabaseServerClient,
  wishIds: string[],
) {
  if (wishIds.length === 0) {
    return {
      mediaByWish: new Map<string, WishMedia[]>(),
      error: null as string | null,
    };
  }

  const { data, error } = await supabase
    .from("wish_media")
    .select("*")
    .in("wish_id", wishIds)
    .order("created_at", { ascending: false });

  if (error) {
    return {
      mediaByWish: new Map<string, WishMedia[]>(),
      error: error.message,
    };
  }

  const mediaByWish = new Map<string, WishMedia[]>();

  for (const item of ((data || []) as WishMediaRow[]).map(normalizeWishMedia)) {
    const media = mediaByWish.get(item.wish_id) || [];
    media.push(item);
    mediaByWish.set(item.wish_id, media);
  }

  return { mediaByWish, error: null };
}

export async function getWishes() {
  const supabase = await createClient();
  const { context, error: contextError } = await getWishViewerContext(supabase);

  if (contextError || !context) {
    return {
      error: contextError || "Nepodařilo se načíst uživatele.",
      role: "sub" as WishViewerRole,
      wishes: [] as Wish[],
    };
  }

  const wishQuery = supabase
    .from("wishes")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: wishData, error: wishError } =
    context.role === "dom"
      ? await wishQuery.in(
          "created_by",
          context.subProfiles.map((profile) => profile.id),
        )
      : await wishQuery.eq("created_by", context.userId);

  if (wishError) {
    console.error("Error fetching wishes:", wishError);
    return {
      error: wishError.message,
      role: context.role,
      wishes: [] as Wish[],
    };
  }

  const wishRows = (wishData || []) as WishRow[];
  const wishIds = wishRows.map((wish) => wish.id);
  const { mediaByWish, error: mediaError } = await loadWishMedia(
    supabase,
    wishIds,
  );

  if (mediaError) {
    return { error: mediaError, role: context.role, wishes: [] as Wish[] };
  }

  const profileIds = Array.from(
    new Set(wishRows.map((wish) => wish.created_by)),
  );
  const creatorNames = new Map<string, string | null>();

  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds);

    for (const profile of (profiles || []) as Array<{
      id: string;
      full_name: string | null;
    }>) {
      creatorNames.set(profile.id, profile.full_name);
    }
  }

  const notesByWish = new Map<string, string | null>();

  if (context.role === "dom" && wishIds.length > 0) {
    const { data: notesData, error: notesError } = await supabase
      .from("wish_dom_notes")
      .select("wish_id, note")
      .in("wish_id", wishIds);

    if (notesError) {
      return {
        error: notesError.message,
        role: context.role,
        wishes: [] as Wish[],
      };
    }

    for (const note of (notesData || []) as Array<{
      wish_id: string;
      note: string | null;
    }>) {
      notesByWish.set(note.wish_id, note.note);
    }
  }

  return {
    role: context.role,
    wishes: wishRows.map((wish) =>
      normalizeWish(wish, {
        creatorName: creatorNames.get(wish.created_by) || null,
        domNote:
          context.role === "dom" ? notesByWish.get(wish.id) || null : null,
        media: mediaByWish.get(wish.id) || [],
      }),
    ),
  };
}

export async function createWish(formData: FormData) {
  const supabase = await createClient();
  const { context, error: contextError } = await getWishViewerContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Not authenticated" };
  }

  if (context.profile.role !== "sub") {
    return { error: "Přání může vytvořit pouze SUB." };
  }

  const input = getWishInput(formData);
  if (input.error || !input.data) {
    return { error: input.error || "Neplatná data přání." };
  }

  const { data, error } = await supabase
    .from("wishes")
    .insert({
      ...input.data,
      created_by: context.userId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("Error creating wish:", error);
    return { error: error?.message || "Přání se nepodařilo vytvořit." };
  }

  await sendNewWishNotification({
    title: input.data.title,
    description: input.data.description,
    creatorName: context.profile.full_name,
  });

  await createActivityNotification({
    recipientId: context.profile.dom_id,
    pageKey: "wishes",
    entityType: "wish",
    entityId: data.id as string,
    title: "Nové přání",
    body: input.data.title,
    type: "wish_created",
  });

  revalidatePath("/wishes");
  return { success: true, wishId: data.id as string };
}

export async function updateWish(id: string, formData: FormData) {
  const supabase = await createClient();
  const { context, error: contextError } = await getWishViewerContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Not authenticated" };
  }

  if (context.profile.role !== "sub") {
    return { error: "Přání může upravit pouze SUB." };
  }

  const input = getWishInput(formData);
  if (input.error || !input.data) {
    return { error: input.error || "Neplatná data přání." };
  }

  const { error } = await supabase.rpc("update_own_wish", {
    wish_uuid: id,
    next_title: input.data.title,
    next_description: input.data.description,
    next_category: input.data.category,
    next_intensity: input.data.intensity,
  });

  if (error) {
    console.error("Error updating wish:", error);
    return { error: error.message };
  }

  revalidatePath("/wishes");
  return { success: true };
}

export async function deleteWish(id: string) {
  const supabase = await createClient();
  const { context, error: contextError } = await getWishViewerContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Not authenticated" };
  }

  if (context.profile.role !== "sub") {
    return { error: "Přání může smazat pouze SUB." };
  }

  const { data, error } = await supabase
    .from("wishes")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Error deleting wish:", error);
    return { error: error.message };
  }

  if (!data) {
    return { error: "Přání nelze smazat." };
  }

  revalidatePath("/wishes");
  return { success: true };
}

export async function setWishStatus(id: string, status: WishStatus) {
  const supabase = await createClient();
  const { context, error: contextError } = await getWishViewerContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Not authenticated" };
  }

  if (context.role !== "dom") {
    return { error: "Stav přání může změnit pouze DOM." };
  }

  if (status === "new") {
    return { error: "Stav nelze vrátit na nové přání." };
  }

  const { data: wishForNotification, error: wishForNotificationError } =
    await supabase
      .from("wishes")
      .select("id, title, status, created_by")
      .eq("id", id)
      .maybeSingle();

  if (wishForNotificationError) {
    console.error(
      "Error loading wish for Telegram notification:",
      wishForNotificationError.message,
    );
  }

  if (
    wishForNotification &&
    normalizeWishStatus(
      typeof wishForNotification.status === "string"
        ? wishForNotification.status
        : null,
    ) === status
  ) {
    revalidatePath("/wishes");
    return { success: true };
  }

  const { error } = await supabase.rpc("set_wish_status", {
    wish_uuid: id,
    next_status: status,
  });

  if (error) {
    console.error("Error setting wish status:", error);
    return { error: error.message };
  }

  await sendWishStatusChangedNotification({
    title: String(wishForNotification?.title || "Přání"),
    status,
    actorName: context.profile.full_name,
  });

  await createActivityNotification({
    recipientId: String(wishForNotification?.created_by || ""),
    pageKey: "wishes",
    entityType: "wish",
    entityId: id,
    title: "Změna stavu přání",
    body: `${String(wishForNotification?.title || "Přání")} → ${status}`,
    type: "wish_status_changed",
  });

  revalidatePath("/wishes");
  return { success: true };
}

export async function upsertWishDomNote(id: string, formData: FormData) {
  const supabase = await createClient();
  const { context, error: contextError } = await getWishViewerContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Not authenticated" };
  }

  if (context.role !== "dom") {
    return { error: "Soukromou poznámku může upravit pouze DOM." };
  }

  const note = normalizeMultilineText(formData.get("note"), 5000);
  const { error } = await supabase.rpc("upsert_wish_dom_note", {
    wish_uuid: id,
    next_note: note,
  });

  if (error) {
    console.error("Error saving wish DOM note:", error);
    return { error: error.message };
  }

  revalidatePath("/wishes");
  return { success: true };
}

export async function uploadWishMedia(wishId: string, formData: FormData) {
  const supabase = await createClient();
  const { context, error: contextError } = await getWishViewerContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Not authenticated" };
  }

  if (context.profile.role !== "sub") {
    return { error: "Média k přání může nahrát pouze SUB." };
  }

  const file = formData.get("file");
  const thumbnail = formData.get("thumbnail");
  if (!(file instanceof File)) {
    return { error: "Soubor chybí." };
  }

  const thumbnailFile = thumbnail instanceof File ? thumbnail : null;
  if (thumbnail !== null && !(thumbnail instanceof File)) {
    return { error: "Neplatný náhled videa." };
  }

  const mediaType = getWishMediaType(file);
  if (!mediaType) {
    return { error: "Nahraj fotku nebo video." };
  }

  if (file.size > WISH_MEDIA_MAX_BYTES) {
    return { error: getWishMediaSizeError() };
  }

  if (thumbnailFile && mediaType !== "video") {
    return { error: "Náhled lze přiložit pouze k videu." };
  }

  if (thumbnailFile && !thumbnailFile.type.startsWith("image/")) {
    return { error: "Náhled videa musí být obrázek." };
  }

  if (thumbnailFile && thumbnailFile.size > WISH_MEDIA_THUMBNAIL_MAX_BYTES) {
    return { error: getWishMediaThumbnailSizeError() };
  }

  const { data: wish, error: wishError } = await supabase
    .from("wishes")
    .select("id, title, status, created_by")
    .eq("id", wishId)
    .eq("created_by", context.userId)
    .maybeSingle();

  if (wishError || !wish) {
    return { error: wishError?.message || "Přání nebylo nalezeno." };
  }

  if (
    !editableStatuses.has(normalizeWishStatus(wish.status as string | null))
  ) {
    return { error: "K tomuto přání už nejde nahrávat média." };
  }

  try {
    const uploaded = await uploadWishFileToDrive({
      wishId,
      wishTitle: String(wish.title || "Přání"),
      file,
    });
    const uploadedThumbnail =
      mediaType === "video" && thumbnailFile
        ? await uploadWishFileToDrive({
            wishId,
            wishTitle: String(wish.title || "Přání"),
            file: thumbnailFile,
          })
        : null;

    const { data, error } = await supabase
      .from("wish_media")
      .insert({
        wish_id: wishId,
        uploaded_by: context.userId,
        media_type: mediaType,
        original_filename: uploaded.originalFilename,
        drive_file_id: uploaded.driveFileId,
        drive_web_view_link: uploaded.driveWebViewLink,
        drive_folder_id: uploaded.folderId,
        mime_type: uploaded.mimeType,
        size_bytes: uploaded.sizeBytes,
        thumbnail_drive_file_id: uploadedThumbnail?.driveFileId ?? null,
        thumbnail_original_filename:
          uploadedThumbnail?.originalFilename ?? null,
        thumbnail_mime_type: uploadedThumbnail?.mimeType ?? null,
        thumbnail_size_bytes: uploadedThumbnail?.sizeBytes ?? null,
      })
      .select("*")
      .maybeSingle();

    if (error || !data) {
      console.error("Error saving wish media:", error);
      return { error: error?.message || "Médium se nepodařilo uložit." };
    }

    revalidatePath("/wishes");
    return { success: true, media: normalizeWishMedia(data as WishMediaRow) };
  } catch (error) {
    console.error("Error uploading wish media:", error);
    return {
      error: error instanceof Error ? error.message : "Upload se nepodařil.",
    };
  }
}

export async function deleteWishMedia(mediaId: string) {
  const supabase = await createClient();
  const { context, error: contextError } = await getWishViewerContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("wish_media")
    .delete()
    .eq("id", mediaId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Error deleting wish media:", error);
    return { error: error.message };
  }

  if (!data) {
    return { error: "Médium se nepodařilo odebrat." };
  }

  revalidatePath("/wishes");
  return { success: true };
}
