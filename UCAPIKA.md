# Ucapika

Ucapika is a local-first desktop dictation and voice-editing app built from OpenWhispr. It keeps transcription history in the existing embedded SQLite database and uses the upstream local inference sidecars. No separate service or account is required for the default workflow.

## Install

1. Open the [installer workflow](https://github.com/AndiAbi4925/Ucapika/actions/workflows/ucapika-build.yml) and choose a successful run for the branch or tag you want.
2. On macOS, download the artifact for your architecture, unzip it, open the DMG and drag Ucapika into Applications. Launch it from Applications. For a trusted, unnotarized build blocked by Gatekeeper, follow [Apple’s Open Anyway steps](https://support.apple.com/en-us/102445).
3. On Windows x64, unzip the Windows artifact and run the NSIS installer. If SmartScreen flags your trusted unsigned build, choose **More info** and **Run anyway** when available. [Microsoft SmartScreen guide](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)
4. At first launch, enable Microphone and, on macOS, Accessibility. On macOS versions that show **Device Control and Data Access**, find Ucapika there under **Privacy & Security**. Select a speech model and download it. Install the writing model to enable voice editing and model-based cleanup. Click **Finish setup**.

## Shortcuts

| Action | macOS | Windows |
| --- | --- | --- |
| Start or stop dictation | Tap Fn twice | Ctrl + Win |
| Start or apply an edit to selected text | Cmd + Option + Shift + E | Ctrl + Alt + Shift + E |

Focus a text field before dictating. For editing, select editable text in the target app, press the edit shortcut, speak your instruction, then use the same shortcut to apply it. Use the target app’s standard Undo command to revert a replacement. The **Shortcuts** card in Settings captures a new combination and reports conflicts. If macOS also starts its own dictation on double-Fn, change **System Settings → Keyboard → Press Fn key to → Do Nothing**. [Apple Keyboard settings](https://support.apple.com/en-mt/guide/mac-help/kbdm162/27/mac/27)

## Build from source

Use Node.js 24 and the native platform toolchain. On macOS install Xcode Command Line Tools. On Windows run the FFmpeg preparation script in an MSYS2 UCRT64 shell with GCC, curl, tar, and make. Run packaging in a regular Windows shell with the MSVC build environment for native helpers.

```bash
npm ci
npm run dev
```

```bash
# macOS, native architecture
bash scripts/build-ucapika-ffmpeg.sh
npm run build:mac
open dist/*.dmg
```

```sh
# Windows x64, after npm ci and FFmpeg preparation
npm run build:win
```

The macOS build is ad-hoc signed by default. The Windows installer is unsigned by default. Set `CSC_LINK` and `CSC_KEY_PASSWORD` on macOS to supply your Developer ID certificate. For notarization, set `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` or provide the App Store Connect API key variables. Windows signing uses `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`. In GitHub Actions the macOS signing secrets are prefixed with `MAC_`. Installer artifacts are uploaded on pushes to `ucapika/main-build`, `main`, and version tags.

## Models and data

- **Whisper Large v3 Turbo Q5**, 574 MB, is the multilingual default. It uses whisper.cpp and supports Metal acceleration on Apple Silicon. The Base and Tiny models reduce disk and compute use.
- **Qwen3.5 2B Q4_K_M**, about 1.4 GB, handles text cleanup and selection edits via llama.cpp. It is sized for the M4 Mac’s 16 GB of unified memory. Model files download separately from the app.
- Settings and history live in Electron’s user-data directory. On macOS that is `~/Library/Application Support/Ucapika` and `~/Library/Application Support/Ucapika-development` for dev mode. On Windows it is `%APPDATA%\Ucapika`. The inherited local model cache is `~/.cache/openwhispr` or `%USERPROFILE%\.cache\openwhispr`.
- New profiles keep transcript history locally and set audio retention to zero. OpenWhispr’s marketing and product-event collectors are disabled by default. Built-in speech and writing model routing is local.
- **Cloud speech fallback** in Settings is opt-in. With your own OpenAI key, Ucapika can retry a failed local transcription with OpenAI. Writing assistance continues to use the downloaded local model.

## Attribution

OpenWhispr is MIT-licensed. The original [LICENSE](LICENSE) and copyright notice are included. The [Whisper code and weights](https://github.com/openai/whisper) and [llama.cpp](https://github.com/ggml-org/llama.cpp) use MIT. [Qwen3.5 2B](https://huggingface.co/Qwen/Qwen3.5-2B/blob/main/LICENSE) uses Apache 2.0, with retention of license and attribution required on redistribution. [Silero VAD](https://github.com/snakers4/silero-vad/blob/master/LICENSE) is MIT. [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx/blob/master/LICENSE) uses Apache 2.0. Inter and Instrument Serif are distributed with their SIL Open Font License notices in `src/assets/fonts/ucapika`. Electron includes Chromium’s third-party notices in the app bundle.

The packaged FFmpeg converter uses [FFmpeg 7.1.4](https://github.com/FFmpeg/FFmpeg/tree/n7.1.4) under LGPL 2.1 or later. Its source archive, build script and license ship in the app’s `bin/ffmpeg-source` resources. FFmpeg runs as a separate process and uses shared libraries.
