// =================== FAMILIA "CINECALIDAD" (mismo CMS que la mayoría de
// páginas latinas: Pelis4Du, PeliculasHD, Serienet, etc.) ===================
// Estas fuentes comparten estructura HTML: buscador /?s=<q>, fichas con
// <article>/<h2> enlazadas, y dentro de la ficha una lista de <select> o
// botones por servidor + un iframe/player. Un solo scraper parametrizable
// sirve para varias familias de sitios; agrega dominios espejo a gusto.

const { slugify, cleanText, guessQuality, sortStreams, hostOf, browserFetch } = require('./util');
const { sortedBases } = require('./health');
const { extractDirectLinks, extractEmbeds, streamFromUrl } = require('./core');

async function fetchFirstAvailable(paths, cfg) {
  let lastErr;
  for (const base of sortedBases(cfg.baseUrls)) {
    for (const p of paths) {
      try {
        const html = await browserFetch(base + p);
        return { url: base + p, html, base };
      } catch (e) { lastErr = e; }
    }
  }
  throw lastErr || new Error('Ningún dominio respondió');
}

// Busca la ficha en el sitio vía su buscador WordPress (?s=) y devuelve streams
async function scrapeWpLatino(siteName, emoji, type, meta, cfg) {
  if (!cfg.enabled) return [];
  // series: buscar solo por nombre de la serie (la ficha agrupa temporadas)
  const query = encodeURIComponent(meta.name);
  let page;
  try {
    page = await fetchFirstAvailable([`/?s=${query}`], cfg);
  } catch { return []; }

  // Primeras fichas relevantes (título coincide parcial o totalmente)
  const re = /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([^<]{3,120})<\/a>/gi;
  const wanted = slugify(meta.name);
  const candidates = [];
  let m;
  while ((m = re.exec(page.html)) !== null) {
    const href = m[1], text = cleanText(m[2]);
    if (!/\/(pelicula|serie|movie|tv-show|ver)/i.test(href)) continue;
    const s = slugify(text);
    if (!s || !(s.includes(wanted) || wanted.includes(s))) continue;
    if (!candidates.some(c => c.href === href)) candidates.push({ href, text });
    if (candidates.length >= 2) break;
  }

  const streams = [];
  for (const c of candidates.slice(0, 2)) {
    let html = page.html;
    if (c.href !== page.url) {
      try { html = await browserFetch(c.href); } catch { continue; }
    }
    // 1) directos HLS/MP4
    for (const u of extractDirectLinks(html)) {
      streams.push(streamFromUrl(u, `${emoji} ${siteName}`, 'LATINO'));
    }
    // 2) embeds/servidores
    for (const u of extractEmbeds(html, c.href.replace(/[^/]*$/, ''))) {
      if (/youtube|facebook|twitter|ads/i.test(u)) continue;
      streams.push({
        name: `${emoji} ${siteName}`,
        title: `Servidor · ${hostOf(u)} · embed`,
        externalUrl: u,
        behaviorHints: { notWebReady: true },
      });
    }
  }
  return sortStreams(streams);
}

module.exports = { scrapeWpLatino, fetchFirstAvailable };
