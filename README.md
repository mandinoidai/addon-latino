# 🎬 Addon Latino — Stremio / Nuvio TV

Addon estilo **Addon Latam** que sirve streams **100% HTTPS/embed en español latino**.
**Sin torrents.** 9 fuentes de películas y series, catálogos de búsqueda y "Nuevos Estrenos".

## ✨ Características

- **Recursos**: `stream`, `catalog` (búsqueda + nuevos estrenos), `meta` — igual que Addon Latam.
- **Fuentes latinas (HTTPS)**: Peliculify, Noveleria, Cinecalidad, Pelis4Du, SeriesLatino, DoDoPlay, MetaVidrios, Veoh Latino, Archive.org.
- **Failover automático**: cada fuente tiene dominios espejo; si uno cae, se prueba el siguiente.
- **Health-check**: revisa el estado de todas las fuentes cada 15 min → `GET /health`.
- **Sin tokens obligatorios**: corre donde tú quieras (PC, Railway, VPS).

## 🖥️ Probar en Windows (local)

```powershell
git clone https://github.com/TU-USUARIO/addon-latino.git
cd addon-latino
npm install
npm start
```

Deja la ventana de PowerShell abierta. El addon queda en:

```
http://localhost:7000/manifest.json
```

### Instalar en Stremio (Windows)

1. Abre Stremio → ⚙️ **Complementos** → **Añadir complemento desde URL**.
2. Pega `http://localhost:7000/manifest.json` → Instalar.
3. (Alternativa rápida: abre en el navegador `http://localhost:7000/addon.html` y haz clic en *Instalar*).
4. Ve a cualquier peli/serie → pestaña **Streams**: verás las fuentes latinas.
5. En **Descubrir/Buscar**: aparecerán los catálogos "Addon Latino" y "Nuevos Estrenos".

### Instalar en Nuvio TV (si acepta manifests personalizados)

Necesita alcanzar tu PC en la red local:

1. Averigua tu IP local: `ipconfig` → IPv4 (ej. `192.168.1.50`).
2. En Nuvio, añade un addon/playlist con URL: `http://192.168.1.50:7000/manifest.json`.
3. Permite el puerto 7000 en el Firewall de Windows (la primera vez que corres `npm start`, acepta el aviso).
4. Tu PC debe estar encendida y en la misma red WiFi que Nuvio.

> Si Nuvio no soporta Stremio manifests, usa Stremio directamente o despliega en la nube (abajo).

## ☁️ Desplegar gratis en la nube (siempre activo, sin PC encendida)

### Railway (recomendado)
1. Sube este repo a GitHub.
2. Entra a [railway.app](https://railway.app) → loguea con GitHub → **New Project → Deploy from GitHub repo**.
3. Detecta Node automáticamente (usa `package.json` y `Procfile` incluidos).
4. En **Settings → Networking → Generate Domain** te da una URL tipo `https://addon-latino.up.railway.app`.
5. Añade en Stremio/Nuvio: `https://TU-URL.up.railway.app/manifest.json`.

### Render / Koyeb / Fly.io
Mismo procedimiento: comando de inicio `node stremio-addon/index.js` (o `npm start`) y variable `PORT` ya es respetada por el servidor.

## 🔧 Configuración (variables de entorno)

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `7000` | Puerto HTTP |
| `HEALTH_INTERVAL_MIN` | `15` | Minutos entre chequeos de salud |
| `TORRENTIO_URL` | — | (Opcional) Solo si algún día quieres volver a torrents |

Para cambiar fuentes o espejos: edita `SCRAPER_CONFIG` en `stremio-addon/lib/scrape.js` y `WP_SITES` en `stremio-addon/lib/sources-latino.js`.

## 🩺 Mantener las fuentes vivas

1. Visita `http://localhost:7000/health` → JSON con el estado de cada dominio.
2. Fuente caída (`ok:false` en todos sus espejos): busca su dominio nuevo (Google, canal de Telegram del sitio) y agrégalo al array `baseUrls` correspondiente. Reinicia.
3. Sitio vivo pero sin enlaces: cambió su HTML → ajusta los selectores de ese scrapper.
4. Las fuentes de la familia WordPress (Cinecalidad, Pelis4Du, DoDoPlay, SeriesLatino…) comparten formato: agregar una nueva son 2 líneas en `WP_SITES`.

## ⚠️ Aviso legal

Este proyecto es educativo. Las fuentes pueden contener material con derechos de autor; úsalo bajo tu responsabilidad según la legislación de tu país.

## 📁 Estructura

```
├── package.json          # arranque raíz (para Railway/Render)
├── Procfile              # web: node stremio-addon/index.js
└── stremio-addon/
    ├── index.js          # manifest + servidor + /health
    └── lib/
        ├── core.js       # helpers compartidos (fetch, extracción m3u8/mp4/embeds)
        ├── util.js       # slugify, calidad, etc.
        ├── scrape.js     # SCRAPER_CONFIG + scrapers específicos
        ├── sources-latino.js  # scrapper genérico familia WordPress
        ├── catalog.js    # recursos catalog + meta (búsqueda y estrenos)
        └── health.js     # health-check con failover de espejos
```
