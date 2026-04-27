import { Readable } from "node:stream";

import { google } from "googleapis";

const TASKS_FOLDER = "Úkoly";
const REQUEST_TIMEOUT_MS = 30_000;
const GOOGLE_DRIVE_ROOT_FOLDER_ID = "GOOGLE_DRIVE_ROOT_FOLDER_ID";
const GOOGLE_DRIVE_OAUTH_CLIENT_ID = "GOOGLE_DRIVE_OAUTH_CLIENT_ID";
const GOOGLE_DRIVE_OAUTH_CLIENT_SECRET = "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET";
const GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN = "GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN";

export type TaskDriveUploadInput = {
  taskId: string;
  taskTitle: string;
  file: File;
};

export type TaskDriveUploadResult = {
  driveFileId: string;
  driveWebViewLink: string | null;
  folderId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
};

export type TaskDriveThumbnailResult = {
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

export function getTaskDriveFolderName(taskTitle: string, taskId: string) {
  const slug = taskTitle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "ukol";

  return `${slug}_${taskId.replaceAll("-", "").slice(-12)}`;
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

async function getTaskFolderId(taskTitle: string, taskId: string) {
  const rootFolderId = requireEnv(GOOGLE_DRIVE_ROOT_FOLDER_ID);
  const tasksId = await findOrCreateFolder(TASKS_FOLDER, rootFolderId);
  return findOrCreateFolder(getTaskDriveFolderName(taskTitle, taskId), tasksId);
}

export async function uploadTaskFileToDrive(input: TaskDriveUploadInput): Promise<TaskDriveUploadResult> {
  const folderId = await getTaskFolderId(input.taskTitle, input.taskId);
  const drive = getDriveClient();
  const arrayBuffer = await input.file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = sanitizeFilename(input.file.name);

  const created = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType: input.file.type || "application/octet-stream",
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
    folderId,
    originalFilename: filename,
    mimeType: input.file.type || "application/octet-stream",
    sizeBytes: input.file.size,
  };
}

export function isGoogleDriveMissingFileError(error: unknown) {
  const maybeError = error as { code?: number; status?: number; response?: { status?: number } };
  return maybeError.code === 404 || maybeError.status === 404 || maybeError.response?.status === 404;
}

export async function getTaskDriveFileStream(driveFileId: string) {
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

export async function getTaskDriveThumbnail(driveFileId: string): Promise<TaskDriveThumbnailResult | null> {
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
  const response = await fetch(thumbnailLink.replace(/=s\d+$/, "=s360"), {
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
