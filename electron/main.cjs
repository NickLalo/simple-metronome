const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, net, protocol, session } = require("electron");
const isSquirrelStartup = require("electron-squirrel-startup");
const { APP_ORIGIN, resolveAppAsset } = require("./protocol-path.cjs");

const APP_SCHEME = "metronome";
const APP_URL = `${APP_ORIGIN}/index.html`;
const DIST_DIRECTORY = path.join(__dirname, "..", "dist");

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      codeCache: true,
      secure: true,
      standard: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
]);

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, (request) => {
    const assetPath = resolveAppAsset(DIST_DIRECTORY, request.url);

    if (!assetPath) {
      return new Response("Not found", { status: 404 });
    }

    return net.fetch(pathToFileURL(assetPath).toString());
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1160,
    height: 850,
    minWidth: 680,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#d8d0c9",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      devTools: !app.isPackaged,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    if (navigationUrl !== APP_URL) {
      event.preventDefault();
    }
  });

  mainWindow.loadURL(APP_URL).catch((error) => {
    console.error("Unable to load the desktop app:", error);
    app.quit();
  });
}

if (isSquirrelStartup) {
  app.quit();
} else {
  const hasSingleInstanceLock = app.requestSingleInstanceLock();

  if (!hasSingleInstanceLock) {
    app.quit();
  } else {
    app.setAppUserModelId("com.squirrel.SimpleMetronome.SimpleMetronome");

    app.on("second-instance", () => {
      const mainWindow = BrowserWindow.getAllWindows()[0];

      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
      }
    });

    app.whenReady().then(() => {
      registerAppProtocol();
      session.defaultSession.setPermissionCheckHandler(() => false);
      session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
      createWindow();

      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });
    });

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });
  }
}
