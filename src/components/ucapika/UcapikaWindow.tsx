import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronRight, HelpCircle, Copy, Home, Settings } from "../icons";
import { UCAPIKA_SPEECH_MODEL } from "../../config/ucapikaModels";
import wordmark from "../../assets/ucapika-mark.svg";
import { useControlPanelWindowDrag } from "../../hooks/useControlPanelWindowDrag";
import { useUcapikaMicrophone } from "../../hooks/useUcapikaMicrophone";
import { useUcapikaModels } from "../../hooks/useUcapikaModels";
import { useSettingsStore } from "../../stores/settingsStore";
import type { TranscriptionItem } from "../../types/electron";
import { getPlatform } from "../../utils/platform";
import { isGlobeLikeHotkey } from "../../utils/hotkeys";
import { HotkeyInput } from "../ui/HotkeyInput";
import "./ucapika.css";

const isMac = getPlatform() === "darwin";
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const startKey = "onboardingCompleted";
const sections = [
  { label: "Home", Icon: Home },
  { label: "Settings", Icon: Settings },
  { label: "About", Icon: HelpCircle },
] as const;

type Section = (typeof sections)[number]["label"];

function Card({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <section className="uc-card">
      <h2>{title}</h2>
      {detail && <p>{detail}</p>}
      {children}
    </section>
  );
}

function ModelDownload({
  ready,
  progress,
  error,
  download,
}: {
  ready: boolean;
  progress: number | null;
  error: string;
  download: () => void;
}) {
  if (ready)
    return (
      <span className="uc-ready">
        <Check size={14} /> Ready
      </span>
    );
  if (progress !== null) {
    return (
      <div className="uc-progress" role="status">
        <progress aria-label="Model download" value={progress} max={100} />
        <span>{progress >= 100 ? "Finalizing…" : `${Math.round(progress)}%`}</span>
      </div>
    );
  }
  return (
    <>
      <button className="uc-button" type="button" onClick={download}>
        {error ? "Retry download" : "Download model"}
      </button>
      {error && (
        <p role="alert" className="uc-error">
          {error}
        </p>
      )}
    </>
  );
}

