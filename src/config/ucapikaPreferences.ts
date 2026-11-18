import { UCAPIKA_SPEECH_MODEL, UCAPIKA_TEXT_MODEL } from "./ucapikaModels";

// Seed new Ucapika profiles before the shared settings store reads them.
const defaults = {
  useLocalWhisper: "true",
  transcriptionMode: "local",
  whisperModel: UCAPIKA_SPEECH_MODEL,
  useCleanupModel: "false",
  cleanupMode: "local",
  cleanupProvider: "qwen",
  cleanupModel: UCAPIKA_TEXT_MODEL,
  dictationAgentMode: "local",
  dictationAgentProvider: "qwen",
  dictationAgentModel: UCAPIKA_TEXT_MODEL,
  floatingIconAutoHide: "true",
  audioRetentionDays: "0",
};

for (const [key, value] of Object.entries(defaults)) {
  if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
}
