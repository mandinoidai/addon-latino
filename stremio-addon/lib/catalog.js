// Catálogos estilo "Addon Latam": búsqueda + nuevos estrenos, servidos
// directamente desde el buscador de las fuentes WordPress latinas.
// Recursos declarados: catalog (búsqueda y estrenos) y meta (ficha básica).

const { cleanText } = require('./util');
const { fetchFirstAvailable } = require('./sources-latino');

// Fuente principal para catálogos: la que tenga dominios sanos primero.
const CATALOG_SOURCES = ['cinecalidad', 'pelis4du', 'dodoplay', 'serieslatino'];

async function getHtmlForCatalog(cfg) {
  // rutas del CMS: últimos estrenos y listado general
  const paths = ['/estrenos', '/ultimos', '/', '/peliculas', '/series'];
  for (const p of paths) {
    try {
      return await fetchFirstAvailable([p], cfg);
    } catch { /* siguiente ruta */ }
  }
  throw new Error('Sin catálogo disponible');
}

// Extrae <article>/tarjetas con enlace a ficha + título + poster.
// Estrategia robusta: recorta cada bloque <a>...</a> y busca dentro el
// href, la imagen y el texto/alt (los CMS varían mucho el anidamiento).
function parseCards(html, baseUrl) {
  const out = [];
  const seen = new Set();
  const SEG = /\/(?:pelicula|serie|movie|tv-show|ver|pelis)[^"']*/i;
  const reAll = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
  let block;
  while ((block = reAll.exec(html)) !== null && out.length < 50) {
    const b = block[0];
    const hrefM = /href=["']([^"']+)["']/i.exec(b);
    if (!hrefM || !SEG.test(hrefM[1])) continue;
    const href = hrefM[1].startsWith('http') ? hrefM[1] : baseUrl + hrefM[1];
    const imgM = /<img[^>]+src=["']([^"']+)["'][^>]*>/i.exec(b);
    const altM = imgM && /alt=["']([^"']*)["']/i.exec(imgM[0]);
    // título: alt > texto visible dentro del <a> (sin tags) > slug de la URL
    const textM = b.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const title = cleanText(altM && altM[1]) ||
                  (textM.length >= 3 ? textM : '') ||
                  decodeURIComponent(href.split('/').pop())
                    .replace(/-temporada.*$/i, '').replace(/-\d+$/, '').replace(/-/g, ' ');
    if (!title || seen.has(href)) continue;
    seen.add(href);
    const poster = imgM ? (/^https?:/.test(imgM[1]) ? imgM[1] : baseUrl + imgM[1]) : undefined;
    out.push({ href, title, poster });
  }
  return out;
}

// type: 'movie' | 'series' — filtra tarjetas por segmento de URL
function filterByType(cards, type) {
  const seg = type === 'movie' ? /\/(pelicula|movie|ver-pelicula)/i : /\/(serie|tv-show|ver-serie|temporada)/i;
  const filtered = cards.filter((c) => seg.test(c.href));
  return filtered.length ? filtered : cards; // fallback: no filtrar
}

// ---- RESOURCE: catalog ----------------------------------------------------
async function defineCatalog(type, id, extra) {
  const isSearch = extra && extra.search;
  const wpSites = require('./scrape').SCRAPER_CONFIG;

  for (const siteId of CATALOG_SOURCES) {
    const cfg = wpSites[siteId];
    if (!cfg || !cfg.enabled) continue;
    let page;
    try {
      page = isSearch
        ? await fetchFirstAvailable([`/?s=${encodeURIComponent(extra.search)}`], cfg)
        : await getHtmlForCatalog(cfg);
    } catch {
      continue; // fuente caída -> probar la siguiente
    }
    let cards = parseCards(page.html, page.base);
    cards = filterByType(cards, type);
    if (!cards.length) continue;

    const metas = cards.map((c, i) => ({
      id: `${type === 'movie' ? 'lat:' : 'las:'}${siteId}:${encodeURIComponent(c.href)}`,
      type,
      name: c.title,
      poster: c.poster,
      posterShape: type === 'movie' ? 'poster' : 'poster',
      description: `Fuente: ${siteId}. Selecciona para ver streams en latino.`,
    }));
    return { metas };
  }
  return { metas: [] };
}

// ---- RESOURCE: meta -------------------------------------------------------
// Stremio pide meta de un id "lat:<site>:<url-encoded-href>" -> devolvemos
// la ficha básica leyendo el <title>/og:title de esa página.
async function defineMeta(type, id) {
  const parts = String(id).split(':');
  if (parts[0] !== 'lat' && parts[0] !== 'las') return null;
  const href = decodeURIComponent(parts.slice(2).join(':'));
  const cfg = require('./scrape').SCRAPER_CONFIG[parts[1]];
  if (!cfg) return null;

  let html;
  try {
    html = await fetchFirstAvailable([href.replace(/^https?:\/\/[^/]+/, '')], cfg).then((r) => r.html);
  } catch {
    try { html = await require('./util').browserFetch(href); } catch { return null; }
  }
  const t = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  const img = /property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html) ||
              /content=["']([^"']+)["'][^>]+property=["']og:image["']/i.exec(html);
  const desc = /property=["']og:description["'][^>]+content=["']([^"']+)["']/i.exec(html);
  return {
    meta: {
      id,
      type: parts[0] === 'lat' ? 'movie' : 'series',
      name: cleanText(t ? t[1].split(/[|\-–]/)[0] : 'Sin título'),
      poster: img ? img[1] : undefined,
      background: img ? img[1] : undefined,
      description: desc ? cleanText(desc[1]) : undefined,
    },
  };
}

module.exports = { defineCatalog, defineMeta, parseCards };
