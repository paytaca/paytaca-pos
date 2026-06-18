import { boot } from "quasar/wrappers";

function isCapacitorUnimplemented(error) {
  return error && typeof error === 'object' && error.code === 'UNIMPLEMENTED';
}

export default boot(({ app }) => {
  app.config.errorHandler = (err, vm, info) => {
    if (isCapacitorUnimplemented(err)) return;
    console.error("Vue error:", err, info);
    const loadingEl = document.getElementById("app-loading");
    if (loadingEl) loadingEl.remove();
  };

  window.addEventListener("unhandledrejection", (event) => {
    if (isCapacitorUnimplemented(event.reason)) {
      event.preventDefault();
      return;
    }
    console.error("Unhandled promise rejection:", event.reason);
    const loadingEl = document.getElementById("app-loading");
    if (loadingEl) loadingEl.remove();
  });

  window.addEventListener("error", (event) => {
    if (isCapacitorUnimplemented(event.error)) return;
    console.error("Global error:", event.error);
    const loadingEl = document.getElementById("app-loading");
    if (loadingEl) loadingEl.remove();
  });
});
