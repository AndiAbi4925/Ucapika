import { useEffect, useState } from "react";
import { UCAPIKA_TEXT_MODEL } from "../config/ucapikaModels";
import { useSettingsStore } from "../stores/settingsStore";

type Status = {
  ready: boolean;
  progress: number | null;
  error: string;
};

const checking: Status = { ready: false, progress: null, error: "" };

export function useUcapikaModels(speechModel: string) {
  const [speech, setSpeech] = useState(checking);
  const [text, setText] = useState(checking);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    let active = true;
    setSpeech(checking);
    const stop = api.onWhisperDownloadProgress((_event, data) => {
      if (data.model === speechModel) {
        setSpeech((state) => ({ ...state, progress: data.percentage ?? state.progress }));
      }
    });
    const refresh = () => {
      void api.checkModelStatus(speechModel).then(
        (result) => {
          if (active) {
            setSpeech((state) => {
              if (result.downloaded) return { ...checking, ready: true };
              return {
                ...state,
                ready: false,
                progress: result.isDownloading ? (result.downloadProgress ?? 0) : state.progress,
              };
            });
          }
        },
        () => {
          if (active) setSpeech({ ...checking, error: "Could not check the speech model." });
        }
      );
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      stop();
    };
  }, [speechModel]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    let active = true;
    const stop = api.onModelDownloadProgress((_event, data) => {
      if (data.modelId === UCAPIKA_TEXT_MODEL && data.type !== "error") {
        setText((state) => ({ ...state, progress: data.progress }));
      }
    });
    const refresh = () => {
      void api.modelCheck(UCAPIKA_TEXT_MODEL).then(
        (ready) => {
          if (active) {
            setText((state) => (ready ? { ...checking, ready: true } : { ...state, ready: false }));
          }
        },
        () => {
          if (active) setText({ ...checking, error: "Could not check the writing model." });
        }
      );
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      stop();
    };
  }, []);

  async function downloadSpeech() {
    setSpeech({ ...checking, progress: 0 });
    try {
      const result = await window.electronAPI.downloadWhisperModel(speechModel);
      if (!result.success || !result.downloaded) throw new Error(result.error);
      setSpeech({ ...checking, ready: true });
    } catch (error) {
      setSpeech({
        ...checking,
        error: (error instanceof Error && error.message) || "Download failed. Try again.",
      });
    }
  }

  async function downloadText() {
    setText({ ...checking, progress: 0 });
    try {
      const result = await window.electronAPI.modelDownload(UCAPIKA_TEXT_MODEL);
      if (!result.success) throw new Error(result.error);
      useSettingsStore.getState().setUseCleanupModel(true);
      setText({ ...checking, ready: true });
    } catch (error) {
      setText({
        ...checking,
        error: (error instanceof Error && error.message) || "Download failed. Try again.",
      });
    }
  }

  return { speech, text, downloadSpeech, downloadText };
}
