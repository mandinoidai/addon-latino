// Utilidades compartidas para los scrapers
const ICON = 'https://stremio.github.io/stremio-addon-sdk/assets/logo.png';

// Normaliza un título a slug compatible con URLs de sitios tipo Peliculify/Noveleria
function slugify(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Limpia texto HTML (entidades, espacios dobles)
function cleanText(s) {
  if (!s) return '';
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;|&#8217;/g, "'")
    .replace(/&quot;|&#8220;|&#8221;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

// Extrae la calidad a partir del nombre del archivo/enlace
function guessQuality(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('2160') || n.includes('4k')) return '4K';
  if (n.includes('1080')) return '1080p';
  if (n.includes('720')) return '720p';
  if (n.includes('480')) return '480p';
  if (n.includes('cam') || n.includes('hdts') || n.includes('scr')) return 'CAM';
  return null;
}

// Ordena streams por calidad (mayor primero) y luego por nombre
const QORDER = { '4K': 5, '1080p': 4, '720p': 3, '480p': 2, CAM: 0 };
function sortStreams(streams) {
  return streams.sort((a, b) => {
    const qa = QORDER[a.quality] ?? 1;
    const qb = QORDER[b.quality] ?? 1;
    if (qb !== qa) return qb - qa;
    return (a.name || '').localeCompare(b.name || '');
  });
}

// Devuelve el host legible de una URL (para nombrar al proveedor)
function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'embed';
  }
}

// Resuelve redirecciones cortas (bit.ly, etc.) o cualquier URL hasta su destino final
async function resolveRedirect(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
    });
    return res.url || url;
  } catch {
    return url;
  }
}

// Fetch con headers de navegador (muchos sitios bloquean user-agent vacío)
async function browserFetch(url, opts = {}) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
      Referer: new URL(url).origin,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.text();
}

module.exports = { ICON, slugify, cleanText, guessQuality, sortStreams, hostOf, resolveRedirect, browserFetch };
