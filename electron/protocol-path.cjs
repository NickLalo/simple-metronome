const path = require("node:path");

const APP_HOST = "app";
const APP_ORIGIN = `metronome://${APP_HOST}`;

function resolveAppAsset(rootDirectory, requestUrl) {
  let url;

  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "metronome:" || url.host !== APP_HOST) {
    return null;
  }

  let decodedPath;

  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  if (decodedPath.includes("\0") || decodedPath.includes("\\")) {
    return null;
  }

  const assetPath = decodedPath.replace(/^\/+/, "") || "index.html";
  const resolvedPath = path.resolve(rootDirectory, assetPath);
  const relativePath = path.relative(rootDirectory, resolvedPath);

  if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    return null;
  }

  return resolvedPath;
}

module.exports = { APP_ORIGIN, resolveAppAsset };
