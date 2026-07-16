const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { flipFuses, FuseV1Options, FuseVersion } = require("@electron/fuses");

const iconBase = path.join(__dirname, "build", "icon");
const canCreateZip = process.platform === "win32" || spawnSync("zip", ["-v"], { stdio: "ignore" }).status === 0;
const fuseConfig = {
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
  [FuseV1Options.WasmTrapHandlers]: true,
};

function electronExecutablePath(buildPath, platform) {
  const packageRoot = path.resolve(buildPath, "..", "..");

  if (platform === "darwin" || platform === "mas") {
    return path.join(packageRoot, "MacOS", "Electron");
  }

  return path.join(packageRoot, platform === "win32" ? "electron.exe" : "electron");
}

module.exports = {
  packagerConfig: {
    appBundleId: "io.github.nicklalo.simple-metronome",
    appCategoryType: "public.app-category.music",
    asar: true,
    executableName: "simple-metronome",
    icon: iconBase,
    ignore: [
      /^\/(?!(?:package\.json$|electron(?:\/|$)|dist(?:\/|$)|build(?:\/|$)|node_modules(?:\/|$))).+/,
      /^\/node_modules\/(?!electron-squirrel-startup(?:\/|$)).+/,
      /^\/build\/icon\.(?:icns|ico)$/,
      /^\/dist\/images\/(?:simple-metronome-demo\.gif|simple-metronome-screenshot\.png)$/,
    ],
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: {
        name: "SimpleMetronome",
        setupIcon: `${iconBase}.ico`,
      },
    },
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: {
        format: "ULFO",
        icon: `${iconBase}.icns`,
      },
    },
    {
      name: "@electron-forge/maker-deb",
      platforms: ["linux"],
      config: {
        options: {
          homepage: "https://nicklalo.github.io/simple-metronome/",
          icon: `${iconBase}.png`,
          maintainer: "Nick Lalo",
        },
      },
    },
    ...(canCreateZip
      ? [
          {
            name: "@electron-forge/maker-zip",
            platforms: ["darwin", "linux", "win32"],
          },
        ]
      : []),
  ],
  hooks: {
    packageAfterCopy: async (_forgeConfig, buildPath, _electronVersion, platform, arch) => {
      await flipFuses(electronExecutablePath(buildPath, platform), {
        ...fuseConfig,
        resetAdHocDarwinSignature: process.platform === "darwin" && platform === "darwin" && arch === "arm64",
      });
    },
  },
};
