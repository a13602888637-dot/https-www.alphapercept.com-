import { createVideoAudio } from "./audio";
import { DAILY_VIDEO_HEIGHT, DAILY_VIDEO_WIDTH, drawVideoFrame } from "./canvas-renderer";
import type { VideoProgressCallback, VideoStoryboard } from "./contracts";

const MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const;

export function selectVideoMimeType(isSupported: (type: string) => boolean): string {
  return MIME_TYPES.find((type) => isSupported(type)) || "";
}

export async function generateReportVideo(
  storyboard: VideoStoryboard,
  onProgress: VideoProgressCallback = () => undefined
): Promise<Blob> {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") {
    throw new Error("VIDEO_RECORDING_UNSUPPORTED");
  }
  const canvas = document.createElement("canvas");
  canvas.width = DAILY_VIDEO_WIDTH;
  canvas.height = DAILY_VIDEO_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context || typeof canvas.captureStream !== "function") throw new Error("CANVAS_CAPTURE_UNSUPPORTED");

  const audio = createVideoAudio(storyboard.theme, storyboard.durationMs);
  await audio.context.resume();
  const videoStream = canvas.captureStream(30);
  const stream = new MediaStream([...videoStream.getVideoTracks(), ...audio.stream.getAudioTracks()]);
  const mimeType = selectVideoMimeType(MediaRecorder.isTypeSupported.bind(MediaRecorder));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 7_000_000, audioBitsPerSecond: 96_000 } : undefined);
  const chunks: BlobPart[] = [];
  recorder.addEventListener("dataavailable", (event) => { if (event.data.size > 0) chunks.push(event.data); });

  try {
    const finished = new Promise<void>((resolve, reject) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.addEventListener("error", () => reject(new Error("VIDEO_RECORDING_FAILED")), { once: true });
    });
    recorder.start(500);
    const startedAt = performance.now();
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const elapsed = Math.min(storyboard.durationMs, now - startedAt);
        drawVideoFrame(context, storyboard, elapsed);
        onProgress(elapsed / storyboard.durationMs);
        if (elapsed >= storyboard.durationMs) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    recorder.stop();
    await finished;
    onProgress(1);
    return new Blob(chunks, { type: recorder.mimeType || "video/webm" });
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    await audio.stop();
  }
}
