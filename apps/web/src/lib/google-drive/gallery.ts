import { Readable } from "node:stream";

import { google } from "googleapis";

const GALLERY_FOLDER = "Galerie";
const GALLERY_THUMBNAILS_FOLDER = "Thumbnails";
const REQUEST_TIMEOUT_MS = 30_000;
const GOOGLE_DRIVE_ROOT_FOLDER_ID = "GOOGLE_DRIVE_ROOT_FOLDER_ID";
const GOOGLE_DRIVE_OAUTH_CLIENT_ID = "GOOGLE_DRIVE_OAUTH_CLIENT_ID";
const GOOGLE_DRIVE_OAUTH_CLIENT_SECRET = "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET";
const GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN = "GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN";

export type GalleryDriveUploadInput = {
  filename: string;
  mimeType: string;
  body: Buffer;
  folder?: "media" | "thumbnails";
};

export type GalleryDriveUploadResult = {
  driveFileId: string;
  driveWebViewLink: string | null;
  folderId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
};

export type GalleryDriveThumbnailResult = {
  body: ArrayBuffer;
  contentType: string;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function getDriveAuth() {
  const auth = new google.auth.OAuth2(
    requireEnv(GOOGLE_DRIVE_OAUTH_CLIENT_ID),
    requireEnv(GOOGLE_DRIVE_OAUTH_CLIENT_SECRET),
  );

  auth.setCredentials({
    refresh_token: requireEnv(GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN),
  });

  return auth;
}

function getDriveClient() {
  return google.drive({
    version: "v3",
    auth: getDriveAuth(),
    timeout: REQUEST_TIMEOUT_MS,
  });
}

function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 160) || "upload";
}

async function findOrCreateFolder(name: string, parentId: string) {
  const drive = getDriveClient();
  const escapedName = name.replace(/'/g, "\\'");
  const query = `mimeType='application/vnd.google-apps.folder' and name='${escapedName}' and trashed=false and '${parentId}' in parents`;

  const existing = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    pageSize: 1,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  const existingId = existing.data.files?.[0]?.id;
  if (existingId) return existingId;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  if (!created.data.id) {
    throw new Error("Google Drive folder creation failed");
  }

  return created.data.id;
}

async function getGalleryFolderId(folder: "media" | "thumbnails" = "media") {
  const rootFolderId = requireEnv(GOOGLE_DRIVE_ROOT_FOLDER_ID);
  const galleryId = await findOrCreateFolder(GALLERY_FOLDER, rootFolderId);

  if (folder === "thumbnails") {
    return findOrCreateFolder(GALLERY_THUMBNAILS_FOLDER, galleryId);
  }

  return galleryId;
}

export async function uploadGalleryFileToDrive(input: GalleryDriveUploadInput): Promise<GalleryDriveUploadResult> {
  const folderId = await getGalleryFolderId(input.folder);
  const drive = getDriveClient();
  const filename = sanitizeFilename(input.filename);

  const created = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType: input.mimeType || "application/octet-stream",
      body: Readable.from(input.body),
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  if (!created.data.id) {
    throw new Error("Google Drive upload failed");
  }

  return {
    driveFileId: created.data.id,
    driveWebViewLink: created.data.webViewLink ?? null,
    folderId,
    originalFilename: filename,
    mimeType: input.mimeType || "application/octet-stream",
    sizeBytes: input.body.byteLength,
  };
}

export function isGoogleDriveMissingGalleryFileError(error: unknown) {
  const maybeError = error as { code?: number; status?: number; response?: { status?: number } };
  return maybeError.code === 404 || maybeError.status === 404 || maybeError.response?.status === 404;
}

export async function getGalleryDriveFileStream(driveFileId: string) {
  const drive = getDriveClient();
  return drive.files.get(
    {
      fileId: driveFileId,
      alt: "media",
      supportsAllDrives: true,
    },
    { responseType: "stream" },
  );
}

export async function getGalleryDriveThumbnail(driveFileId: string): Promise<GalleryDriveThumbnailResult | null> {
  const drive = getDriveClient();
  const metadata = await drive.files.get({
    fileId: driveFileId,
    fields: "thumbnailLink",
    supportsAllDrives: true,
  });

  const thumbnailLink = metadata.data.thumbnailLink;
  if (!thumbnailLink) return null;

  const auth = getDriveAuth();
  const headers = await auth.getRequestHeaders();
  const response = await fetch(thumbnailLink.replace(/=s\d+$/, "=s720"), {
    headers: headers as HeadersInit,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.status === 404) {
    const error = new Error("Google Drive thumbnail not found") as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  if (!response.ok) {
    throw new Error(`Google Drive thumbnail request failed: ${response.status}`);
  }

  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "image/jpeg",
  };
}
