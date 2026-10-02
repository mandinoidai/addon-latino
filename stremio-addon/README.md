# Nuvio HTTP/Torrent Addon (Stremio)

Addon para **Stremio** que provee streams **Torrent (magnet)** y **HTTP/HTTPS directos**.
Como Nuvio TV usa el mismo protocolo de addons de Stremio, puedes apuntar esta app al manifest.

## Uso rápido

```bash
cd stremio-addon
npm install
npm start                 # solo enlaces HTTP locales
# o con torrents reales vía Torrentio:
TORRENT_SOURCE=https://torrentio.strem.fun/manifest.json npm start
```

- Manifest: `http://localhost:7000/manifest.json`
- Página de instalación: `http://localhost:7000/addon.html`
- En Stremio: `Complementos → Añadir complemento por URL → http://localhost:7000/manifest.json`

## Configuración (index.js)

1. **Torrents**: define `TORRENT_SOURCE` (variable de entorno) con la URL del manifest de
   un addon que ya dé torrents (Torrentio, MediaWave, etc.). El addon reenvía sus streams.
2. **Enlaces HTTP/HTTPS**: edita el arreglo `DIRECT_HTTP_LINKS` con tus URLs directas
   (mp4/mkv/ts). Cada entrada necesita `imdb` (`tt...`) para asociarse a una película/serie,
   o quítalo para que aparezca en TODO el catálogo.

## Publicar para usarlo desde la TV / otros dispositivos

`localhost` solo funciona en tu PC. Opciones:
- Red local: abre el puerto 7000 y usa `http://IP-de-tu-PC:7000/manifest.json`.
- Internet: sube el proyecto a Railway/Render/VPS y usa el dominio HTTPS resultante.
- Túnel temporal: `npx cloudflared tunnel --url http://localhost:7000`.

## Notas

- Stremio de escritorio reproduce torrents (WebTorrent); en Android/iOS los magnet se abren
  en un reproductor externo si está instalado.
- Los enlaces HTTP deben permitir CORS o ser reproducibles directo; HLS usa `.m3u8`.
- Usa esto solo con contenido que tengas derecho a ver.
