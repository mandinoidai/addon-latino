// Popup: cargar y guardar ajustes
const enabledEl = document.getElementById("enabled");
const quickEl = document.getElementById("quickActions");
const saveBtn = document.getElementById("save");

chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (settings) => {
  if (!settings) return;
  enabledEl.checked = settings.enabled !== false;
  quickEl.checked = settings.showQuickActions !== false;
});

saveBtn.addEventListener("click", () => {
  const payload = {
    enabled: enabledEl.checked,
    showQuickActions: quickEl.checked,
  };
  chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", payload }, () => {
    saveBtn.textContent = "✅ Guardado";
    setTimeout(() => (saveBtn.textContent = "Guardar"), 1200);
  });
});
