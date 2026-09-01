import { DAILY_VIDEO_HEIGHT, DAILY_VIDEO_WIDTH } from "./canvas-renderer";
import type { VideoProgressCallback, VideoStoryboard } from "./contracts";
import { encodeStoryboardMp4 } from "./mp4-encoder";

export async function generateReportVideo(
  storyboard: VideoStoryboard,
  onProgress: VideoProgressCallback = () => undefined
): Promise<Blob> {
  if (typeof document === "undefined") throw new Error("VIDEO_RECORDING_UNSUPPORTED");
  const canvas = document.createElement("canvas");
  canvas.width = DAILY_VIDEO_WIDTH;
  canvas.height = DAILY_VIDEO_HEIGHT;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("CANVAS_CAPTURE_UNSUPPORTED");
  return encodeStoryboardMp4(canvas, context, storyboard, onProgress);
}
