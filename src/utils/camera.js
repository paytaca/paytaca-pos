import { Capacitor } from "@capacitor/core";

export async function checkPermissions() {
  if (Capacitor.isNativePlatform()) {
    const { Camera } = await import("@capacitor/camera");
    return Camera.checkPermissions();
  }

  return {
    camera: "granted",
    photos: "granted",
  };
}

export async function requestPermissions() {
  if (Capacitor.isNativePlatform()) {
    const { Camera } = await import("@capacitor/camera");
    return Camera.requestPermissions();
  }

  return {
    camera: "granted",
    photos: "granted",
  };
}

export async function getPhoto(options = {}) {
  if (Capacitor.isNativePlatform()) {
    const { Camera } = await import("@capacitor/camera");
    const { Photos } = await import("@capacitor/camera");

    const image = await Camera.getPhoto({
      quality: options.quality || 90,
      allowEditing: false,
      resultType: options.resultType || "base64",
      source: "camera",
    });

    return image;
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          base64String: reader.result.split(",")[1],
          dataUrl: reader.result,
          format: file.type.split("/")[1],
        });
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    };

    input.oncancel = () => reject(new Error("User cancelled"));
    input.click();
  });
}
