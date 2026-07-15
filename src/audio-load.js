export const AUDIO_LOAD_TIMEOUT_MS = 2_000;

export class AudioLoadTimeoutError extends Error {
  constructor(timeoutMs = AUDIO_LOAD_TIMEOUT_MS) {
    super(`Metronome audio did not load within ${timeoutMs} milliseconds.`);
    this.name = "AudioLoadTimeoutError";
  }
}

export async function waitForAudioLoad(loadPromise, timeoutMs = AUDIO_LOAD_TIMEOUT_MS) {
  let timeoutId;
  const timeoutPromise = new Promise((resolve, reject) => {
    timeoutId = globalThis.setTimeout(() => reject(new AudioLoadTimeoutError(timeoutMs)), timeoutMs);
  });

  try {
    await Promise.race([loadPromise, timeoutPromise]);
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
