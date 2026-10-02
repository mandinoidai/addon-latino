// Content script: se inyecta en las páginas de Nuvio
(function () {
  "use strict";

  const SETTINGS_DEFAULT = { enabled: true, showQuickActions: true };

  function loadSettings(cb) {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (res) => {
      cb({ ...SETTINGS_DEFAULT, ...(res || {}) });
    });
  }

  function addQuickActionsBar() {
    if (document.getElementById("nuvio-helper-bar")) return;

    const bar = document.createElement("div");
    bar.id = "nuvio-helper-bar";
    bar.innerHTML = `
      <span class="nh-label">Nuvio Helper</span>
      <button class="nh-btn" data-action="focus-search">🔍 Buscar</button>
      <button class="nh-btn" data-action="new-task">➕ Nueva tarea</button>
      <button class="nh-btn" data-action="toggle-panel">🧰 Panel</button>
    `;
    document.body.appendChild(bar);

    bar.addEventListener("click", (e) => {
      const btn = e.target.closest(".nh-btn");
      if (!btn) return;
      handleAction(btn.dataset.action);
    });
  }

  function handleAction(action) {
    switch (action) {
      case "focus-search": {
        // Intenta enfocar un buscador común de Nuvio
        const input =
          document.querySelector('input[type="search"]') ||
          document.querySelector('[placeholder*="uscar"]') ||
          document.querySelector('[data-testid="search"]');
        if (input) input.focus();
        break;
      }
      case "new-task": {
        const btn = [...document.querySelectorAll("button, a")].find(
          (el) => /nueva tarea|new task|añadir/i.test(el.textContent || "")
        );
        if (btn) btn.click();
        break;
      }
      case "toggle-panel": {
        let panel = document.getElementById("nuvio-helper-panel");
        if (!panel) {
          panel = document.createElement("div");
          panel.id = "nuvio-helper-panel";
          panel.innerHTML = `<h4>Nuvio Helper</h4><p>Addon activo ✅</p>`;
          document.body.appendChild(panel);
        } else {
          panel.style.display =
            panel.style.display === "none" ? "block" : "none";
        }
        break;
      }
    }
  }

  // Atajos de teclado
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "n") {
      e.preventDefault();
      handleAction("new-task");
    }
  });

  loadSettings((settings) => {
    if (!settings.enabled) return;
    if (settings.showQuickActions) addQuickActionsBar();
  });
})();
