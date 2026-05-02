import { Readable } from "node:stream";

import { google } from "googleapis";

const CHAT_FOLDER = "Chat";
const REQUEST_TIMEOUT_MS = 30_000;
const GOOGLE_DRIVE_ROOT_FOLDER_ID = "GOOGLE_DRIVE_ROOT_FOLDER_ID";
const GOOGLE_DRIVE_OAUTH_CLIENT_ID = "GOOGLE_DRIVE_OAUTH_CLIENT_ID";
const GOOGLE_DRIVE_OAUTH_CLIENT_SECRET = "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET";
const GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN = "GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN";

export type ChatDriveUploadInput = {
  file: File;
  date?: Date;
};

export type ChatDriveUploadResult = {
  driveFileId: string;
  driveWebViewLink: string | null;
  proxyUrl: string;
  thumbnailProxyUrl: string | null;
  folderId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
};

export type ChatDriveThumbnailResult = {
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

function getChatDateFolderName(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getChatFileDatePrefix(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${day}.${month}.${year}`;
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

async function getChatFolderId(date: Date) {
  const rootFolderId = requireEnv(GOOGLE_DRIVE_ROOT_FOLDER_ID);
  const chatId = await findOrCreateFolder(CHAT_FOLDER, rootFolderId);
  return findOrCreateFolder(getChatDateFolderName(date), chatId);
}

export async function uploadChatFileToDrive(input: ChatDriveUploadInput): Promise<ChatDriveUploadResult> {
  const uploadDate = input.date || new Date();
  const folderId = await getChatFolderId(uploadDate);
  const drive = getDriveClient();
  const arrayBuffer = await input.file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = `${getChatFileDatePrefix(uploadDate)}_${sanitizeFilename(input.file.name)}`;
  const mimeType = input.file.type || "application/octet-stream";

  const created = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
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
    proxyUrl: `/api/chat/media/${created.data.id}`,
    thumbnailProxyUrl: mimeType.startsWith("image/")
      ? `/api/chat/media/${created.data.id}?variant=thumb`
      : null,
    folderId,
    originalFilename: filename,
    mimeType,
    sizeBytes: input.file.size,
  };
}

export function isGoogleDriveMissingChatFileError(error: unknown) {
  const maybeError = error as { code?: number; status?: number; response?: { status?: number } };
  return maybeError.code === 404 || maybeError.status === 404 || maybeError.response?.status === 404;
}

export async function getChatDriveFileStream(driveFileId: string) {
  const drive = getDriveClient();
  return drive.files.get(
    {
      fileId: driveFileId,
      alt: "media",
      supportsAllDrives: true,
    },
    { responseType: "stream" }
  );
}

export async function getChatDriveThumbnail(driveFileId: string): Promise<ChatDriveThumbnailResult | null> {
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
  const response = await fetch(thumbnailLink.replace(/=s\d+$/, "=s480"), {
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

export async function getChatDriveFileMetadata(driveFileId: string) {
  const drive = getDriveClient();
  const metadata = await drive.files.get({
    fileId: driveFileId,
    fields: "id, name, mimeType, size",
    supportsAllDrives: true,
  });

  return {
    id: metadata.data.id,
    name: metadata.data.name || "chat-media",
    mimeType: metadata.data.mimeType || "application/octet-stream",
    size: metadata.data.size ? Number(metadata.data.size) : null,
  };
}
