// Helpers compartidos por scrape.js y sources-latino.js (sin dependencias internas)
const { guessQuality, sortStreams, hostOf, browserFetch } = require('./util');
const { sortedBases } = require('./health');

// Prueba varios dominios espejo hasta que uno responda (sanos primero).
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

// Extrae enlaces de video directo (.m3u8 / .mp4 / .mkv) del HTML
function extractDirectLinks(html) {
  const out = [];
  const seen = new Set();
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

// Extrae servidores/embeds embebidos (iframes...)
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

module.exports = { fetchFirstAvailable, extractDirectLinks, extractEmbeds, streamFromUrl };
