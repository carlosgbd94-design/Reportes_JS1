import { apiCall } from './api.js';
import { store } from './store.js';
import { $, normalizeTextKey, fixUtf8Text, canSeeMunicipio, debounce } from './utils.js';

// Declaraciones de Módulo con Sincronización Global (Legacy Bridge)
// Esto asegura que tanto el módulo como scripts externos vean el mismo estado.
let _TOKEN = localStorage.getItem("JS1_TOKEN") || null;
let _USER = null;
let _BIO_ENABLED = false;
let _CON_ENABLED = false;
let _UNIT_BATCHES = [];
let _BATCH_CATALOG = [];
let _CONFIG_BIO = [];

Object.defineProperty(window, 'TOKEN', { get: () => _TOKEN, set: (v) => _TOKEN = v, configurable: true });
Object.defineProperty(window, 'USER', { get: () => _USER, set: (v) => _USER = v, configurable: true });
Object.defineProperty(window, 'BIO_IS_ENABLED', { get: () => _BIO_ENABLED, set: (v) => _BIO_ENABLED = v, configurable: true });
Object.defineProperty(window, 'CON_IS_ENABLED', { get: () => _CON_ENABLED, set: (v) => _CON_ENABLED = v, configurable: true });
Object.defineProperty(window, 'UNIT_BATCHES', { get: () => _UNIT_BATCHES, set: (v) => _UNIT_BATCHES = v, configurable: true });
Object.defineProperty(window, 'BATCH_CATALOG', { get: () => _BATCH_CATALOG, set: (v) => _BATCH_CATALOG = v, configurable: true });
Object.defineProperty(window, 'CONFIG_BIOLOGICOS_CATALOG', { get: () => _CONFIG_BIO, set: (v) => _CONFIG_BIO = v, configurable: true });

// Exponer utilidades al módulo y a window
window.apiCall = apiCall;
window.store = store;
window.$ = $;
window.normalizeTextKey_ = normalizeTextKey;
window.fixUtf8Text_ = fixUtf8Text;
window.canSeeMunicipio_ = canSeeMunicipio;
window.debounce = debounce;
window.LIVE_STATE = store.state.liveState;

// --- PERSISTENCIA DE SESIÃ“N (localStorage) ---
function saveSession(token, user) {
  try {
    localStorage.setItem("JS1_TOKEN", token);
    localStorage.setItem("JS1_USER", JSON.stringify(user));
  } catch(e) { console.warn("No se pudo guardar sesiÃ³n:", e); }
}
