// Addon Stremio: entrega streams Torrent (magnet) y HTTP/HTTPS
// Compatible con Stremio (escritorio soporta magnet; Android también vía WebTorrent)
const { addonBuilder, serveHTTP, getManifest } = require('stremio-addon-sdk');

// ---- CONFIGURACIÓN EDITABLE -------------------------------------------------
// 1) Torrentio: agrega torrents reales desde YTS/Publico/etc.
//    Pega la URL de tu manifest de Torrentio (o de cualquier addon que ya dé torrents).
//    Ej: https://torrentio.strem.fun/manifest.json
const TORRENT_SOURCE_MANIFEST = process.env.TORRENT_SOURCE || '';

// 2) Lista estática de enlaces directos HTTP/HTTPS (mp4/mkv/ts...).
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
  id: 'dev.nuvio.http-torrent',
  version: '1.0.0',
  name: 'Nuvio HTTP/Torrent Provider',
  description: 'Proporciona streams Torrent (magnet) y HTTP/HTTPS a Stremio/Nuvio TV.',
  resources: ['stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt', 'vk', 'trk'],
  catalogs: [],
  behaviorHints: { configurable: false }
};

const builder = new addonBuilder(manifest);

// Utilidad: normaliza calidad desde el nombre del archivo
function guessQuality(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('2160') || n.includes('4k')) return '4K';
  if (n.includes('1080')) return '1080p';
  if (n.includes('720')) return '720p';
  if (n.includes('480')) return '480p';
  return null;
}

// Fuente remota de torrents (ej. Torrentio). Convierte su respuesta en streams válidos.
async function getTorrentStreams(type, id) {
  if (!TORRENT_SOURCE_MANIFEST) return [];
  try {
    const mUrl = TORRENT_SOURCE_MANIFEST.replace('manifest.json', '') + `stream/${type}/${id}.json`;
    const res = await fetch(mUrl);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.streams || []).map(s => ({
      name: s.name || 'Torrent',
      description: s.description || '',
      behaviorHints: s.behaviorHints || {},
      ...(s.url ? { url: s.url } : {}),
      ...(s.infoHash ? { infoHash: s.infoHash, fileIdx: s.fileIdx ?? 0 } : {})
    }));
  } catch (e) {
    console.error('Error obteniendo torrents de fuente remota:', e.message);
    return [];
  }
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
  const [torrents, http] = await Promise.all([
    getTorrentStreams(type, id),
    Promise.resolve(getHttpStreams(type, id))
  ]);
  return { streams: [...http, ...torrents] };
});

module.exports = builder.getInterface();

if (require.main === module) {
  serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
  console.log('Addon corriendo en http://localhost:7000/manifest.json');
  console.log('Instálalo en Stremio: http://localhost:7000/addon.html');
  if (!TORRENT_SOURCE_MANIFEST) {
    console.log('AVISO: sin TORRENT_SOURCE configurado, solo se sirven los enlaces HTTP locales.');
  }
}
