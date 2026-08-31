import type { VideoTheme } from "./contracts";

export interface VideoAudioHandle {
  context: AudioContext;
  stream: MediaStream;
  stop: () => Promise<void>;
}

export function createVideoAudio(theme: VideoTheme, durationMs: number, cueTimesMs: number[] = []): VideoAudioHandle {
  const context = new AudioContext({ sampleRate: 48_000 });
  const destination = context.createMediaStreamDestination();
  const master = context.createGain();
  master.gain.value = 0.045;
  master.connect(destination);
  const starts = [150, ...cueTimesMs.map((value) => value + 60), Math.max(0, durationMs - 900)]
    .filter((value, index, values) => value >= 0 && value < durationMs && values.indexOf(value) === index)
    .sort((left, right) => left - right);
  starts.forEach((startMs, index) => {
    const start = startMs / 1_000;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index % 2 === 0 ? "sine" : "triangle";
    oscillator.frequency.value = theme.sound[index % theme.sound.length];
    gain.gain.setValueAtTime(0.0001, context.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.7, context.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + 0.22);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(context.currentTime + start);
    oscillator.stop(context.currentTime + start + 0.24);
  });
  return {
    context,
    stream: destination.stream,
    stop: async () => {
      destination.stream.getTracks().forEach((track) => track.stop());
      if (context.state !== "closed") await context.close();
    },
  };
}
