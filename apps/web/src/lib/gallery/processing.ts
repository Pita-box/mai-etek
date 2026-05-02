import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import ffmpegStatic from "ffmpeg-static";
import sharp from "sharp";
import type { GalleryMediaType } from "@/types/gallery";

const execFileAsync = promisify(execFile);
const FFMPEG_TIMEOUT_MS = 5 * 60 * 1000;
const FFMPEG_BINARY = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

let cachedFfmpegPath: string | null = null;

type ProcessedFile = {
  filename: string;
  mimeType: string;
  body: Buffer;
};

export type GalleryProcessedMedia = {
  source: ProcessedFile;
  display: ProcessedFile;
  thumbnail: ProcessedFile;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
};

function getBaseName(filename: string) {
  const parsed = path.parse(filename);
  return (parsed.name || "media").replace(/\s+/g, " ").trim().slice(0, 120) || "media";
}

function getSafeExtension(filename: string, fallback: string) {
  const extension = path.extname(filename).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12);
  return extension || fallback;
}

function getWorkspaceRoots() {
  const roots = [
    process.cwd(),
    process.env.PWD,
    process.env.INIT_CWD,
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
    path.resolve(process.cwd(), "../../.."),
  ];

  return Array.from(new Set(roots.filter((root): root is string => Boolean(root))));
}

function getPnpmFfmpegCandidates(root: string) {
  const pnpmDir = path.join(root, "node_modules", ".pnpm");
  if (!existsSync(pnpmDir)) return [];

  return readdirSync(pnpmDir)
    .filter((entry) => entry.startsWith("ffmpeg-static@"))
    .map((entry) => path.join(pnpmDir, entry, "node_modules", "ffmpeg-static", FFMPEG_BINARY));
}

function getFfmpegPath() {
  if (cachedFfmpegPath && existsSync(cachedFfmpegPath)) return cachedFfmpegPath;

  const workspaceRoots = getWorkspaceRoots();
  const candidates = [
    typeof ffmpegStatic === "string" ? ffmpegStatic : null,
    ...workspaceRoots.map((root) => path.join(root, "node_modules", "ffmpeg-static", FFMPEG_BINARY)),
    ...workspaceRoots.flatMap(getPnpmFfmpegCandidates),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`FFmpeg binary is not available. Checked: ${candidates.join(", ")}`);
  }

  cachedFfmpegPath = found;
  return found;
}

async function fileToBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer());
}

function createWatermarkSvg(width: number, height: number, compact = false) {
  const fontSize = Math.max(compact ? 18 : 24, Math.round(Math.min(width, height) / (compact ? 18 : 24)));
  const paddingX = Math.round(fontSize * 0.72);
  const paddingY = Math.round(fontSize * 0.42);
  const textWidth = Math.round("Maietek".length * fontSize * 0.62);
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = fontSize + paddingY * 2;

  return Buffer.from(`
    <svg width="${boxWidth}" height="${boxHeight}" viewBox="0 0 ${boxWidth} ${boxHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${boxWidth}" height="${boxHeight}" rx="${Math.round(boxHeight * 0.28)}" fill="rgba(0,0,0,0.45)"/>
      <text x="${paddingX}" y="${Math.round(paddingY + fontSize * 0.78)}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="rgba(255,255,255,0.82)">Maietek</text>
    </svg>
  `);
}

async function createVideoWatermarkPng() {
  return sharp(createWatermarkSvg(1920, 1080, true)).png().toBuffer();
}

async function processImage(file: File): Promise<GalleryProcessedMedia> {
  const sourceBuffer = await fileToBuffer(file);
  const baseName = getBaseName(file.name);
  const normalized = sharp(sourceBuffer, { failOn: "none" }).rotate();
  const metadata = await normalized.metadata();
  const width = metadata.width || null;
  const height = metadata.height || null;
  const aspectRatio = width && height ? width / height : null;
  const watermark = createWatermarkSvg(width || 1200, height || 800);

  const displayBuffer = await sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .composite([{ input: watermark, gravity: "southeast" }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  const thumbnailBuffer = await sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true })
    .composite([{ input: createWatermarkSvg(720, 720, true), gravity: "southeast" }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  return {
    source: {
      filename: `source-${file.name}`,
      mimeType: file.type || "application/octet-stream",
      body: sourceBuffer,
    },
    display: {
      filename: `${baseName}-watermarked.jpg`,
      mimeType: "image/jpeg",
      body: displayBuffer,
    },
    thumbnail: {
      filename: `${baseName}-thumbnail.jpg`,
      mimeType: "image/jpeg",
      body: thumbnailBuffer,
    },
    width,
    height,
    aspectRatio,
  };
}

async function runFfmpeg(args: string[]) {
  const ffmpegPath = getFfmpegPath();

  try {
    await execFileAsync(ffmpegPath, args, {
      timeout: FFMPEG_TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    const details = error as Error & { stderr?: string };
    throw new Error(details.stderr || details.message || "FFmpeg processing failed");
  }
}

async function processVideo(file: File): Promise<GalleryProcessedMedia> {
  const sourceBuffer = await fileToBuffer(file);
  const baseName = getBaseName(file.name);
  const inputExtension = getSafeExtension(file.name, file.type.includes("webm") ? ".webm" : ".mp4");
  const workdir = await mkdtemp(path.join(tmpdir(), "gallery-video-"));
  const inputPath = path.join(workdir, `input${inputExtension}`);
  const watermarkPath = path.join(workdir, "watermark.png");
  const outputPath = path.join(workdir, "display.mp4");
  const thumbnailPath = path.join(workdir, "thumbnail.jpg");

  try {
    await writeFile(inputPath, sourceBuffer);
    await writeFile(watermarkPath, await createVideoWatermarkPng());

    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-i",
      watermarkPath,
      "-filter_complex",
      "[1:v]format=rgba,colorchannelmixer=aa=0.82[wm];[0:v][wm]overlay=W-w-24:H-h-24",
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "24",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    await runFfmpeg([
      "-y",
      "-ss",
      "00:00:01",
      "-i",
      outputPath,
      "-frames:v",
      "1",
      "-vf",
      "scale='min(720,iw)':-2",
      thumbnailPath,
    ]);

    const displayBuffer = await readFile(outputPath);
    const thumbnailBuffer = await readFile(thumbnailPath);
    const thumbnailMetadata = await sharp(thumbnailBuffer, { failOn: "none" }).metadata();
    const width = thumbnailMetadata.width || null;
    const height = thumbnailMetadata.height || null;

    return {
      source: {
        filename: `source-${file.name}`,
        mimeType: file.type || "application/octet-stream",
        body: sourceBuffer,
      },
      display: {
        filename: `${baseName}-watermarked.mp4`,
        mimeType: "video/mp4",
        body: displayBuffer,
      },
      thumbnail: {
        filename: `${baseName}-thumbnail.jpg`,
        mimeType: "image/jpeg",
        body: thumbnailBuffer,
      },
      width,
      height,
      aspectRatio: width && height ? width / height : null,
    };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

export async function processGalleryMedia(file: File, mediaType: GalleryMediaType) {
  if (mediaType === "image") {
    return processImage(file);
  }

  return processVideo(file);
}
