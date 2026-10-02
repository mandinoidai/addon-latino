# Nuvio Latino Addon (Stremio) — Scraper de fuentes en español latino

Addon para **Stremio** que **escrapea fuentes de pelis y series en español latino**
servido **exclusivamente por HTTPS/EMBED** (sin torrents, sin magnet, sin infoHash).
Fuentes actuales: **Peliculify**, **Noveleria**, **Veoh Latino** y **Archive.org**,
más una lista local de enlaces HTTP directos. Como Nuvio TV usa el mismo protocolo
de addons de Stremio, puedes apuntar esa app al manifest.

## Uso rápido

```bash
cd stremio-addon
npm install
npm start                 # scraping latino (solo HTTPS/embed) + enlaces HTTP locales
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
- (Eliminado: ya no se reenvían torrents; todo es HTTPS/embed)

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
- Muchos embeds requieren navegador (no reproducen directo en Stremio); los `.m3u8`/`.mp4` sí funcionan.
- Sin torrents: nada de magnet/WebTorrent; todos los streams son URL HTTPS o embed externo.
- Usa esto solo con contenido que tengas derecho a ver (la mayoría de estas fuentes alojan
  contenido con derechos de autor; úsalo bajo tu responsabilidad).


## Salud de fuentes (health-check)

El addon verifica automáticamente cada 15 min qué dominios espejo siguen vivos (`lib/health.js`).
Los sanos se prueban primero al scrapear; los caídos van al final y se re-intentan en cada ronda.

- Cambiar intervalo: `HEALTH_INTERVAL_MIN=10 npm start`
- Ver reporte JSON: `HEALTH_PORT=7056 npm start` → http://localhost:7056/health

### Cuando una fuente se cae
1. Revisa `/health` para ver cuál está `ok:false`.
2. Busca el dominio espejo nuevo del sitio (Google: "<sitio> dominio nuevo", su Telegram/Twitter, foros como Reddit/Stremio apps latinas).
3. Edita `SCRAPER_CONFIG` en `lib/scrape.js`: agrega el nuevo dominio a `baseUrls` (o deshabilita la fuente con `enabled: false`).
4. Reinicia el servidor. No hace falta tocar nada más.

Si un sitio cambia tanto que el scraper ya no extrae enlaces (aunque el dominio responda),
ese scraper necesita actualización de selectores/regex: revisa el HTML con `curl` y ajusta la función.


## Fuentes latinas incluidas (v2.1)

Todas vía HTTPS/embed (sin torrents):

| Fuente | Tipo | Dominios espejo |
|---|---|---|
| Peliculify | scrapper propio | peliculify.com / .net / peliculasdk.com |
| Noveleria | scrapper propio | noveleria.net |
| Veoh Latino | API + HTML | veoh.com |
| Archive.org | API JSON (legal) | archive.org |
| Cinecalidad | scraper genérico WP | cinecalidad.to / .fr / .futbol |
| Pelis4Du | scraper genérico WP | pelis4du.co / .video |
| SeriesLatino | scraper genérico WP | serieslatino.me / .pw |
| DoDoPlay | scraper genérico WP | dodoplay.com / .net |
| MetaVidrios | scraper genérico WP | metavidrios.com |

### Agregar una fuente nueva de la familia WordPress (Cinecalidad-like)
1. En `lib/scrape.js` → `SCRAPER_CONFIG`: añade `{ micuevafuente: { enabled: true, baseUrls: ['https://...'] } }`
2. En la lista `WP_SITES` del mismo archivo: `{ id: 'micuevafuente', name: 'MiFuente', emoji: '🎞️' }`
3. Reinicia. El health-check (`/health`) ya la monitorea automáticamente.

Si el sitio no usa el CMS tipo WordPress (?s= + fichas /pelicula//serie/), escribe un scraper con la firma `(type, meta)` en `lib/scrape.js` y regístralo en `SCRAPERS`.
