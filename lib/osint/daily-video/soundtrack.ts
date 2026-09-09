import type { VideoMusicProfile, VideoStoryboard } from "./contracts";

export type SoundtrackInstrument = VideoMusicProfile["instrument"] | "pad" | "bass" | "kick" | "brush" | "shaker" | "click" | VideoMusicProfile["cue"];
export interface SoundtrackEvent {
  start: number;
  duration: number;
  frequency: number;
  gain: number;
  pan: number;
  instrument: SoundtrackInstrument;
  seed: number;
}
export interface Soundtrack {
  duration: number;
  events: SoundtrackEvent[];
}

function midiFrequency(note: number): number { return 440 * 2 ** ((note - 69) / 12); }

function scaleNote(profile: VideoMusicProfile, degree: number, octave = 0): number {
  const wrapped = ((degree % profile.scale.length) + profile.scale.length) % profile.scale.length;
  return profile.root + profile.scale[wrapped] + 12 * (Math.floor(degree / profile.scale.length) + octave);
}

export function soundtrackCueTimes(storyboard: VideoStoryboard): number[] {
  return [
    150, storyboard.coverDurationMs,
    ...Array.from({ length: Math.max(0, storyboard.pages.length - 2) }, (_, index) => storyboard.coverDurationMs + (index + 1) * storyboard.pageDurationMs),
    storyboard.durationMs - storyboard.outroDurationMs,
  ].filter((value, index, values) => value >= 0 && value < storyboard.durationMs && values.indexOf(value) === index);
}

/** An original instrumental score: four-bar harmony, eight-note phrases,
 * bass, restrained percussion and page cues. No samples or third-party tracks. */
export function buildSoundtrack(storyboard: VideoStoryboard): Soundtrack {
  const duration = storyboard.durationMs / 1000;
  const events: SoundtrackEvent[] = [];
  const music = storyboard.theme.music;
  const add = (start: number, length: number, note: number, gain: number, instrument: SoundtrackInstrument, pan = 0) => {
    if (start >= duration) return;
    events.push({ start, duration: Math.min(length, duration - start), frequency: midiFrequency(note), gain, instrument, pan, seed: events.length * 977 + Math.round(note * 13) });
  };
  if (music) {
    const beat = 60 / music.tempo;
    for (let bar = 0; bar * beat * 4 < duration; bar += 1) {
      const start = bar * beat * 4;
      const chord = music.progression[bar % music.progression.length];
      [0, 2, 4].forEach((degree, voice) => {
        add(start, beat * 4 + 0.35, scaleNote(music, chord + degree), 0.024, "pad", (voice - 1) * 0.42);
      });
      add(start + 0.05, beat * 1.65, scaleNote(music, chord, -1), 0.075, "bass", -0.08);
      if (music.percussion !== "none") add(start + beat * 2, beat * 1.4, scaleNote(music, chord + 4, -1), 0.053, "bass", 0.08);
      if (music.percussion === "pulse" || music.percussion === "brush") {
        add(start, 0.24, 34, 0.045, "kick");
        add(start + beat * 2, 0.22, 34, 0.033, "kick");
      }
      if (music.percussion === "brush") {
        add(start + beat, 0.18, 72, 0.013, "brush", -0.15);
        add(start + beat * 3, 0.18, 72, 0.016, "brush", 0.15);
      }
      if (music.percussion === "shaker" || music.percussion === "click") {
        for (let step = 0; step < 8; step += 1) {
          add(start + step * beat / 2, music.percussion === "shaker" ? 0.075 : 0.04, 78, step % 2 ? 0.011 : 0.006, music.percussion, step % 2 ? 0.36 : -0.36);
        }
      }
    }
    for (let phrase = 0; phrase * 16 * beat < duration; phrase += 1) {
      music.melody.forEach((degree, index) => {
        const time = phrase * 16 * beat + music.rhythm[index] * beat + 0.12;
        const chordIndex = Math.floor(music.rhythm[index] / 4) % music.progression.length;
        const phraseDegree = degree + (phrase % 2 ? 2 : 0);
        // Strong beats land on chord tones; the remaining notes connect them.
        const note = index % 2 === 0 ? music.progression[chordIndex] + (phraseDegree % 3) * 2 : phraseDegree;
        add(time, beat * (music.instrument === "bell" ? 2.6 : music.instrument === "reed" ? 1.3 : 1.8), scaleNote(music, note, 1), 0.072, music.instrument, (index % 3 - 1) * 0.22);
      });
    }
    soundtrackCueTimes(storyboard).forEach((timeMs, index) => {
      const time = timeMs / 1000;
      const degree = music.melody[index % music.melody.length];
      add(time, music.cue === "sweep" ? 0.3 : 0.38, scaleNote(music, degree, 2), 0.043, music.cue, index % 2 ? 0.25 : -0.25);
      if (music.cue === "chime" || music.cue === "glass") add(time + 0.075, 0.34, scaleNote(music, degree + 2, 2), 0.022, music.cue, index % 2 ? -0.25 : 0.25);
    });
  } else {
    // Historical exports retain their original short cues.
    soundtrackCueTimes(storyboard).forEach((timeMs, index) => {
      events.push({ start: timeMs / 1000, duration: 0.24, frequency: storyboard.theme.sound[index % storyboard.theme.sound.length], gain: 0.055, instrument: "chime", pan: index % 2 ? 0.15 : -0.15, seed: index });
    });
  }
  return { duration, events: events.sort((left, right) => left.start - right.start) };
}

