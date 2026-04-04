import { boot } from "quasar/wrappers";

export default boot(({ app }) => {
  app.config.errorHandler = (err, vm, info) => {
    console.error("Vue error:", err, info);
    const loadingEl = document.getElementById("app-loading");
    if (loadingEl) loadingEl.remove();
  };

  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
    const loadingEl = document.getElementById("app-loading");
    if (loadingEl) loadingEl.remove();
  });

  window.addEventListener("error", (event) => {
    console.error("Global error:", event.error);
    const loadingEl = document.getElementById("app-loading");
    if (loadingEl) loadingEl.remove();
  });
});