export function UcapikaWindow() {
  useControlPanelWindowDrag(true);
  const api = window.electronAPI;
  const [section, setSection] = useState<Section>("Home");
  const [configured, setConfigured] = useState(() => localStorage.getItem(startKey) === "true");
  const [history, setHistory] = useState<TranscriptionItem[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [micAllowed, setMicAllowed] = useState(false);
  const [accessAllowed, setAccessAllowed] = useState(!isMac);
  const [dictationKey, setDictationKey] = useState("");
  const [editKey, setEditKey] = useState("");
  const [shortcutError, setShortcutError] = useState("");
  const [permissionError, setPermissionError] = useState("");
  const model = useSettingsStore((state) => state.whisperModel);
  const language = useSettingsStore((state) => state.preferredLanguage);
  const selectedMic = useSettingsStore((state) => state.selectedMicDeviceId);
  const cleanupEnabled = useSettingsStore((state) => state.useCleanupModel);
  const models = useUcapikaModels(model);
  const mic = useUcapikaMicrophone(selectedMic);
  const dictationLabel =
    isMac && (!dictationKey || isGlobeLikeHotkey(dictationKey))
      ? "Fn × 2"
      : dictationKey || "Ctrl + Win";

  useEffect(() => {
    if (!api) return;
    void api.setOnboardingWindowMode?.("restore");
    let active = true;
    const refreshPermissions = () => {
      void api
        .checkMicrophoneAccess?.()
        .then((result) => {
          if (active) setMicAllowed(result.granted);
        })
        .catch(() => {});
      if (isMac) {
        void api
          .checkAccessibilityPermission(true)
          .then((granted) => {
            if (active) setAccessAllowed(granted);
          })
          .catch(() => {});
      }
    };
    const refreshHistory = () => {
      void api
        .getTranscriptions(30)
        .then((rows) => {
          if (active)
            setHistory(rows.filter((row) => row.status === "completed" && row.text.trim()));
        })
        .catch(() => {
          if (active) setHistoryError("Could not load recent dictations.");
        });
    };
    void api.getActiveDictationKey?.().then((key) => {
      if (active) setDictationKey(key || "");
    });
    void api.getVoiceAgentKey?.().then((key) => {
      if (active) setEditKey(key || "");
    });
    refreshPermissions();
    refreshHistory();
    const permissionTimer = window.setInterval(refreshPermissions, 1500);
    const stop = [
      api.onTranscriptionAdded?.(refreshHistory),
      api.onTranscriptionUpdated?.(refreshHistory),
      api.onTranscriptionDeleted?.(refreshHistory),
      api.onTranscriptionsCleared?.(refreshHistory),
      api.onShowSettings?.(() => setSection("Settings")),
    ];
    return () => {
      active = false;
      window.clearInterval(permissionTimer);
      stop.forEach((cleanup) => cleanup?.());
    };
  }, [api]);

  useEffect(() => {
    if (!api || !configured) return;
    void api.setOnboardingActive?.(false);
    if (isMac && accessAllowed) api.markMacAccessibilityFeaturesReady?.();
  }, [accessAllowed, api, configured]);

  useEffect(() => {
    mic.setTesting(false);
  }, [section, mic.setTesting]);

  async function requestMicrophone() {
    setPermissionError("");
    try {
      const response = await api?.requestMicrophoneAccess?.();
      if (response?.granted) setMicAllowed(true);
      else if (isMac) await api?.openMicrophoneSettings?.();
    } catch {
      setPermissionError("Open System Settings to enable microphone access.");
    }
  }

  async function requestAccessibility() {
    setPermissionError("");
    try {
      const granted = await api?.promptAccessibilityPermission();
      if (granted) setAccessAllowed(true);
      else await api?.openAccessibilitySettings?.();
    } catch {
      setPermissionError("Open System Settings to enable Accessibility for Ucapika.");
    }
  }

  async function saveShortcut(key: string, target: "dictation" | "edit") {
    setShortcutError("");
    try {
      const result =
        target === "dictation"
          ? await api?.updateHotkey(key)
          : await api?.updateVoiceAgentHotkey?.(key);
      if (!result?.success) throw new Error(result?.message || "That shortcut is unavailable.");
      if (target === "dictation") setDictationKey(key);
      else setEditKey(key);
    } catch (error) {
      setShortcutError(error instanceof Error ? error.message : "Could not save the shortcut.");
    }
  }

  async function copy(row: TranscriptionItem) {
    try {
      await navigator.clipboard.writeText(row.text);
      setCopied(row.id);
    } catch {
      setHistoryError("The clipboard is unavailable.");
    }
  }

  const permissions = (
    <Card
      title="Permissions"
      detail="Ucapika uses your microphone to listen and Accessibility to type at the cursor on Mac."
    >
      <div className="uc-actions">
        <button
          className="uc-button"
          type="button"
          disabled={micAllowed}
          onClick={() => void requestMicrophone()}
        >
          {micAllowed ? "Microphone enabled" : "Enable microphone"}
        </button>
        {isMac && (
          <button
            className="uc-button"
            type="button"
            disabled={accessAllowed}
            onClick={() => void requestAccessibility()}
          >
            {accessAllowed ? "Accessibility enabled" : "Enable Accessibility"}
          </button>
        )}
      </div>
      {permissionError && (
        <p role="alert" className="uc-error">
          {permissionError}
        </p>
      )}
    </Card>
  );

  const modelCards = (
    <div className="uc-grid">
      <Card title="Speech recognition" detail="Transcribe on this device.">
        <label className="uc-field">
          Whisper model
          <select
            value={model}
            disabled={models.speech.progress !== null}
            onChange={(event) => useSettingsStore.getState().setWhisperModel(event.target.value)}
          >
            <option value={UCAPIKA_SPEECH_MODEL}>Turbo Q5 · 574 MB</option>
            <option value="base">Base · 142 MB</option>
            <option value="tiny">Tiny · 75 MB</option>
          </select>
        </label>
        <ModelDownload {...models.speech} download={() => void models.downloadSpeech()} />
      </Card>
      <Card title="Writing assistance" detail="Qwen3.5 2B Q4 · 1.4 GB for cleanup and voice edits.">
        <ModelDownload {...models.text} download={() => void models.downloadText()} />
        {models.text.ready && (
          <label className="uc-check">
            <input
              type="checkbox"
              checked={cleanupEnabled}
              onChange={(event) =>
                useSettingsStore.getState().setUseCleanupModel(event.target.checked)
              }
            />
            Clean up dictation
          </label>
        )}
      </Card>
    </div>
  );

  return (
    <main className="uc-shell" data-platform={isMac ? "mac" : "other"}>
      <aside className="uc-sidebar">
        <div className="uc-wordmark">
          <img src={wordmark} alt="" width={28} height={28} /> Ucapika
        </div>
        <nav aria-label="Primary">
          {sections.map(({ label, Icon }) => (
            <button
              type="button"
              key={label}
              aria-current={section === label ? "page" : undefined}
              onClick={() => setSection(label)}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <span className="uc-local">
          <span /> On-device processing
        </span>
      </aside>
      <div className="uc-canvas">
        {section === "Home" && (
          <>
            <header className="uc-header">
              <h1>{configured ? "Dictation" : "Set up dictation"}</h1>
              <p>
                {configured
                  ? "Speak wherever you write."
                  : "Download a speech model and enable microphone access to begin."}
              </p>
            </header>
            {configured ? (
              <>
                <div className="uc-grid">
                  <Card
                    title="Dictate anywhere"
                    detail="Start and stop recording from the app you’re writing in."
                  >
                    <kbd>{dictationLabel}</kbd>
                  </Card>
                  <Card
                    title="Edit by voice"
                    detail="Select text, use the shortcut, then say how to rewrite it."
                  >
                    {editKey ? (
                      <kbd>{editKey}</kbd>
                    ) : (
                      <button
                        type="button"
                        className="uc-button"
                        onClick={() => setSection("Settings")}
                      >
                        Set voice-edit shortcut <ChevronRight size={14} />
                      </button>
                    )}
                  </Card>
                </div>
                <section className="uc-history">
                  <h2>Recent dictations</h2>
                  {historyError && <p role="alert">{historyError}</p>}
                  {!history.length && <p>Your dictated text will appear here.</p>}
                  {history.map((row) => (
                    <article key={row.id} className="uc-history-row">
                      <div>
                        <time dateTime={row.timestamp}>
                          {Number.isFinite(Date.parse(row.timestamp))
                            ? dateTime.format(new Date(row.timestamp))
                            : ""}
                        </time>
                        <p>{row.text}</p>
                      </div>
                      <button
                        type="button"
                        className="uc-copy"
                        aria-label="Copy dictation"
                        onClick={() => void copy(row)}
                      >
                        {copied === row.id ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </article>
                  ))}
                </section>
              </>
            ) : (
              <>
                {permissions}
                {modelCards}
                <button
                  className="uc-button uc-primary"
                  type="button"
                  disabled={!models.speech.ready || !micAllowed || !accessAllowed}
                  onClick={() => {
                    localStorage.setItem(startKey, "true");
                    setConfigured(true);
                  }}
                >
                  Finish setup
                </button>
              </>
            )}
          </>
        )}
        {section === "Settings" && (
          <>
            <header className="uc-header">
              <h1>Settings</h1>
            </header>
            <div className="uc-grid">
              <Card title="Shortcuts">
                <div className="uc-shortcut">
                  <span>
                    Dictation {isMac && isGlobeLikeHotkey(dictationKey) && "· press twice"}
                  </span>
                  <HotkeyInput
                    value={dictationKey}
                    onChange={(key) => void saveShortcut(key, "dictation")}
                  />
                </div>
                <div className="uc-shortcut">
                  <span>Voice edit</span>
                  <HotkeyInput value={editKey} onChange={(key) => void saveShortcut(key, "edit")} />
                </div>
                {isMac && (
                  <p>
                    For Fn × 2, set the Globe/Fn key action to Do Nothing in macOS Keyboard settings
                    if system dictation opens.
                  </p>
                )}
                {shortcutError && (
                  <p role="alert" className="uc-error">
                    {shortcutError}
                  </p>
                )}
              </Card>
              <Card title="Microphone">
                <label className="uc-field">
                  Input device
                  <select
                    value={selectedMic}
                    onChange={(event) => {
                      const id = event.target.value;
                      const state = useSettingsStore.getState();
                      state.setSelectedMicDevice(
                        id,
                        mic.devices.find((device) => device.deviceId === id)?.label || ""
                      );
                      state.setMicrophoneSelectionMode(id ? "specific" : "system");
                    }}
                  >
                    <option value="">System default</option>
                    {mic.devices
                      .filter((device) => device.deviceId && device.deviceId !== "default")
                      .map((device, i) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Microphone ${i + 1}`}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="uc-progress">
                  <meter aria-label="Microphone input level" min={0} max={1} value={mic.level} />
                  <button
                    className="uc-button"
                    type="button"
                    onClick={() => mic.setTesting(!mic.testing)}
                  >
                    {mic.testing ? "Stop test" : "Test input"}
                  </button>
                </div>
                {mic.error && (
                  <p role="alert" className="uc-error">
                    {mic.error}
                  </p>
                )}
              </Card>
            </div>
            {modelCards}
            <Card title="Dictation language">
              <label className="uc-field">
                Language
                <select
                  value={language}
                  onChange={(event) =>
                    useSettingsStore.getState().setPreferredLanguage(event.target.value)
                  }
                >
                  <option value="auto">Automatic</option>
                  <option value="en">English</option>
                  <option value="id">Indonesian</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="ja">Japanese</option>
                  <option value="zh">Chinese</option>
                </select>
              </label>
            </Card>
            {permissions}
          </>
        )}
        {section === "About" && (
          <>
            <header className="uc-header">
              <h1>About Ucapika</h1>
              <p>Desktop dictation and voice editing.</p>
            </header>
            <Card title="Open-source licenses">
              <ul className="uc-licenses">
                {[
                  [
                    "OpenWhispr",
                    "MIT",
                    "https://github.com/OpenWhispr/openwhispr/blob/main/LICENSE",
                  ],
                  [
                    "Whisper weights and runtime",
                    "MIT",
                    "https://github.com/openai/whisper/blob/main/LICENSE",
                  ],
                  [
                    "Qwen3.5 2B model",
                    "Apache 2.0",
                    "https://huggingface.co/Qwen/Qwen3.5-2B/blob/main/LICENSE",
                  ],
                  ["llama.cpp", "MIT", "https://github.com/ggml-org/llama.cpp/blob/master/LICENSE"],
                  ["Electron", "MIT", "https://github.com/electron/electron/blob/main/LICENSE"],
                  [
                    "Inter and Instrument Serif",
                    "SIL Open Font License 1.1",
                    "https://openfontlicense.org/open-font-license-official-text/",
                  ],
                ].map(([name, license, link]) => (
                  <li key={name}>
                    <button type="button" onClick={() => void api?.openExternal?.(link)}>
                      {name}
                    </button>
                    <span>{license}</span>
                  </li>
                ))}
              </ul>
              <p>Based on OpenWhispr. Copyright © 2024 OpenWhispr Team.</p>
              <p>
                Model weights are downloaded separately. The MIT and Apache licenses require
                preserving applicable notices on redistribution.
              </p>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
