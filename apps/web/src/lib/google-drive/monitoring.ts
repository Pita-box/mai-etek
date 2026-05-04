import { Readable } from "node:stream";

import { google } from "googleapis";

const MONITORING_FOLDER = "Monitoring";
const REQUEST_TIMEOUT_MS = 30_000;
const GOOGLE_DRIVE_ROOT_FOLDER_ID = "GOOGLE_DRIVE_ROOT_FOLDER_ID";
const GOOGLE_DRIVE_OAUTH_CLIENT_ID = "GOOGLE_DRIVE_OAUTH_CLIENT_ID";
const GOOGLE_DRIVE_OAUTH_CLIENT_SECRET = "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET";
const GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN = "GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN";

const folderIdCache = new Map<string, Promise<string>>();

export type MonitoringDriveUploadInput = {
  filename: string;
  mimeType: string;
  body: Buffer;
  date?: Date;
};

export type MonitoringDriveUploadResult = {
  driveFileId: string;
  driveWebViewLink: string | null;
  folderId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
};

export type MonitoringDriveThumbnailResult = {
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
  return name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 160) || "monitoring";
}

function getMonitoringDateFolderName(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

async function findOrCreateFolder(name: string, parentId: string) {
  const cacheKey = `${parentId}:${name}`;
  const cached = folderIdCache.get(cacheKey);
  if (cached) return cached;

  const promise = findOrCreateFolderUncached(name, parentId).catch((error) => {
    folderIdCache.delete(cacheKey);
    throw error;
  });
  folderIdCache.set(cacheKey, promise);

  return promise;
}

async function findOrCreateFolderUncached(name: string, parentId: string) {
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

async function getMonitoringFolderId(date: Date) {
  const rootFolderId = requireEnv(GOOGLE_DRIVE_ROOT_FOLDER_ID);
  const monitoringId = await findOrCreateFolder(MONITORING_FOLDER, rootFolderId);
  return findOrCreateFolder(getMonitoringDateFolderName(date), monitoringId);
}

export async function uploadMonitoringFileToDrive(
  input: MonitoringDriveUploadInput,
): Promise<MonitoringDriveUploadResult> {
  const uploadDate = input.date || new Date();
  const folderId = await getMonitoringFolderId(uploadDate);
  const drive = getDriveClient();
  const filename = sanitizeFilename(input.filename);
  const mimeType = input.mimeType || "application/octet-stream";

  const created = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
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
    mimeType,
    sizeBytes: input.body.byteLength,
  };
}

export function isGoogleDriveMissingMonitoringFileError(error: unknown) {
  const maybeError = error as { code?: number; status?: number; response?: { status?: number } };
  return maybeError.code === 404 || maybeError.status === 404 || maybeError.response?.status === 404;
}

export async function getMonitoringDriveFileStream(driveFileId: string) {
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

export async function getMonitoringDriveThumbnail(
  driveFileId: string,
): Promise<MonitoringDriveThumbnailResult | null> {
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
    const error = new Error("Google Drive thumbnail not found") as Error & {
      status?: number;
    };
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

export async function deleteMonitoringDriveFile(driveFileId: string) {
  const drive = getDriveClient();
  await drive.files.delete({
    fileId: driveFileId,
    supportsAllDrives: true,
  });
}
