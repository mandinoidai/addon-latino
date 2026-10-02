// Service worker del addon Nuvio Helper (Manifest V3)
chrome.runtime.onInstalled.addListener(() => {
  console.log("Nuvio Helper instalado");
  // Valores por defecto
  chrome.storage.local.set({
    settings: {
      enabled: true,
      showQuickActions: true,
    },
  });
});

// Escuchar mensajes desde el content script o popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_SETTINGS") {
    chrome.storage.local.get("settings", (data) => {
      sendResponse(data.settings ?? {});
    });
    return true; // respuesta asíncrona
  }
  if (msg.type === "SAVE_SETTINGS") {
    chrome.storage.local.set({ settings: msg.payload }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
});
