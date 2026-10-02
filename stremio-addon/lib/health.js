// Health-check periódico de las fuentes (dominios espejo) del addon.
// Cada cierto intervalo hace una petición HEAD/GET ligera a cada dominio
// y marca los que responden. El scraper solo prueba dominios "sanos" primero,
// y si todos fallan reintenta con los caídos por si recuperaron.

const { browserFetch } = require('./util');

const state = {}; // baseUrl -> { ok, lastCheck, lastError }
let timer = null;

async function checkBase(base) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 12000);
  try {
    await fetch(base, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        accept: 'text/html',
      },
    });
    state[base] = { ok: true, lastCheck: Date.now(), lastError: null };
  } catch (e) {
    state[base] = { ok: false, lastCheck: Date.now(), lastError: String(e.message || e) };
  } finally {
    clearTimeout(to);
  }
}

// Devuelve los dominios ordenados: sanos primero, caídos al final
function sortedBases(baseUrls) {
  return [...baseUrls].sort((a, b) => {
    const sa = state[a]?.ok === true ? 0 : 1;
    const sb = state[b]?.ok === true ? 0 : 1;
    return sa - sb;
  });
}

function isHealthy(base) {
  return state[base]?.ok === true;
}

// Inicia chequeo periódico. intervalMin: minutos entre rondas.
function startHealthCheck(scraperConfig, intervalMin = 15) {
  const allBases = Object.values(scraperConfig).flatMap((c) => c.baseUrls || []);
  const run = () => Promise.all(allBases.map(checkBase));
  run(); // primera ronda inmediata
  timer = setInterval(run, intervalMin * 60 * 1000);
  if (timer.unref) timer.unref();
}

function stopHealthCheck() {
  if (timer) clearInterval(timer);
  timer = null;
}

function getHealthReport() {
  return Object.entries(state).map(([base, s]) => ({
    base,
    ok: s.ok,
    lastCheck: new Date(s.lastCheck).toISOString(),
    lastError: s.lastError,
  }));
}

module.exports = { startHealthCheck, stopHealthCheck, sortedBases, isHealthy, getHealthReport };
