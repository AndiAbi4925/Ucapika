const test = require("node:test");
const assert = require("node:assert/strict");
const {
  addTeardown,
  createRendererServer,
  installBrowserGlobals,
} = require("../lib/rendererTestHarness");

test("Ucapika repairs hosted defaults before hydration and sends cleanup to the local model", async (t) => {
  const calls = [];
  const { storage } = installBrowserGlobals(t, {
    initialStorage: {
      _providerSettingsMigrated: "1",
      cleanupMode: "openwhispr",
      cleanupCloudMode: "openwhispr",
      dictationAgentMode: "openwhispr",
      transcriptionMode: "openwhispr",
      useLocalWhisper: "true",
      useCleanupModel: "true",
      whisperModel: "base",
    },
    window: {
      electronAPI: {
        product: "ucapika",
        processLocalReasoning: async (prompt, model) => {
          calls.push({ prompt, model });
          return { success: true, text: "The draft is ready." };
        },
      },
    },
  });
  const vite = await createRendererServer(t);
  const { getSettings, selectResolvedLLMConfig, useSettingsStore } = await vite.ssrLoadModule(
    "/stores/settingsStore.ts"
  );
  const { default: reasoning } = await vite.ssrLoadModule("/services/ReasoningService.ts");
  addTeardown(t, () => reasoning.destroy());

  for (const key of ["transcriptionMode", "cleanupMode", "dictationAgentMode"]) {
    assert.equal(useSettingsStore.getState()[key], "local");
    assert.equal(storage.getItem(key), "local");
  }
  assert.equal(getSettings().whisperModel, "base");
  assert.equal(getSettings().useCleanupModel, true);
  assert.equal(getSettings().allowOpenAIFallback, false);

  // An inherited settings update must be harmless to the active request routes.
  useSettingsStore.setState({
    cleanupMode: "openwhispr",
    cleanupCloudMode: "openwhispr",
    cleanupModel: "",
    dictationAgentMode: "openwhispr",
    cloudTranscriptionProvider: "custom",
    cloudTranscriptionBaseUrl: "https://example.invalid/v1",
    isSignedIn: true,
  });
  const settings = getSettings();
  const cleanup = selectResolvedLLMConfig(settings, "dictationCleanup");
  const edit = selectResolvedLLMConfig(settings, "dictationAgent");
  assert.equal(cleanup.mode, "local");
  assert.equal(edit.mode, "local");
  assert.equal(edit.model, cleanup.model);
  assert.equal(settings.cloudTranscriptionProvider, "openai");
  assert.equal(settings.cloudTranscriptionBaseUrl, "https://api.openai.com/v1");

  assert.equal(
    await reasoning.processText("um the draft is ready", cleanup.model, null, {
      inferenceScope: "dictationCleanup",
    }),
    "The draft is ready."
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, "qwen3.5-2b-q4_k_m");
  assert.match(calls[0].prompt, /um the draft is ready/);
});

test("Ucapika answers session checks locally without calling the hosted API", async (t) => {
  installBrowserGlobals(t, { window: { electronAPI: { product: "ucapika" } } });
  const network = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected network request from the standalone app");
  });
  const vite = await createRendererServer(t);
  const { authClient } = await vite.ssrLoadModule("/lib/auth.ts");
  const { OPENWHISPR_API_URL } = await vite.ssrLoadModule("/config/constants.ts");

  const session = await authClient.getSession();
  assert.equal(session.data, null);
  assert.equal(session.error, null);
  assert.equal(OPENWHISPR_API_URL, "");
  assert.equal(network.mock.callCount(), 0);
});
