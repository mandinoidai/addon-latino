# Nuvio Helper ⚡ — Addon para Nuvio

Addon de navegador (Manifest V3) compatible con **Chrome, Edge y Brave** que añade mejoras de productividad a [Nuvio](https://nuvioapp.com).

## Estructura

```
nuvio-addon/
├── manifest.json        # Configuración del addon (MV3)
├── icons/               # Iconos 16/48/128 px
└── src/
    ├── background.js    # Service worker (gestión de ajustes)
    ├── content.js       # Se inyecta en nuvioapp.com (barra rápida + atajos)
    ├── content.css      # Estilos de la barra y panel flotante
    ├── popup.html       # UI del popup
    └── popup.js         # Lógica del popup (activar/desactivar)
```

## Funcionalidades incluidas

- 🔍 **Buscar**: enfoca el buscador de Nuvio con un clic.
- ➕ **Nueva tarea**: hace clic por ti en el botón "Nueva tarea" (o usa `Alt + N`).
- 🧰 **Panel**: panel flotante de información.
- ⚙️ **Popup con ajustes**: activar/desactivar el addon y la barra rápida (persistidos con `chrome.storage`).

## Instalación en modo desarrollo

1. Abre Chrome y vea `chrome://extensions`.
2. Activa **Modo de desarrollador** (arriba a la derecha).
3. Pulsa **Cargar descomprimida** y selecciona la carpeta `nuvio-addon/`.
4. Entra a Nuvio: verás la barra "Nuvio Helper" abajo a la derecha.

## Personalización rápida

| Quiero… | Dónde lo cambio |
|---|---|
| Otra URL de Nuvio (self-hosted, .dev, etc.) | `manifest.json` → `content_scripts.matches` y `host_permissions` |
| Nuevos botones/acciones | `src/content.js` → `addQuickActionsBar()` y `handleAction()` |
| Nuevos ajustes en el popup | `src/popup.html` + `src/popup.js` + `background.js` |
| Atajos de teclado globales | Añade un bloque `commands` en `manifest.json` |

## Empaquetar para distribución

```bash
# Generar .zip para subir a la Chrome Web Store
cd nuvio-addon && zip -r ../nuvio-helper.zip . -x "*.DS_Store"
```

## Notas

- Los selectores de "Buscar" y "Nueva tarea" son genéricos; si Nuvio cambia su DOM, ajústalos en `content.js` tras inspeccionar el elemento (F12).
- Si tu instancia de Nuvio no está en `nuvioapp.com`, edita los dominios en el manifest antes de cargarlo.
