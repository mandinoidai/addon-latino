// Scrapers de fuentes en español latino (peliculas/series LATINO)
// Cada scraper devuelve streams Stremio ({ name, title, url } con url .m3u8/.mp4 o embed).
// Nota: los DOMs de estos sitios cambian con frecuencia; si uno deja de funcionar,
// agrega otro dominio espejo en SCRAPER_CONFIG o un nuevo scraper con la misma firma.

const { slugify, cleanText, guessQuality, sortStreams, hostOf, browserFetch } = require('./util');
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
};
// ---------------------------------------------------------------------------

// Prueba varios dominios espejo hasta que uno responda.
// Usa el orden del health-check: dominios sanos primero, caídos al final.
async function fetchFirstAvailable(paths, cfg) {
  let lastErr;
  for (const base of sortedBases(cfg.baseUrls)) {
    for (const p of paths) {
      const url = base + p;
      try {
        const html = await browserFetch(url);
        return { url, html, base };
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw lastErr || new Error('Ningún dominio respondió');
}

// Extrae enlaces de video directo (.m3u8 / .mp4) del HTML, con su nombre cercano
function extractDirectLinks(html) {
  const out = [];
  const seen = new Set();
  // src="...m3u8" / file: "...mp4" / data-video="..." etc.
  const re = /(?:src|href|data-(?:src|video|file)|file|url)\s*[:=]\s*["']([^"']+?\.(?:m3u8|mp4|mkv)(?:\?[^"']*)?)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const u = m[1];
    if (seen.has(u)) continue;
    if (u.startsWith('data:') || u.includes('preload')) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

// Extrae servidores/embeds embebidos (iframe, playerjs, jwplayer sources...)
function extractEmbeds(html, base) {
  const out = [];
  const seen = new Set();
  const reIframe = /<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = reIframe.exec(html)) !== null) {
    let u = m[1];
    if (!u.startsWith('http')) u = base + (u.startsWith('/') ? '' : '/') + u;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function streamFromUrl(url, label, extraName) {
  const q = guessQuality(url) || guessQuality(label);
  const host = hostOf(url);
  const isHls = /\.m3u8/i.test(url);
  const isMp4 = /\.(mp4|mkv)(\?|$)/i.test(url);
  return {
    name: `🎬 ${extraName || 'LATINO'}`,
    title: [
      `${label || host}${q ? ' ' + q : ''}`,
      isHls ? '(HLS)' : isMp4 ? '(MP4)' : '(Embed)',
      host,
    ]
      .filter(Boolean)
      .join(' · '),
    url,
    behaviorHints: { notWebReady: !isHls && !isMp4, bingeGroup: `lat-${host}` },
  };
}

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

// ===================== AGREGADOR ============================================
const SCRAPERS = [
  { id: 'peliculify', fn: scrapePeliculify },
  { id: 'noveleria', fn: scrapeNoveleria },
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

module.exports = { scrapeAll, SCRAPER_CONFIG, extractDirectLinks, extractEmbeds, streamFromUrl };
