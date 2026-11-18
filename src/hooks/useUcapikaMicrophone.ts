import { useEffect, useState } from "react";

export function useUcapikaMicrophone(deviceId: string) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media) return;
    let active = true;
    const refresh = async () => {
      const next = await media.enumerateDevices().catch(() => []);
      if (active) setDevices(next.filter((device) => device.kind === "audioinput"));
    };
    void refresh();
    media.addEventListener("devicechange", refresh);
    return () => {
      active = false;
      media.removeEventListener("devicechange", refresh);
    };
  }, [testing]);

  useEffect(() => {
    if (!testing) return;
    let stopped = false;
    let frame = 0;
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    setLevel(0);
    setError("");

    async function measureInput() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        context = new AudioContext();
        const analyser = context.createAnalyser();
        context.createMediaStreamSource(stream).connect(analyser);
        const data = new Float32Array(analyser.fftSize);
        const update = () => {
          analyser.getFloatTimeDomainData(data);
          const rms = Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
          setLevel(Math.min(1, rms * 6));
          frame = requestAnimationFrame(update);
        };
        update();
      } catch (reason) {
        if (!stopped) {
          setError(reason instanceof Error ? reason.message : "Microphone unavailable.");
          setTesting(false);
        }
      }
    }
    void measureInput();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
    };
  }, [deviceId, testing]);

  return { devices, testing, setTesting, level: testing ? level : 0, error };
}
