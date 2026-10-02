// Scrapers de fuentes en español latino (películas/series LATINO) — SOLO HTTPS/EMBED
// Cada scraper devuelve streams Stremio ({ name, title, url } con url .m3u8/.mp4 o embed).
// Sin torrents: aquí todo es HTTP(S) directo, HLS o iframe/embed.
// Nota: los DOMs de estos sitios cambian con frecuencia; si uno deja de funcionar,
// agrega otro dominio espejo en SCRAPER_CONFIG o un nuevo scraper con la misma firma.

const { slugify, cleanText, sortStreams, hostOf, browserFetch } = require('./util');
const { sortedBases } = require('./health');

// ---- CONFIG --------------------------------------------------------------
// Para AGREGAR una fuente nueva: añade una entrada aquí con sus dominios
// espejo y registra su scraper en la lista SCRAPERS (misma firma).
const SCRAPER_CONFIG = {
  peliculify: {
    enabled: true,
    baseUrls: [
      'https://www.peliculify.com',
      'https://peliculify.net',
      'https://www.peliculasdk.com', // espejos conocidos; ajusta según disponibilidad
    ],
  },
  noveleria: {
    enabled: true,
    baseUrls: ['https://noveleria.net'],
  },
  veohLatino: {
    enabled: true,
    baseUrls: ['https://www.veoh.com'],
  },
  archiveLatino: {
    enabled: true,
    baseUrls: ['https://archive.org'],
  },
  // ---- Fuentes adicionales en español latino (misma familia WordPress) ----
  // Estos sitios suelen compartir CMS/estructura: buscador /?s=, fichas
  // /pelicula/<slug> y /serie/<slug>. Agrega dominios espejo cuando cambien.
  cinecalidad: {
    enabled: true,
    baseUrls: [
      'https://www.cinecalidad.to',
      'https://cinecalidad.fr',
      'https://www.cinecalidad.futbol',
    ],
  },
  pelis4du: {
    enabled: true,
    baseUrls: [
      'https://pelis4du.co',
      'https://www.pelis4du.video',
    ],
  },
  serieslatino: {
    enabled: true,
    baseUrls: [
      'https://serieslatino.me',        // serie-página con ?s=
      'https://www.serieslatino.pw',
    ],
  },
  dodoplay: {
    enabled: true,
    baseUrls: [
      'https://dodoplay.com',
      'https://dodoplay.net',
    ],
  },
  metavidrios: {
    enabled: true,
    baseUrls: ['https://metavidrios.com'],
  },
};
// ---------------------------------------------------------------------------

// Helpers compartidos (fetch con espejos, extracción de enlaces/embeds, streams)
const { fetchFirstAvailable, extractDirectLinks, extractEmbeds, streamFromUrl } = require('./core');

// ===================== SCRAPER: PELICULIFY =================================
// URLs típicas: /pelicula/<slug> y /serie/<slug>-temporada-N-capitulo-M
async function scrapePeliculify(type, meta) {
  const cfg = SCRAPER_CONFIG.peliculify;
  if (!cfg.enabled) return [];
  const titleSlug = slugify(meta.name);
  let paths;
  if (type === 'movie') {
    paths = [`/pelicula/${titleSlug}`, `/pelicula/${titleSlug}-latino`, `/peliculas/${titleSlug}`];
  } else {
    const s = meta.season ?? 1, e = meta.episode ?? 1;
    paths = [
      `/serie/${titleSlug}-temporada-${s}-capitulo-${e}`,
      `/serie/${titleSlug}-temporada-${String(s).padStart(2, '0')}-capitulo-${String(e).padStart(2, '0')}`,
      `/serie/${titleSlug}`,
    ];
  }
  const { html, base } = await fetchFirstAvailable(paths, cfg);

  const streams = [];
  // 1) enlaces directos (los mejores para Stremio)
  for (const u of extractDirectLinks(html)) {
    streams.push(streamFromUrl(u, hostOf(u), 'LATINO'));
  }
  // 2) embeds de servidores (VideoVault, Streamtape, etc.) -> se abren como web
  for (const u of extractEmbeds(html, base)) {
    if (/youtube|facebook|twitter/i.test(u)) continue;
    streams.push({
      name: '🌐 Latino Embed',
      title: `Servidor embed · ${hostOf(u)} · requiere navegador/webview`,
      externalUrl: u,
      behaviorHints: { notWebReady: true },
    });
  }
  return sortStreams(streams);
}

