import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { resolveAppAsset } = require("../electron/protocol-path.cjs");
const rootDirectory = path.resolve("dist");

test("resolves the desktop entry point", () => {
  assert.equal(resolveAppAsset(rootDirectory, "metronome://app/"), path.join(rootDirectory, "index.html"));
});

test("resolves assets inside the compiled app", () => {
  assert.equal(
    resolveAppAsset(rootDirectory, "metronome://app/assets/main.js"),
    path.join(rootDirectory, "assets", "main.js"),
  );
});

test("rejects other origins and malformed URLs", () => {
  assert.equal(resolveAppAsset(rootDirectory, "https://example.com/index.html"), null);
  assert.equal(resolveAppAsset(rootDirectory, "not a URL"), null);
});

test("rejects encoded paths that escape the compiled app", () => {
  assert.equal(resolveAppAsset(rootDirectory, "metronome://app/%2e%2e%2fsecret.txt"), null);
  assert.equal(resolveAppAsset(rootDirectory, "metronome://app/%2e%2e%5csecret.txt"), null);
});
