import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { drawVideoFrame } from "./canvas-renderer";
import type { VideoProgressCallback, VideoStoryboard, VideoTheme } from "./contracts";

const VIDEO_CODEC = "avc1.420028";
const AUDIO_CODEC = "mp4a.40.2";
const FRAME_RATE = 30;
const VIDEO_BITRATE = 4_500_000;
const AUDIO_BITRATE = 128_000;
const AUDIO_SAMPLE_RATE = 48_000;
const AUDIO_CHANNELS = 2;
const AUDIO_CHUNK_FRAMES = 2_048;
const TONE_DURATION_SECONDS = 0.24;

interface Mp4EncodingApis {
  VideoEncoder?: unknown;
  AudioEncoder?: unknown;
  VideoFrame?: unknown;
  AudioData?: unknown;
}

export function mp4EncodingApisAvailable(apis: Mp4EncodingApis): boolean {
  return Boolean(apis.VideoEncoder && apis.AudioEncoder && apis.VideoFrame && apis.AudioData);
}

function cueTimes(storyboard: VideoStoryboard): number[] {
  return [
    150,
    storyboard.coverDurationMs,
    ...Array.from(
      { length: Math.max(0, storyboard.pages.length - 2) },
      (_, index) => storyboard.coverDurationMs + (index + 1) * storyboard.pageDurationMs
    ),
    storyboard.durationMs - storyboard.outroDurationMs,
  ].filter((value, index, values) => value >= 0 && value < storyboard.durationMs && values.indexOf(value) === index);
}

async function waitForQueue(readSize: () => number, limit: number): Promise<void> {
  while (readSize() > limit) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
}

function fillAudioChunk(
  target: Float32Array,
  startFrame: number,
  frameCount: number,
  cuesMs: number[],
  theme: VideoTheme
) {
  for (let cueIndex = 0; cueIndex < cuesMs.length; cueIndex += 1) {
    const cueStartFrame = Math.round((cuesMs[cueIndex] / 1_000) * AUDIO_SAMPLE_RATE);
    const cueEndFrame = cueStartFrame + Math.round(TONE_DURATION_SECONDS * AUDIO_SAMPLE_RATE);
    const overlapStart = Math.max(startFrame, cueStartFrame);
    const overlapEnd = Math.min(startFrame + frameCount, cueEndFrame);
    if (overlapStart >= overlapEnd) continue;
    const frequency = theme.sound[cueIndex % theme.sound.length];
    const leftGain = cueIndex % 2 === 0 ? 0.055 : 0.042;
    const rightGain = cueIndex % 2 === 0 ? 0.042 : 0.055;
    for (let absoluteFrame = overlapStart; absoluteFrame < overlapEnd; absoluteFrame += 1) {
      const localSeconds = (absoluteFrame - cueStartFrame) / AUDIO_SAMPLE_RATE;
      const envelope = Math.sin(Math.PI * (localSeconds / TONE_DURATION_SECONDS)) * Math.exp(-localSeconds * 3.5);
      const sample = Math.sin(2 * Math.PI * frequency * localSeconds) * envelope;
      const localFrame = absoluteFrame - startFrame;
      target[localFrame] += sample * leftGain;
      target[frameCount + localFrame] += sample * rightGain;
    }
  }
}

async function encodeAudio(
  encoder: AudioEncoder,
  storyboard: VideoStoryboard,
  onProgress: VideoProgressCallback
) {
  const totalFrames = Math.ceil((storyboard.durationMs / 1_000) * AUDIO_SAMPLE_RATE);
  const cuesMs = cueTimes(storyboard);
  for (let startFrame = 0; startFrame < totalFrames; startFrame += AUDIO_CHUNK_FRAMES) {
    await waitForQueue(() => encoder.encodeQueueSize, 16);
    const frameCount = Math.min(AUDIO_CHUNK_FRAMES, totalFrames - startFrame);
    const samples = new Float32Array(frameCount * AUDIO_CHANNELS);
    fillAudioChunk(samples, startFrame, frameCount, cuesMs, storyboard.theme);
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
      await waitForQueue(() => videoEncoder.encodeQueueSize, 8);
      const timestamp = Math.round((frameIndex * 1_000_000) / FRAME_RATE);
      const nextTimestamp = Math.round(((frameIndex + 1) * 1_000_000) / FRAME_RATE);
      drawVideoFrame(context, storyboard, (frameIndex * 1_000) / FRAME_RATE);
      const frame = new VideoFrame(canvas, { timestamp, duration: nextTimestamp - timestamp });
      videoEncoder.encode(frame, { keyFrame: frameIndex % (FRAME_RATE * 2) === 0 });
      frame.close();
      if (frameIndex % 5 === 0) onProgress((frameIndex / totalVideoFrames) * 0.88);
    }
    await videoEncoder.flush();
    if (encodingError) throw encodingError;

    await encodeAudio(audioEncoder, storyboard, onProgress);
    await audioEncoder.flush();
    if (encodingError) throw encodingError;

    muxer.finalize();
    onProgress(1);
    return new Blob([target.buffer], { type: "video/mp4" });
  } finally {
    if (videoEncoder.state !== "closed") videoEncoder.close();
    if (audioEncoder.state !== "closed") audioEncoder.close();
  }
}
