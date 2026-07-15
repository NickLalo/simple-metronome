export function configureAudioSessionForPlayback(navigatorObject = globalThis.navigator) {
  const audioSession = navigatorObject?.audioSession;
  if (!audioSession || !("type" in audioSession)) {
    return false;
  }

  try {
    audioSession.type = "playback";
    return audioSession.type === "playback";
  } catch {
    return false;
  }
}
