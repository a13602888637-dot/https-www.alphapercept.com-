import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { drawVideoFrame } from "./canvas-renderer";
import type { VideoProgressCallback, VideoStoryboard } from "./contracts";
import { buildSoundtrack, fillSoundtrackChunk } from "./soundtrack";

const VIDEO_CODEC = "avc1.420028";
const AUDIO_CODEC = "mp4a.40.2";
const FRAME_RATE = 30;
const VIDEO_BITRATE = 4_500_000;
const AUDIO_BITRATE = 128_000;
const AUDIO_SAMPLE_RATE = 48_000;
const AUDIO_CHANNELS = 2;
const AUDIO_CHUNK_FRAMES = 2_048;

interface Mp4EncodingApis {
  VideoEncoder?: unknown;
  AudioEncoder?: unknown;
  VideoFrame?: unknown;
  AudioData?: unknown;
}

export function mp4EncodingApisAvailable(apis: Mp4EncodingApis): boolean {
  return Boolean(apis.VideoEncoder && apis.AudioEncoder && apis.VideoFrame && apis.AudioData);
}

async function waitForQueue(readSize: () => number, limit: number, readError: () => DOMException | null): Promise<void> {
  const started = Date.now();
  while (readSize() > limit) {
    const error = readError();
    if (error) throw error;
    if (Date.now() - started > 30_000) throw new Error("MP4_ENCODER_STALLED");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
}

async function flushEncoder(encoder: VideoEncoder | AudioEncoder, readError: () => DOMException | null): Promise<void> {
  let timer: number | undefined;
  try {
    await Promise.race([
      encoder.flush(),
      new Promise<never>((_, reject) => { timer = window.setTimeout(() => reject(new Error("MP4_ENCODER_STALLED")), 30_000); }),
    ]);
    const error = readError();
    if (error) throw error;
  } finally { if (timer !== undefined) window.clearTimeout(timer); }
}

async function encodeAudio(
  encoder: AudioEncoder,
  storyboard: VideoStoryboard,
  onProgress: VideoProgressCallback,
  readError: () => DOMException | null
) {
  const totalFrames = Math.ceil((storyboard.durationMs / 1_000) * AUDIO_SAMPLE_RATE);
  const soundtrack = buildSoundtrack(storyboard);
  for (let startFrame = 0; startFrame < totalFrames; startFrame += AUDIO_CHUNK_FRAMES) {
    await waitForQueue(() => encoder.encodeQueueSize, 16, readError);
    const frameCount = Math.min(AUDIO_CHUNK_FRAMES, totalFrames - startFrame);
    const samples = new Float32Array(frameCount * AUDIO_CHANNELS);
    fillSoundtrackChunk(samples, startFrame, frameCount, AUDIO_SAMPLE_RATE, soundtrack);
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate: AUDIO_SAMPLE_RATE,
      numberOfFrames: frameCount,
      numberOfChannels: AUDIO_CHANNELS,
      timestamp: Math.round((startFrame * 1_000_000) / AUDIO_SAMPLE_RATE),
      data: samples,
    });
    encoder.encode(audioData);
    audioData.close();
    onProgress(0.88 + (startFrame / totalFrames) * 0.1);
  }
}

export async function encodeStoryboardMp4(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  storyboard: VideoStoryboard,
  onProgress: VideoProgressCallback
): Promise<Blob> {
  if (!mp4EncodingApisAvailable(globalThis)) throw new Error("MP4_RECORDING_UNSUPPORTED");

  const videoConfig: VideoEncoderConfig = {
    codec: VIDEO_CODEC,
    width: canvas.width,
    height: canvas.height,
    bitrate: VIDEO_BITRATE,
    framerate: FRAME_RATE,
    latencyMode: "quality",
  };
  const audioConfig: AudioEncoderConfig = {
    codec: AUDIO_CODEC,
    sampleRate: AUDIO_SAMPLE_RATE,
    numberOfChannels: AUDIO_CHANNELS,
    bitrate: AUDIO_BITRATE,
  };
  const [videoSupport, audioSupport] = await Promise.all([
    VideoEncoder.isConfigSupported(videoConfig),
    AudioEncoder.isConfigSupported(audioConfig),
  ]);
  if (!videoSupport.supported || !audioSupport.supported) throw new Error("MP4_RECORDING_UNSUPPORTED");

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width: canvas.width, height: canvas.height, frameRate: FRAME_RATE },
    audio: { codec: "aac", numberOfChannels: AUDIO_CHANNELS, sampleRate: AUDIO_SAMPLE_RATE },
    fastStart: "in-memory",
  });
  let encodingError: DOMException | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
    error: (error) => { encodingError = error; },
  });
  const audioEncoder = new AudioEncoder({
    output: (chunk, metadata) => muxer.addAudioChunk(chunk, metadata),
    error: (error) => { encodingError = error; },
  });

  try {
    videoEncoder.configure(videoConfig);
    audioEncoder.configure(audioConfig);
    const totalVideoFrames = Math.ceil((storyboard.durationMs / 1_000) * FRAME_RATE);
    for (let frameIndex = 0; frameIndex < totalVideoFrames; frameIndex += 1) {
      await waitForQueue(() => videoEncoder.encodeQueueSize, 8, () => encodingError);
      const timestamp = Math.round((frameIndex * 1_000_000) / FRAME_RATE);
      const nextTimestamp = Math.round(((frameIndex + 1) * 1_000_000) / FRAME_RATE);
      drawVideoFrame(context, storyboard, (frameIndex * 1_000) / FRAME_RATE);
      // GPU-backed Canvas frames (BGRX on some Chrome/macOS combinations) can
      // stall without an error even when the codec reports support. Explicit
      // RGBA pixels keep the input portable and avoid that surface handoff.
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const frame = new VideoFrame(pixels.data, {
        format: "RGBA", codedWidth: canvas.width, codedHeight: canvas.height,
        timestamp, duration: nextTimestamp - timestamp,
      });
      videoEncoder.encode(frame, { keyFrame: frameIndex % (FRAME_RATE * 2) === 0 });
      frame.close();
      if (frameIndex % 5 === 0) onProgress((frameIndex / totalVideoFrames) * 0.88);
    }
    await flushEncoder(videoEncoder, () => encodingError);
    if (encodingError) throw encodingError;

    await encodeAudio(audioEncoder, storyboard, onProgress, () => encodingError);
    await flushEncoder(audioEncoder, () => encodingError);
    if (encodingError) throw encodingError;

    muxer.finalize();
    onProgress(1);
    return new Blob([target.buffer], { type: "video/mp4" });
  } finally {
    if (videoEncoder.state !== "closed") videoEncoder.close();
    if (audioEncoder.state !== "closed") audioEncoder.close();
  }
}
