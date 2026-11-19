import { UCAPIKA_SPEECH_MODEL, UCAPIKA_TEXT_MODEL } from "./ucapikaModels";

export function isUcapikaDesktop(): boolean {
  return typeof window !== "undefined" && window.electronAPI?.product === "ucapika";
}

export const UCAPIKA_DICTATION_ROUTES = {
  useLocalWhisper: true,
  transcriptionMode: "local",
  localTranscriptionProvider: "whisper",
  cloudTranscriptionMode: "byok",
  cloudTranscriptionProvider: "openai",
  cloudTranscriptionModel: "gpt-4o-mini-transcribe",
  cloudTranscriptionBaseUrl: "https://api.openai.com/v1",
  cleanupMode: "local",
  cleanupProvider: "qwen",
  cleanupModel: UCAPIKA_TEXT_MODEL,
  cleanupCloudMode: "byok",
  dictationAgentMode: "local",
  dictationAgentProvider: "qwen",
  dictationAgentModel: UCAPIKA_TEXT_MODEL,
  dictationAgentCloudMode: "byok",
} as const;

export function initializeUcapikaPreferences(storage: Pick<Storage, "getItem" | "setItem">): void {
  for (const [key, value] of Object.entries(UCAPIKA_DICTATION_ROUTES)) {
    const storedValue = String(value);
    if (storage.getItem(key) !== storedValue) storage.setItem(key, storedValue);
  }

  const defaults = {
    whisperModel: UCAPIKA_SPEECH_MODEL,
    useCleanupModel: "false",
    floatingIconAutoHide: "true",
    audioRetentionDays: "0",
  };
  for (const [key, value] of Object.entries(defaults)) {
    if (storage.getItem(key) === null) storage.setItem(key, value);
  }
}
