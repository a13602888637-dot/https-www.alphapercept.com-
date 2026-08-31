import { createVideoAudio } from "./audio";
import { DAILY_VIDEO_HEIGHT, DAILY_VIDEO_WIDTH, drawVideoFrame } from "./canvas-renderer";
import type { VideoProgressCallback, VideoStoryboard } from "./contracts";

const MIME_TYPES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
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

  const cueTimes = [
    storyboard.coverDurationMs,
    ...Array.from(
      { length: Math.max(0, storyboard.pages.length - 2) },
      (_, index) => storyboard.coverDurationMs + (index + 1) * storyboard.pageDurationMs
    ),
    storyboard.durationMs - storyboard.outroDurationMs,
  ];
  const audio = createVideoAudio(storyboard.theme, storyboard.durationMs, cueTimes);
  await audio.context.resume();
  const videoStream = canvas.captureStream(30);
  const stream = new MediaStream([...videoStream.getVideoTracks(), ...audio.stream.getAudioTracks()]);
  const mimeType = selectVideoMimeType(MediaRecorder.isTypeSupported.bind(MediaRecorder));
  if (!mimeType) {
    stream.getTracks().forEach((track) => track.stop());
    await audio.stop();
    throw new Error("MP4_RECORDING_UNSUPPORTED");
  }
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_500_000, audioBitsPerSecond: 128_000 });
  const chunks: BlobPart[] = [];
  recorder.addEventListener("dataavailable", (event) => { if (event.data.size > 0) chunks.push(event.data); });

  try {
    const finished = new Promise<void>((resolve, reject) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.addEventListener("error", () => reject(new Error("VIDEO_RECORDING_FAILED")), { once: true });
    });
    drawVideoFrame(context, storyboard, 0);
    recorder.start(1_000);
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
    return new Blob(chunks, { type: recorder.mimeType || mimeType });
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    await audio.stop();
  }
}
