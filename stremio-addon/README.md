# Nuvio Latino Addon (Stremio) — Scraper de fuentes en español latino

Addon para **Stremio** que **escrapea fuentes de pelis y series en español latino**
(Peliculify, Noveleria) y además puede reenviar **Torrents** (vía Torrentio u otro addon)
y **HTTP/HTTPS directos**. Como Nuvio TV usa el mismo protocolo de addons de Stremio,
puedes apuntar esa app al manifest.

## Uso rápido

```bash
cd stremio-addon
npm install
npm start                 # scraping latino + enlaces HTTP locales
# o con torrents reales además del scraping:
TORRENT_SOURCE=https://torrentio.strem.fun/manifest.json npm start
```

- Manifest: `http://localhost:7000/manifest.json`
- Página de instalación: `http://localhost:7000/addon.html`
- En Stremio: `Complementos → Añadir complemento por URL → http://localhost:7000/manifest.json`

## Cómo funciona el scraping (lib/scrape.js)

1. Stremio pide streams por ID de IMDb → el addon consulta **Cinemeta** para obtener el
   título en español (los títulos de estos sitios suelen estar en latino).
2. Cada scraper busca la ficha por slug (`/pelicula/<titulo>` , `/serie/<titulo>-temporada-N-capitulo-M`)
   o por su buscador interno (`?s=<titulo>`).
3. Extrae enlaces directos `.m3u8`/`.mp4` (se ordenan por calidad detectada: 4K/1080p/720p…)
   y también embeds de servidores (aparecen como "Latino Embed").
4. Todo se agrega, deduplica y devuelve como streams de Stremio.

## Configuración de fuentes

Edita `SCRAPER_CONFIG` en `lib/scrape.js`:

```js
peliculify: { enabled: true, baseUrls: ['https://www.peliculify.com', ...] },
noveleria:  { enabled: true, baseUrls: ['https://noveleria.net'] },
```

- **Dominios espejo**: estos sitios cambian de dominio cada cierto tiempo; si uno deja de
  responder, agrega el nuevo dominio a `baseUrls` o desactívalo con `enabled: false`.
- **Agregar una fuente nueva**: escribe una función `scrapeMiSitio(type, meta)` que devuelva
  un arreglo de streams y regístrala en `SCRAPERS`. La firma es la misma para todas.
- **Enlaces HTTP/HTTPS fijos**: edita `DIRECT_HTTP_LINKS` en `index.js`.
- **Torrents**: variable de entorno `TORRENT_SOURCE` con el manifest de Torrentio/MediaWave.

## Publicar para usarlo desde la TV / otros dispositivos

`localhost` solo funciona en tu PC. Opciones:
- Red local: abre el puerto 7000 y usa `http://IP-de-tu-PC:7000/manifest.json`.
- Internet: sube el proyecto a Railway/Render/VPS y usa el dominio HTTPS resultante.
- Túnel temporal: `npx cloudflared tunnel --url http://localhost:7000`.

## Notas y limitaciones

- **Verificado desde este entorno**: los sitios de scraping están protegidos por Cloudflare
  y/o bloquean IPs de datacenter, por lo que aquí devuelven 0 streams; el pipeline de parseo
  está probado con HTML simulado. Ejecuta el servidor en tu casa/VPN (IP residencial) para
  que el scraping funcione realmente.
- Los DOMs de estos sitios cambian con frecuencia; puede ser necesario ajustar las regex de
  `lib/scrape.js` (extractDirectLinks/extractEmbeds) con inspeccionar el HTML de una ficha real.
- Muchos embeds requieren navegador (no reproducen directo en Stremio); los `.m3u8` sí funcionan.
- Stremio de escritorio reproduce torrents (WebTorrent); en Android/iOS los magnet se abren
  en un reproductor externo.
- Usa esto solo con contenido que tengas derecho a ver (la mayoría de estas fuentes alojan
  contenido con derechos de autor; úsalo bajo tu responsabilidad).

