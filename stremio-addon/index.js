// Addon Stremio: SOLO streams HTTP/HTTPS (scraping de fuentes latinas + enlaces directos)
// Sin torrents: nada de infoHash/magnet; todo se sirve por URL directa o embed.
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');

// ---- CONFIGURACIÓN EDITABLE -------------------------------------------------
// (Se eliminó la fuente de torrents a pedido: todo es HTTPS/embed ahora)

// Lista estática de enlaces directos HTTP/HTTPS (mp4/mkv/ts...).
//    Formato: { name, url, type: 'movie'|'series', imdb?: 'tt0000000', season?, episode? }
const DIRECT_HTTP_LINKS = [
  // --- Película de ejemplo (Big Buck Bunny, dominio público) ---
  {
    name: 'Big Buck Bunny (MP4 1080p - demo)',
    url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4',
    type: 'movie',
    imdb: 'tt1254207',
    quality: '1080p'
  },
  {
    name: 'Sintel (MP4 - demo)',
    url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    type: 'movie',
    imdb: 'tt1793355',
    quality: '720p'
  }
];
// -----------------------------------------------------------------------------

const manifest = {
  id: 'dev.nuvio.latino',
  version: '2.1.0',
  name: 'Nuvio Latino (Scraper)',
  description: 'Streams en español latino para películas y series (solo HTTPS/embed). Incluye búsqueda y nuevos estrenos. Sin torrents.',
  logo: 'https://archive.org/download/liddoy_20260714/ppped1d0s/logo.png',
  resources: ['stream', 'catalog', 'meta'],
  types: ['movie', 'series'],
  idPrefixes: ['tt', 'vk', 'trk', 'lat', 'las'],
  catalogs: [
    { type: 'movie', id: 'nuviolatino-search-movie', name: 'Nuvio Latino', extra: [{ name: 'search', isRequired: true }] },
    { type: 'series', id: 'nuviolatino-search-series', name: 'Nuvio Latino', extra: [{ name: 'search', isRequired: true }] },
    { type: 'movie', id: 'nuviolatino-new-releases-movie', name: 'Nuevos Estrenos' },
    { type: 'series', id: 'nuviolatino-new-releases-series', name: 'Nuevos Estrenos' },
  ],
  behaviorHints: { configurable: false }
};

const builder = new addonBuilder(manifest);

// Scrapers de fuentes en español latino (ver lib/scrape.js)
const { scrapeAll, SCRAPER_CONFIG } = require('./lib/scrape');
const { startHealthCheck, getHealthReport } = require('./lib/health');
const { defineCatalog, defineMeta } = require('./lib/catalog');

// ---- RESOURCE: catalog (búsqueda + nuevos estrenos, estilo Addon Latam) ----
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  if (!id.startsWith('nuviolatino-')) return { metas: [] };
  try {
    return await defineCatalog(type, id, extra);
  } catch (e) {
    console.error('[catalog]', e.message);
    return { metas: [] };
  }
});

// ---- RESOURCE: meta (ficha básica de ids propios lat:/las:) -----------------
builder.defineMetaHandler(async ({ type, id }) => {
  if (!/^la[ts]:/.test(id)) return null; // los tt* los resuelve Cinemeta
  try {
    return await defineMeta(type, id);
  } catch (e) {
    console.error('[meta]', e.message);
    return null;
  }
});

// Health-check: cada 15 min verifica qué dominios espejo siguen vivos.
// Si un sitio se cae o cambia de dominio, agrega el nuevo espejo en
// SCRAPER_CONFIG (lib/scrape.js) y reinicia; los sanos se prueban primero.
if (require.main === module) {
  startHealthCheck(SCRAPER_CONFIG, +(process.env.HEALTH_INTERVAL_MIN || 15));
}

// Utilidad: normaliza calidad desde el nombre del archivo
function guessQuality(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('2160') || n.includes('4k')) return '4K';
  if (n.includes('1080')) return '1080p';
  if (n.includes('720')) return '720p';
  if (n.includes('480')) return '480p';
  return null;
}

