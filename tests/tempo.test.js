import assert from "node:assert/strict";
import test from "node:test";
import { TapTempo, TempoRamp, clampInteger } from "../src/tempo.js";

test("clampInteger rounds and constrains numeric input", () => {
  assert.equal(clampInteger(112.6, 40, 240), 113);
  assert.equal(clampInteger(12, 40, 240), 40);
  assert.equal(clampInteger(300, 40, 240), 240);
  assert.equal(clampInteger("not a number", 40, 240, 112), 112);
});

test("TapTempo calculates BPM and averages recent intervals", () => {
  const taps = new TapTempo();

  assert.equal(taps.record(1_000), null);
  assert.equal(taps.record(1_500), 120);
  assert.equal(taps.record(2_010), 119);
  assert.equal(taps.record(2_500), 120);
});

test("TapTempo starts a new sequence after a long pause", () => {
  const taps = new TapTempo({ resetAfter: 1_500 });

  taps.record(1_000);
  assert.equal(taps.record(1_500), 120);
  assert.equal(taps.record(3_100), null);
  assert.equal(taps.record(3_850), 80);
});

test("TempoRamp changes tempo after exactly the configured number of bars", () => {
  const ramp = new TempoRamp({ enabled: true, target: 112, step: 4, barsPerChange: 2 });

  assert.equal(ramp.completeBar(100), null);
  assert.equal(ramp.completeBar(100), 104);
  assert.equal(ramp.completeBar(104), null);
  assert.equal(ramp.completeBar(104), 108);
});

test("TempoRamp stops exactly at the target", () => {
  const ramp = new TempoRamp({ enabled: true, target: 105, step: 4, barsPerChange: 1 });

  assert.equal(ramp.completeBar(103), 105);
  assert.equal(ramp.completeBar(105), null);
});

test("TempoRamp resets its bar count when toggled", () => {
  const ramp = new TempoRamp({ enabled: true, target: 120, step: 4, barsPerChange: 2 });

  assert.equal(ramp.completeBar(100), null);
  ramp.configure({ enabled: false, target: 120, step: 4, barsPerChange: 2 });
  ramp.configure({ enabled: true, target: 120, step: 4, barsPerChange: 2 });
  assert.equal(ramp.completeBar(100), null);
  assert.equal(ramp.completeBar(100), 104);
});
