const { execFileSync } = require("node:child_process");

const tasks = {
  darwin: [
    "compile:globe",
    "compile:fast-paste",
    "compile:text-monitor",
    "compile:mic-listener",
    "compile:managed-policy",
  ],
  win32: [
    "compile:winkeys",
    "compile:winpaste",
    "compile:text-monitor",
    "download:windows-fast-paste",
    "download:windows-key-listener",
  ],
  linux: ["compile:linuxkeys", "compile:linux-paste", "compile:text-monitor"],
};

for (const task of [
  ...tasks[process.platform],
  "download:whisper-cpp",
  "download:llama-server",
  "download:sherpa-onnx",
  "download:whisper-vad-model",
]) {
  execFileSync(process.execPath, [process.env.npm_execpath, "run", task], { stdio: "inherit" });
}