function noise(frame: number, seed: number): number {
  let value = Math.imul(frame + seed * 131, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 2147483648 - 1;
}

function instrumentSample(event: SoundtrackEvent, t: number, frame: number): number {
  const phase = Math.PI * 2 * event.frequency * t;
  const attack = Math.min(1, t / (event.instrument === "pad" ? 0.18 : 0.008));
  const release = Math.min(1, Math.max(0, event.duration - t) / (event.instrument === "pad" ? 0.32 : 0.055));
  let value: number;
  switch (event.instrument) {
    case "pad": value = (Math.sin(phase) + 0.23 * Math.sin(phase * 2.002) + 0.11 * Math.sin(phase * 3)) * 0.65; break;
    case "bass": value = (Math.sin(phase) + 0.16 * Math.sin(phase * 2)) * Math.exp(-t * 2.3); break;
    case "keys": value = (Math.sin(phase + 0.45 * Math.sin(phase * 2) * Math.exp(-t * 4)) + 0.15 * Math.sin(phase * 3)) * Math.exp(-t * 2.1); break;
    case "pluck": value = (Math.sin(phase) + 0.36 * Math.sin(phase * 2) + 0.17 * Math.sin(phase * 3)) * Math.exp(-t * 4.4); break;
    case "bell": case "glass": value = (Math.sin(phase) + 0.3 * Math.sin(phase * 2.76) * Math.exp(-t * 4) + 0.12 * Math.sin(phase * 5.4)) * Math.exp(-t * 2.8); break;
    case "mallet": case "wood": value = (Math.sin(phase) + 0.34 * Math.sin(phase * 3.98) * Math.exp(-t * 12)) * Math.exp(-t * 7); break;
    case "reed": value = (Math.sin(phase + 0.018 * Math.sin(t * 31)) + 0.16 * Math.sin(phase * 3) + 0.06 * Math.sin(phase * 5)) * Math.exp(-t * 1.8); break;
    case "kick": value = Math.sin(2 * Math.PI * (42 * t + 45 * (1 - Math.exp(-t * 24)) / 24)) * Math.exp(-t * 18); break;
    case "brush": value = (noise(frame, event.seed) - noise(frame - 1, event.seed)) * Math.exp(-t * 23) * 0.5; break;
    case "shaker": value = noise(frame, event.seed) * Math.sin(Math.PI * t / event.duration) * Math.exp(-t * 22); break;
    case "click": value = (noise(frame, event.seed) * 0.55 + Math.sin(phase) * 0.45) * Math.exp(-t * 95); break;
    case "sweep": value = noise(frame, event.seed) * Math.sin(Math.PI * t / event.duration) * 0.23 + Math.sin(phase * (1 + t * 0.3)) * Math.exp(-t * 15) * 0.3; break;
    case "drop": value = Math.sin(phase * (1 - Math.min(t, 0.3) * 0.9)) * Math.exp(-t * 14); break;
    case "chime": value = (Math.sin(phase) + 0.2 * Math.sin(phase * 2)) * Math.exp(-t * 8); break;
  }
  return value * attack * release;
}

/** Planar stereo, pure and independent of chunk size / render speed. */
export function fillSoundtrackChunk(target: Float32Array, startFrame: number, frameCount: number, sampleRate: number, soundtrack: Soundtrack): void {
  if (target.length !== frameCount * 2) throw new Error("INVALID_AUDIO_BUFFER_LENGTH");
  target.fill(0);
  for (const event of soundtrack.events) {
    const eventStart = Math.round(event.start * sampleRate);
    const overlapStart = Math.max(startFrame, eventStart);
    const overlapEnd = Math.min(startFrame + frameCount, Math.ceil((event.start + event.duration) * sampleRate));
    if (overlapStart >= overlapEnd) continue;
    const left = Math.cos((event.pan + 1) * Math.PI / 4) * event.gain;
    const right = Math.sin((event.pan + 1) * Math.PI / 4) * event.gain;
    for (let frame = overlapStart; frame < overlapEnd; frame += 1) {
      const t = (frame - eventStart) / sampleRate;
      const sample = instrumentSample(event, t, frame);
      const index = frame - startFrame;
      target[index] += sample * left;
      target[frameCount + index] += sample * right;
    }
  }
  for (let index = 0; index < frameCount; index += 1) {
    const time = (startFrame + index) / sampleRate;
    const fade = Math.max(0, Math.min(1, time / 0.15, (soundtrack.duration - time) / 0.6));
    target[index] = Math.tanh(target[index] * 1.6) * fade;
    target[frameCount + index] = Math.tanh(target[frameCount + index] * 1.6) * fade;
  }
}
