const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { Arch, Platform, build } = require("electron-builder");

const target = process.argv[2];
const mac = target === "mac" && process.platform === "darwin";
const windows = target === "win" && process.platform === "win32";
if (!mac && !windows) {
  throw new Error("Build the macOS installer on macOS and the Windows installer on Windows.");
}

const converter = path.join(
  __dirname,
  "..",
  "node_modules",
  "ffmpeg-static",
  windows ? "ffmpeg.exe" : "ffmpeg"
);
const configuration = execFileSync(converter, ["-buildconf"], { encoding: "utf8" });
if (
  !configuration.includes("--disable-autodetect") ||
  !configuration.includes("--enable-shared") ||
  /--enable-(?:nonfree|gpl)/.test(configuration)
) {
  throw new Error("Run bash scripts/build-ucapika-ffmpeg.sh before packaging.");
}

const config = { extends: path.join(__dirname, "..", "electron-builder.json") };
if (mac) {
  const signed = Boolean(process.env.CSC_LINK || process.env.CSC_NAME);
  const notarize =
    signed &&
    Boolean(
      (process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER) ||
      (process.env.APPLE_ID &&
        process.env.APPLE_APP_SPECIFIC_PASSWORD &&
        process.env.APPLE_TEAM_ID) ||
      process.env.APPLE_KEYCHAIN_PROFILE
    );
  config.mac = { notarize, ...(!signed && { identity: "-" }) };
}
const platform = mac ? Platform.MAC : Platform.WINDOWS;
const arch = mac && process.arch === "arm64" ? Arch.arm64 : Arch.x64;
build({
  targets: platform.createTarget([mac ? "dmg" : "nsis"], arch),
  config,
  publish: "never",
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
