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
  const re = /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  const wanted = slugify(meta.name);
  const candidates = [];
  let m;
  while ((m = re.exec(page.html)) !== null) {
    const href = m[1];
    const text = cleanText(m[2].replace(/<[^>]+>/g, ' '));
    if (!/\/(pelicula|serie|movie|tv-show|ver|capitulo|temporada)/i.test(href)) continue;
    const s = slugify(text || decodeURIComponent(href.split('/').filter(Boolean).pop() || ''));
    if (!s || !(s.includes(wanted) || wanted.includes(s))) continue;
    if (!candidates.some(c => c.href === href)) candidates.push({ href, text });
    if (candidates.length >= 3) break;
  }

  // Para series: si ninguna ficha del buscador coincide, derivar URL directa
  // p.ej. https://sitio/serie/the-pitt/temporada-1/capitulo-15 (variantes comunes)
  const season = meta.season ?? 1, episode = meta.episode ?? 1;
  if (type === 'series' && candidates.length === 0) {
    const slug = slugify(meta.name);
    const derived = [
      `/serie/${slug}/temporada-${season}/capitulo-${episode}`,
      `/serie/${slug}-temporada-${season}-capitulo-${episode}`,
      `/serie/${slug}-${season}x${String(episode).padStart(2, '0')}`,
      `/serie/${slug}/${season}/episodio-${episode}`,
      `/pelicula/${slug}`, // algunas series se listan como película (sin ep)
    ];
    try {
      const d = await fetchFirstAvailable(derived, cfg);
      candidates.push({ href: d.url, text: meta.name });
    } catch { /* sin suerte */ }
  }

  const streams = [];
  for (const c of candidates.slice(0, 3)) {
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
