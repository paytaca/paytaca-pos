import { Capacitor } from "@capacitor/core";

let NativeAudio = null;

async function getNativeAudio() {
  if (!Capacitor.isNativePlatform()) return null;
  if (NativeAudio) return NativeAudio;

  try {
    const module = await import("@capacitor-community/native-audio");
    NativeAudio = module.NativeAudio;
    return NativeAudio;
  } catch (error) {
    console.warn("NativeAudio not available:", error);
    return null;
  }
}

export async function playNativeAudio(assetId, assetPath = null, options = {}) {
  const audio = await getNativeAudio();
  if (!audio) return false;

  try {
    if (assetPath) {
      await audio.preload({
        assetId,
        assetPath,
        audioChannelNum: options.audioChannelNum || 1,
        volume: options.volume || 1.0,
        isUrl: options.isUrl || false,
      });
    }
    await audio.play({ assetId });
    return true;
  } catch (error) {
    console.warn("NativeAudio playback failed:", error);
    return false;
  }
}

export async function preloadNativeAudio(assetId, assetPath, options = {}) {
  const audio = await getNativeAudio();
  if (!audio) return false;

  try {
    await audio.preload({
      assetId,
      assetPath,
      audioChannelNum: options.audioChannelNum || 1,
      volume: options.volume || 1.0,
      isUrl: options.isUrl || false,
    });
    return true;
  } catch (error) {
    console.warn("NativeAudio preload failed:", error);
    return false;
  }
}

export async function unloadNativeAudio(assetId) {
  const audio = await getNativeAudio();
  if (!audio) return;

  try {
    await audio.unload({ assetId });
  } catch (error) {
    console.warn("NativeAudio unload failed:", error);
  }
}

export function playHtml5Audio(src) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(src);
    audio.addEventListener("canplay", async () => {
      try {
        await audio.play();
        resolve();
      } catch (e) {
        reject(e);
      }
    });
    audio.addEventListener("error", reject);
    setTimeout(() => reject(new Error("Audio timeout")), 5000);
    audio.load();
  });
}

export async function playSoundWithFallback(assetId, paths, options = {}) {
  const audio = await getNativeAudio();

  if (audio && Capacitor.isNativePlatform()) {
    const result = await playNativeAudio(assetId, paths.native, {
      isUrl: paths.isUrl,
      ...options,
    });
    if (result) return true;
  }

  if (paths.web) {
    await playHtml5Audio(paths.web);
    return true;
  }

  return false;
}
