import assert from "node:assert/strict";
import test from "node:test";
import { configureAudioSessionForPlayback } from "../src/audio-session.js";

test("configureAudioSessionForPlayback uses the playback session when supported", () => {
  const navigatorObject = { audioSession: { type: "auto" } };

  assert.equal(configureAudioSessionForPlayback(navigatorObject), true);
  assert.equal(navigatorObject.audioSession.type, "playback");
});

test("configureAudioSessionForPlayback safely ignores unsupported browsers", () => {
  assert.equal(configureAudioSessionForPlayback({}), false);
});

test("configureAudioSessionForPlayback handles a read-only session type", () => {
  const navigatorObject = { audioSession: Object.freeze({ type: "auto" }) };

  assert.equal(configureAudioSessionForPlayback(navigatorObject), false);
});
