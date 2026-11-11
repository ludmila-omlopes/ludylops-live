"use client";

import { useEffect } from "react";

let alertAudioContext: AudioContext | null = null;

/** The short rising chime first used by the new-subscriber overlay. */
export async function playAlertChime(volume = 0.8) {
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return;
  }

  alertAudioContext ??= new AudioContextCtor();

  if (alertAudioContext.state === "suspended") {
    await alertAudioContext.resume();
  }

  // The original chime was tuned for the default volume of 0.8.
  const scale = volume / 0.8;
  const startAt = alertAudioContext.currentTime + 0.02;
  const notes = [
    { frequency: 392, delay: 0, duration: 0.14, gain: 0.045 },
    { frequency: 523.25, delay: 0.1, duration: 0.16, gain: 0.05 },
    { frequency: 659.25, delay: 0.22, duration: 0.2, gain: 0.052 },
    { frequency: 783.99, delay: 0.36, duration: 0.22, gain: 0.045 },
  ];

  notes.forEach((note) => {
    const oscillator = alertAudioContext!.createOscillator();
    const gainNode = alertAudioContext!.createGain();
    const noteStart = startAt + note.delay;
    const noteEnd = noteStart + note.duration;

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(note.frequency, noteStart);
    gainNode.gain.setValueAtTime(0.0001, noteStart);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(note.gain * scale, 0.0001), noteStart + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.connect(gainNode);
    gainNode.connect(alertAudioContext!.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.03);
  });
}

export type AlertSoundSettings = { muted: boolean; soundUrl: string | null; volume: number };

/**
 * Reads `sound`/`soundUrl` and `volume` from an OBS browser source link.
 * `sound=off` (or `volume=0`) silences the overlay; any other value is the URL of a custom audio file.
 */
export function readAlertSoundSettings(searchParams: { get(name: string): string | null }): AlertSoundSettings {
  const sound = (searchParams.get("soundUrl") ?? searchParams.get("sound") ?? "").trim();
  const rawVolume = Number(searchParams.get("volume") ?? "0.8");
  const volume = Number.isFinite(rawVolume) ? Math.min(Math.max(rawVolume, 0), 1) : 0.8;
  const muted = ["off", "0", "false", "none"].includes(sound.toLowerCase()) || volume === 0;
  return { muted, soundUrl: muted || !sound ? null : sound, volume };
}

/** Plays the custom file when one is set, otherwise the default chime. Rejects when autoplay is blocked. */
export async function playAlertSound({ muted, soundUrl, volume }: AlertSoundSettings) {
  if (muted) {
    return;
  }

  if (soundUrl) {
    const audio = new Audio(soundUrl);
    audio.volume = volume;
    await audio.play();
    return;
  }

  await playAlertChime(volume);
}

/** Plays the alert sound once each time a different alert appears on screen. */
export function useAlertSound(alertId: string | null, { muted, soundUrl, volume }: AlertSoundSettings) {
  useEffect(() => {
    if (!alertId) {
      return;
    }
    void playAlertSound({ muted, soundUrl, volume }).catch(() => {
      // Browser autoplay can block audio outside OBS; the visual alert still works.
    });
  }, [alertId, muted, soundUrl, volume]);
}
