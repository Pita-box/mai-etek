"use client";

function getVideoThumbnailFileName(fileName: string) {
  const extensionIndex = fileName.lastIndexOf(".");
  const baseName = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
  return `${baseName || "video"}-thumbnail.jpg`;
}

function waitForVideoMetadata(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      resolve();
      return;
    }

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Video thumbnail timeout"));
    }, 10000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", handleError);
    };

    const handleLoadedMetadata = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Video thumbnail load failed"));
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("error", handleError);
    video.load();
  });
}

function waitForVideoSeek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    if (Math.abs(video.currentTime - time) < 0.02 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      window.requestAnimationFrame(() => resolve());
      return;
    }

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Video thumbnail seek timeout"));
    }, 8000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadeddata", handleFrameReady);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };

    const resolveReady = () => {
      cleanup();
      window.requestAnimationFrame(() => resolve());
    };

    const handleFrameReady = () => {
      resolveReady();
    };

    const handleSeeked = () => {
      resolveReady();
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Video thumbnail seek failed"));
    };

    video.addEventListener("loadeddata", handleFrameReady);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", handleError);

    try {
      video.currentTime = time;

      if (Math.abs(video.currentTime - time) < 0.02 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        resolveReady();
      }
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

function getVideoThumbnailTimes(duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return [0];
  }

  const maxTime = Math.max(0, duration - 0.05);
  const candidates = [
    Math.min(0.2, maxTime),
    Math.min(0.75, maxTime),
    Math.min(1.5, maxTime),
    duration * 0.25,
    duration * 0.5,
    duration * 0.75,
  ].map((time) => Math.min(maxTime, Math.max(0, time)));

  return Array.from(new Set(candidates.map((time) => Number(time.toFixed(2)))));
}

function isLikelyBlackFrame(context: CanvasRenderingContext2D, width: number, height: number) {
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 80));
  const imageData = context.getImageData(0, 0, width, height).data;
  let brightnessTotal = 0;
  let brightPixels = 0;
  let samples = 0;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const index = (y * width + x) * 4;
      const brightness = (imageData[index] + imageData[index + 1] + imageData[index + 2]) / 3;
      brightnessTotal += brightness;
      if (brightness > 40) brightPixels += 1;
      samples += 1;
    }
  }

  const averageBrightness = brightnessTotal / Math.max(1, samples);
  const brightRatio = brightPixels / Math.max(1, samples);

  return averageBrightness < 18 && brightRatio < 0.015;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Video thumbnail export failed"));
    }, "image/jpeg", 0.82);
  });
}

export async function createWishVideoThumbnail(videoFile: File) {
  const objectUrl = URL.createObjectURL(videoFile);

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = objectUrl;

    await waitForVideoMetadata(video);

    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("Video thumbnail dimensions missing");
    }

    const maxSide = 720;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Video thumbnail canvas unavailable");
    }

    let fallbackBlob: Blob | null = null;

    for (const time of getVideoThumbnailTimes(video.duration)) {
      await waitForVideoSeek(video, time);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToJpegBlob(canvas);
      fallbackBlob = blob;

      if (!isLikelyBlackFrame(context, canvas.width, canvas.height)) {
        return new File([blob], getVideoThumbnailFileName(videoFile.name), { type: "image/jpeg" });
      }
    }

    if (!fallbackBlob) {
      throw new Error("Video thumbnail export failed");
    }

    return new File([fallbackBlob], getVideoThumbnailFileName(videoFile.name), { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