// ===================== SCRAPER: NOVELERIA ===================================
// Noveleria tiene catálogo propio; buscamos por título vía su buscador interno.
async function scrapeNoveleria(type, meta) {
  const cfg = SCRAPER_CONFIG.noveleria;
  if (!cfg.enabled) return [];
  const query = encodeURIComponent(meta.name);
  const { html, base } = await fetchFirstAvailable([`/?s=${query}`, `/buscar/${query}`], cfg);

  // Primer enlace a ficha de película/serie
  const re = /<a[^>]+href=["'](https?:\/\/[^"']*\/(?:pelicula|serie|ver)[^"']*)["'][^>]*>([^<]*)<\/a>/gi;
  const links = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    links.push({ href: m[1], text: cleanText(m[2]) });
    if (links.length >= 3) break;
  }

  const streams = [];
  for (const l of links.slice(0, 2)) {
    let pageHtml = html;
    if (l.href !== base + '/?s=' + query) {
      try {
        pageHtml = await browserFetch(l.href);
      } catch {
        continue;
      }
    }
    for (const u of extractDirectLinks(pageHtml)) {
      streams.push(streamFromUrl(u, l.text || hostOf(u), 'LATINO'));
    }
  }
  return sortStreams(streams);
}

// ===================== SCRAPER: VEOH (contenido latino) =====================
// Veoh tiene un buscador público y una API JSON interna de búsqueda.
// Muchos canales suben películas/series con audio en español latino.
async function scrapeVeoh(type, meta) {
  const cfg = SCRAPER_CONFIG.veohLatino;
  if (!cfg.enabled) return [];
  const base = sortedBases(cfg.baseUrls)[0];
  const query = encodeURIComponent(meta.name);
  const streams = [];

  // 1) Intentar la API JSON de búsqueda (más estable que el HTML)
  try {
    const apiUrl = `${base}/api/v1/search/videos?query=${query}&sort=relevance&per_page=8`;
    const json = JSON.parse(await browserFetch(apiUrl, { headers: { accept: 'application/json' } }));
    const vids = json?.videos?.list || json?.list || [];
    for (const v of vids.slice(0, 5)) {
      const permalink = v.permalink || v.seoName || v.id;
      const titleTxt = cleanText(v.title || 'Veoh');
      // Veoh sirve HLS vía su API de playback; como fallback exponemos la página watch (embed)
      streams.push({
        name: '📺 Veoh Latino',
        title: `${titleTxt} · embed veoh.com`,
        externalUrl: `https://www.veoh.com/watch/${permalink}`,
        behaviorHints: { notWebReady: true },
      });
    }
  } catch {
    /* API cambiada/bloqueada -> seguimos con scraping HTML */
  }

  // 2) Fallback: scrapear la página de resultados en HTML
  if (!streams.length) {
    try {
      const html = await browserFetch(`${base}/search/videos?query=${query}`);
      const re = /href=["'](\/watch\/[^"']+)["'][^>]*>([^<]*)</gi;
      let m;
      while ((m = re.exec(html)) !== null && streams.length < 5) {
        streams.push({
          name: '📺 Veoh Latino',
          title: `${cleanText(m[2]) || 'Veoh'} · embed veoh.com`,
          externalUrl: base + m[1],
          behaviorHints: { notWebReady: true },
        });
      }
    } catch {
      /* fuente caída: el health-check lo registrará */
    }
  }
  return sortStreams(streams);
}

