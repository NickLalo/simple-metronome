import assert from "node:assert/strict";
import test from "node:test";
import { AudioLoadTimeoutError, waitForAudioLoad } from "../src/audio-load.js";

test("waitForAudioLoad resolves when audio becomes ready before the timeout", async () => {
  await waitForAudioLoad(Promise.resolve(), 50);
});

test("waitForAudioLoad rejects when audio is not ready before the timeout", async () => {
  await assert.rejects(waitForAudioLoad(new Promise(() => {}), 10), AudioLoadTimeoutError);
});
