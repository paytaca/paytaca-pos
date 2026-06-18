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
      try {
        await audio.preload({
          assetId,
          assetPath,
          audioChannelNum: options.audioChannelNum || 1,
          volume: options.volume || 1.0,
          isUrl: options.isUrl || false,
        });
      } catch (preloadError) {
        // Asset may already be loaded from an earlier preload call.
        // Log and continue so we can still try to play it.
        console.warn(
          "NativeAudio preload warning (may already exist):",
          preloadError?.message || preloadError
        );
      }
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

    const tryPlay = async () => {
      try {
        await audio.play();
        resolve();
      } catch (e) {
        reject(e);
      }
    };

    // If already playable (cached), fire immediately.
    if (audio.readyState >= 2) {
      tryPlay();
      return;
    }

    audio.addEventListener("canplay", tryPlay, { once: true });
    audio.addEventListener(
      "error",
      (e) => reject(new Error("Audio load error")),
      { once: true }
    );
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