// ===================== SCRAPER: ARCHIVE.ORG (pelis clásicas LATINO) ========
// Archive.org tiene miles de películas completas (muchas dobladas al español),
// todas servidas por HTTPS directo (.mp4/.m3u8). Legalmente más seguro.
async function scrapeArchiveOrg(type, meta) {
  const cfg = SCRAPER_CONFIG.archiveLatino;
  if (!cfg.enabled) return [];
  const base = sortedBases(cfg.baseUrls)[0];
  const title = encodeURIComponent(`"${meta.name}"`);
  const mediatype = type === 'movie' ? 'movies' : 'tv';
  const api = `${base}/advancedsearch.php?q=title%3A(${encodeURIComponent(meta.name)})+AND+mediatype%3A(${mediatype})&fl%5B%5D=identifier&rows=6&output=json`;

  const streams = [];
  let ids = [];
  try {
    const json = JSON.parse(await browserFetch(api, { headers: { accept: 'application/json' } }));
    ids = (json?.response?.docs || []).map((d) => d.identifier);
  } catch {
    return [];
  }

  for (const id of ids) {
    try {
      const metaJson = JSON.parse(await browserFetch(`${base}/metadata/${encodeURIComponent(id)}`));
      // El campo "files" puede ser objeto único o lista
      const files = metaJson?.files;
      const list = Array.isArray(files) ? files : Object.values(files || {});
      // Prioriza mp4 de mayor tamaño (mejor calidad aproximada)
      const videos = list
        .filter((f) => f?.name && /\.(mp4|m3u8)$/i.test(f.name))
        .map((f) => ({
          url: `${base}/download/${encodeURIComponent(id)}/${encodeURIComponent(f.name)}`,
          size: +(f.size || 0),
          name: f.name,
        }))
        .sort((a, b) => b.size - a.size)
        .slice(0, 2);
      for (const v of videos) {
        streams.push(streamFromUrl(v.url, cleanText(metaJson?.title || id), 'ARCHIVO'));
      }
    } catch {
      continue; // item ilegible, seguir con el siguiente
    }
  }
  return sortStreams(streams);
}

// ===================== AGREGADOR ============================================
// Fuentes de la familia WordPress (Cinecalidad y similares) usan el scraper
// genérico scrapeWpLatino en lugar de uno propio por sitio.
const { scrapeWpLatino } = require('./sources-latino');

const WP_SITES = [
  { id: 'cinecalidad', name: 'Cinecalidad', emoji: '🎥' },
  { id: 'pelis4du', name: 'Pelis4Du', emoji: '🍿' },
  { id: 'serieslatino', name: 'SeriesLatino', emoji: '📺' },
  { id: 'dodoplay', name: 'DoDoPlay', emoji: '▶️' },
  { id: 'metavidrios', name: 'MetaVidrios', emoji: '🪟' },
];

const SCRAPERS = [
  { id: 'peliculify', fn: scrapePeliculify },
  { id: 'noveleria', fn: scrapeNoveleria },
  { id: 'veohLatino', fn: scrapeVeoh },
  { id: 'archiveLatino', fn: scrapeArchiveOrg },
  ...WP_SITES.map((w) => ({
    id: w.id,
    fn: (type, meta) =>
      scrapeWpLatino(w.name, w.emoji, type, meta, SCRAPER_CONFIG[w.id]),
  })),
];

async function scrapeAll(type, meta) {
  const results = await Promise.allSettled(SCRAPERS.map((s) => s.fn(type, meta)));
  const streams = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') streams.push(...r.value);
    else console.error(`[scraper:${SCRAPERS[i].id}]`, r.reason?.message || r.reason);
  });
  // dedupe por URL
  const seen = new Set();
  return streams.filter((s) => {
    const key = s.url || s.externalUrl;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { scrapeAll, SCRAPER_CONFIG };