// Streams HTTP/HTTPS directos desde la lista local
function getHttpStreams(type, id) {
  return DIRECT_HTTP_LINKS
    .filter(l => l.type === type && (!l.imdb || l.imdb === id))
    .map(l => ({
      name: 'HTTP',
      title: `${l.name}${l.quality ? `\n${l.quality}` : ''}`,
      url: l.url,
      behaviorHints: { bingeGroup: 'http-direct' }
    }));
}

builder.defineStreamHandler(async ({ type, id }) => {
  // 0) IDs propios del catálogo (lat:/las:) -> scrapear la ficha directamente
  if (/^la[ts]:/.test(id)) {
    const parts = String(id).split(':');
    const siteId = parts[1];
    const href = decodeURIComponent(parts.slice(2).join(':'));
    const cfg = SCRAPER_CONFIG[siteId];
    let streams = [];
    if (cfg) {
      try {
        const html = await require('./util').browserFetch(href);
        const { extractDirectLinks, extractEmbeds, streamFromUrl } = require('./core');
        for (const u of extractDirectLinks(html)) streams.push(streamFromUrl(u, `🌎 ${siteId}`, 'LATINO'));
        for (const u of extractEmbeds(html, href.replace(/[^/]*$/, ''))) {
          if (/youtube|facebook|twitter|ads/i.test(u)) continue;
          streams.push({ name: `🌎 ${siteId}`, title: `Servidor · embed`, externalUrl: u, behaviorHints: { notWebReady: true } });
        }
      } catch (e) {
        console.error('[stream:catalog-id]', e.message);
      }
    }
    return { streams };
  }

  // 1) Obtener metadatos (título en español, temporada/episodio) para poder buscar
  //    en las fuentes latinas. Stremio envía el ID de IMDb; consultamos Cinemeta.
  let meta = { name: null };
  try {
    const r = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${id}.json`);
    if (r.ok) {
      const d = await r.json();
      if (d && d.meta) {
        // background suele traer "Latino" / "Español" cuando hay audio LAT
        meta = { name: d.meta.name, background: d.meta.background };
      }
    }
  } catch (e) {
    console.error('Cinemeta falló:', e.message);
  }

  const [http, latino] = await Promise.all([
    Promise.resolve(getHttpStreams(type, id)),
    meta.name ? scrapeAll(type, { ...meta, season: parseSeasonEpisode(id) }).catch((e) => {
      console.error('Scraping latino error:', e.message);
      return [];
    }) : Promise.resolve([]),
  ]);

  // Si el scraper no encontró nada por título, agregar un stream informativo
  const streams = [...latino, ...http];
  if (!streams.length) {
    streams.push({
      name: 'Nuvio Latino',
      title: 'No se encontraron fuentes para este título. Prueba con títulos populares o revisa lib/scrape.js (los dominios cambian seguido).',
      externalUrl: 'https://www.peliculify.com',
    });
  }
  return { streams };
});

// Stremio usa ids tipo "tt1234:1:2" para series (imdb:temporada:episodio)
function parseSeasonEpisode(id) {
  const parts = String(id).split(':');
  return parts.length === 3 ? { season: +parts[1], episode: +parts[2] } : {};
}

module.exports = builder.getInterface();

if (require.main === module) {
  const http = require('http');
  serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });

  // Ruta extra: /health -> reporte JSON del estado de las fuentes
  // (no interfiere con /manifest.json, /stream/... que maneja el SDK)
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(getHealthReport(), null, 2));
    } else {
      res.writeHead(404).end();
    }
  });
  // El SDK ya ocupa el puerto; servimos /health en uno secundario si se configura
  if (process.env.HEALTH_PORT) {
    server.listen(+process.env.HEALTH_PORT, () =>
      console.log(`Reporte de salud de fuentes en http://localhost:${process.env.HEALTH_PORT}/health`)
    );
    if (server.unref) server.unref();
  }

  console.log('Addon corriendo en http://localhost:7000/manifest.json');
  console.log('Instálalo en Stremio: http://localhost:7000/addon.html');
  console.log('Fuentes latinas (solo HTTPS/embed):', Object.keys(SCRAPER_CONFIG).join(', '));
}
